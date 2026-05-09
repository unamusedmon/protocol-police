import type { APIRoute } from 'astro';
import { z } from 'zod';
import { recordScenarioComplete } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';
import { sanitizeText } from '../../../lib/sanitize';

const scenarioSchema = z.object({
  scenarioId: z.string().min(1).max(255),
  score: z.number().int().min(0).max(1000)
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json().catch(() => ({}));
    
    const parsed = scenarioSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input',
        details: parsed.error.format()
      }), { status: 400 });
    }
    
    const { scenarioId, score } = parsed.data;
    
    // Sanitize scenarioId
    const sanitizedScenarioId = sanitizeText(scenarioId);
    
    const newRank = recordScenarioComplete(user.userId, sanitizedScenarioId, score);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    // SECURITY: Don't leak internal errors
    console.error('Scenario API error:', err);
    return new Response(JSON.stringify({ 
      error: 'An error occurred while recording scenario progress.'
    }), { status: 500 });
  }
};