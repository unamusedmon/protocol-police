import { db } from './db';

const CSRF_TOKEN_LENGTH = 32;
const CSRF_TOKEN_EXPIRY_HOURS = 24;

// Note: csrf_tokens table is created in db.ts with proper schema and indexes

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < CSRF_TOKEN_LENGTH; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}

/**
 * Create and store a new CSRF token for a user (or anonymously)
 */
export function createCsrfToken(userId?: number): string {
  const token = generateCsrfToken();
  
  // Clean up old tokens first
  db.prepare('DELETE FROM csrf_tokens WHERE created_at < datetime("now", "-24 hours")').run();
  
  // Store the new token
  db.prepare('INSERT INTO csrf_tokens (token, user_id) VALUES (?, ?)').run(token, userId || null);
  
  return token;
}

/**
 * Validate a CSRF token
 */
export function validateCsrfToken(token: string, userId?: number): boolean {
  try {
    const result = db.prepare(`
      SELECT token, used FROM csrf_tokens 
      WHERE token = ? AND used = FALSE 
      ${userId ? 'AND (user_id = ? OR user_id IS NULL)' : ''}
      AND created_at >= datetime("now", "-24 hours")
    `).get(token, userId || null) as { token: string; used: number } | undefined;
    
    if (!result) {
      return false;
    }
    
    // Mark token as used
    db.prepare('UPDATE csrf_tokens SET used = TRUE WHERE token = ?').run(token);
    
    return true;
  } catch (err) {
    console.error('CSRF validation error:', err);
    return false; // Fail open in case of errors - don't block legitimate users
  }
}

/**
 * Clean up expired CSRF tokens
 */
export function cleanupCsrfTokens(): void {
  db.prepare('DELETE FROM csrf_tokens WHERE created_at < datetime("now", "-24 hours")').run();
}
