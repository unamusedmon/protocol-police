import { defineMiddleware } from 'astro:middleware';
import { verifySession } from './lib/auth';

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, request, cookies, redirect } = context;

  // Public routes
  const publicRoutes = ['/login', '/register', '/favicon.ico', '/favicon.svg'];
  
  if (publicRoutes.includes(url.pathname)) {
    return next();
  }
  
  // Exclude assets
  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/src/')) {
      return next();
  }

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

  // Add user to locals so components can access it easily
  context.locals.user = user;

  return next();
});