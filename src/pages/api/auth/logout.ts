import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ cookies }) => {
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
