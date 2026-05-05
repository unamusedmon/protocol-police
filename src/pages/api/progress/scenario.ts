import type { APIRoute } from 'astro';
import { recordScenarioComplete } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json();
    const { scenarioId, score } = body;
    
    if (!scenarioId || typeof score !== 'number') {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }
    
    const newRank = recordScenarioComplete(user.userId, scenarioId, score);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};