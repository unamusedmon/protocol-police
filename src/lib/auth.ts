import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { AstroGlobal } from 'astro';
import { db } from './db';

// Validate JWT_SECRET exists and is secure
const rawJwtSecret = process.env.JWT_SECRET;
if (!rawJwtSecret || rawJwtSecret.length < 32) {
  throw new Error(
    'CRITICAL: JWT_SECRET is not configured or is too short. ' +
    'Please set a secure JWT secret with at least 32 characters in your .env file. ' +
    'Use: openssl rand -base64 48'
  );
}

// Check for common insecure patterns
const insecurePatterns = ['your_jwt_secret_here', 'fallback_secret', '12345', 'password', 'secret'];
if (insecurePatterns.some(pattern => rawJwtSecret.toLowerCase().includes(pattern))) {
  throw new Error(
    'CRITICAL: JWT_SECRET contains an insecure pattern. ' +
    'Please generate a new secure secret.'
  );
}

const JWT_SECRET = new TextEncoder().encode(rawJwtSecret);

const SESSION_COOKIE = 'pp_session';

// Note: invalidated_sessions table is created in db.ts with proper schema and indexes

// Hash a token for storage in the invalidated_sessions table
async function hashTokenForInvalidation(token: string): Promise<string> {
  // Use a simple hash - we don't need cryptographic security here, just a fixed-length identifier
  const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function hashPassword(password: string): Promise<string> {
  return await bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return await bcrypt.compare(password, hash);
}

export async function createSession(userId: number, callsign: string): Promise<string> {
  const jwt = await new SignJWT({ userId, callsign })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  return jwt;
}

/**
 * Invalidate a session token server-side
 * The JWT will still be valid until expiration, but we track invalidated tokens
 * to reject them during verification
 */
export async function invalidateSession(token: string): Promise<void> {
  try {
    const tokenHash = await hashTokenForInvalidation(token);
    db.prepare('INSERT OR IGNORE INTO invalidated_sessions (token_hash) VALUES (?)').run(tokenHash);
    
    // Clean up old invalidated sessions (older than 7 days - max JWT lifetime)
    db.prepare('DELETE FROM invalidated_sessions WHERE invalidated_at < datetime("now", "-7 days")').run();
  } catch (err) {
    console.error('Failed to invalidate session:', err);
  }
}

/**
 * Check if a token has been invalidated server-side
 */
async function isTokenInvalidated(token: string): Promise<boolean> {
  try {
    const tokenHash = await hashTokenForInvalidation(token);
    const result = db.prepare('SELECT 1 FROM invalidated_sessions WHERE token_hash = ?').get(tokenHash);
    return !!result;
  } catch (err) {
    console.error('Failed to check token invalidation:', err);
    return false; // Fail open - don't block user if we can't check
  }
}

export async function verifySession(request: Request) {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [key, ...v] = c.trim().split('=');
      return [key, v.join('=')];
    })
  );

  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  try {
    // Check if token has been invalidated server-side
    const isInvalidated = await isTokenInvalidated(token);
    if (isInvalidated) {
      return null;
    }
    
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.userId || !payload.callsign) return null;
    
    // Check if user still exists
    const user = db.prepare('SELECT id, callsign, settings FROM users WHERE id = ?').get(payload.userId) as any;
    if (!user) return null;
    
    // Safe parse of user settings
    let settings = {};
    try {
      if (user.settings) {
        settings = JSON.parse(user.settings);
      }
    } catch (e) {
      console.error('Failed to parse user settings, using defaults:', e);
      settings = {};
    }
    
    return {
      userId: user.id as number,
      callsign: user.callsign as string,
      settings
    };
  } catch (err) {
    return null;
  }
}

export async function requireAuth(request: Request) {
  const user = await verifySession(request);
  if (!user) {
    const url = new URL(request.url);
    throw new Response(null, {
      status: 302,
      headers: {
        Location: `/login?redirect=${encodeURIComponent(url.pathname)}`
      }
    });
  }
  return user;
}