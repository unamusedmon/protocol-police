import type { APIRoute } from 'astro';
import { recordFragmentRead } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json();
    const { rfcId, fragmentIndex, totalFragments } = body;
    
    if (!rfcId || typeof fragmentIndex !== 'number' || typeof totalFragments !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }
    
    const newRank = recordFragmentRead(user.userId, rfcId, fragmentIndex, totalFragments);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};