import type { APIRoute } from 'astro';
import { recordFlashcardRating } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';
import { z } from 'zod';

const flashcardSchema = z.object({
  cardId: z.string().min(1),
  rfcId: z.string().min(1),
  rating: z.enum(['BRAIN_ROT', 'SKILL_ISSUE', 'ACCEPTABLE', 'RFC_GOD'])
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });

    const body = await request.json();
    const result = flashcardSchema.safeParse(body);
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request data', 
        details: result.error.format() 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const { cardId, rfcId, rating } = result.data;
    const newRank = recordFlashcardRating(user.userId, cardId, rfcId, rating);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
