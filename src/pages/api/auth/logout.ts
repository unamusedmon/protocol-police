import type { APIRoute } from 'astro';
import { invalidateSession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request, cookies }) => {
  // Get the token from cookie before deleting it
  const cookieHeader = request.headers.get('cookie');
  const token = cookieHeader?.split(';').find(c => c.trim().startsWith('pp_session='))?.split('=')[1];
  
  // Invalidate the session server-side
  if (token) {
    await invalidateSession(token).catch(() => {}); // Best effort - don't fail if invalidation fails
  }
  
  // Delete client-side cookie
  cookies.delete('pp_session', { path: '/' });
  
  return new Response(JSON.stringify({ 
    success: true, 
    redirect: '/login' 
  }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
};
