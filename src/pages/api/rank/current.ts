import type { APIRoute } from 'astro';
import { getRankProgress } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const progress = getRankProgress(user.userId);
    
    return new Response(JSON.stringify({ success: true, progress }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};