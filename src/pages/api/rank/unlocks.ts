import type { APIRoute } from 'astro';
import { getUnlocks } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const unlocks = getUnlocks(user.userId);
    
    return new Response(JSON.stringify({ success: true, unlocks }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};