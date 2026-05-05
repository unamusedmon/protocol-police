import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import type { AstroGlobal } from 'astro';
import { db } from './db';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback_secret_for_development_only_12345');
const SESSION_COOKIE = 'pp_session';

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
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.userId || !payload.callsign) return null;
    
    // Check if user still exists
    const user = db.prepare('SELECT id, callsign, settings FROM users WHERE id = ?').get(payload.userId) as any;
    if (!user) return null;
    
    return {
      userId: user.id as number,
      callsign: user.callsign as string,
      settings: JSON.parse(user.settings || '{}')
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