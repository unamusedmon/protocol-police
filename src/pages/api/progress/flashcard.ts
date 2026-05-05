import type { APIRoute } from 'astro';
import { recordFlashcardRating } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json();
    const { cardId, rfcId, rating } = body;
    
    if (!cardId || !rfcId || !rating) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), { status: 400 });
    }
    
    const newRank = recordFlashcardRating(user.userId, cardId, rfcId, rating);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};