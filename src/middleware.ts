import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/auth';

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS = 100;
const rateLimitMap = new Map<string, { count: number, start: number }>();

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, redirect } = context;

  // 1. Simple Rate Limiting
  const ip = request.headers.get('x-forwarded-for') || 'local';
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
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 2. Public routes & Assets
  const publicRoutes = ['/login', '/register', '/favicon.ico', '/favicon.svg'];
  if (publicRoutes.includes(url.pathname) || url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/src/')) {
    const response = await next();
    // Add Security Headers
    response.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://mars.chub.ai;");
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
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
  response.headers.set('Content-Security-Policy', "default-src 'self'; img-src 'self' https: data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src 'self' https://mars.chub.ai;");
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
});