import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/auth';
import { config, runtimeConfig } from './lib/config';

// Import config to trigger validation at startup
// This will throw an error if configuration is invalid
const _config = config;

const RATE_LIMIT_WINDOW = runtimeConfig.rateLimit.windowMs;
const MAX_REQUESTS = runtimeConfig.rateLimit.maxRequests;
const RATE_LIMIT_CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
const rateLimitMap = new Map<string, { count: number, start: number }>();

// Cleanup old rate limit entries periodically to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [ip, info] of rateLimitMap.entries()) {
    if (now - info.start > RATE_LIMIT_WINDOW * 10) {
      rateLimitMap.delete(ip);
    }
  }
}, RATE_LIMIT_CLEANUP_INTERVAL);

// Strong CSP - uses nonces for inline scripts/styles
// Note: For Astro with React, we need 'unsafe-inline' for React's hydration
// but we've removed allowDangerousHtml from markdown processing
const buildCsp = (nonce?: string) => {
  const base = [
    "default-src 'self'",
    "img-src 'self' https: data:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self' https://mars.chub.ai",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self' 'unsafe-inline'", // Required for React hydration
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com" // Required for CSS-in-JS
  ];
  
  if (nonce) {
    base.push(`script-src 'self' 'nonce-${nonce}'`);
    base.push(`style-src 'self' 'nonce-${nonce}'`);
  }
  
  return base.join('; ');
};

// Generate a nonce for CSP
const generateNonce = () => {
  return crypto.randomUUID().replace(/-/g, '');
};

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, redirect } = context;

  // 1. Simple Rate Limiting with memory cleanup
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'local';
  const now = Date.now();
  const limitInfo = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - limitInfo.start > RATE_LIMIT_WINDOW) {
    limitInfo.count = 1;
    limitInfo.start = now;
  } else {
    limitInfo.count++;
  }
  rateLimitMap.set(ip, limitInfo);

  if (limitInfo.count > MAX_REQUESTS) {
    return new Response(JSON.stringify({ error: 'Too many requests. Slow down, operator.' }), {
      status: 429,
      headers: { 
        'Content-Type': 'application/json',
        'Retry-After': Math.ceil((RATE_LIMIT_WINDOW - (now - limitInfo.start)) / 1000).toString()
      }
    });
  }

  // 2. Generate CSP nonce
  const nonce = generateNonce();

  // 2. Public routes & Assets
  const publicRoutes = ['/login', '/register', '/favicon.ico', '/favicon.svg'];
  if (publicRoutes.includes(url.pathname) || url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/src/')) {
    const response = await next();
    // Add Security Headers
    response.headers.set('Content-Security-Policy', buildCsp(nonce));
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    return response;
  }

  // 3. Auth Check
  const user = await verifySession(request);

  if (!user) {
    if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }
    return redirect(`/login?redirect=${encodeURIComponent(url.pathname)}`);
  }

  context.locals.user = user;
  
  const response = await next();
  // Add Security Headers to authenticated responses
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return response;
});