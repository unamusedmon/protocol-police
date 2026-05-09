import type { APIRoute } from 'astro';
import { recordFlashcardRating } from '../../../lib/progression';
import { verifySession } from '../../../lib/auth';
import { z } from 'zod';
import { sanitizeText } from '../../../lib/sanitize';

// Input length limits
const MAX_ID_LENGTH = 255;
const MAX_RFC_ID_LENGTH = 50;

const flashcardSchema = z.object({
  cardId: z.string().min(1).max(MAX_ID_LENGTH, `cardId must be at most ${MAX_ID_LENGTH} characters`),
  rfcId: z.string().min(1).max(MAX_RFC_ID_LENGTH, `rfcId must be at most ${MAX_RFC_ID_LENGTH} characters`),
  rating: z.enum(['BRAIN_ROT', 'SKILL_ISSUE', 'ACCEPTABLE', 'RFC_GOD'])
});

export const POST: APIRoute = async ({ request }) => {
  const errorId = crypto.randomUUID();
  
  try {
    const user = await verifySession(request);
    if (!user) {
      return new Response(JSON.stringify({ 
        error: 'Unauthorized',
        errorId 
      }), { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Limit request body size
    const contentLength = request.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 10240) { // 10KB max
      return new Response(JSON.stringify({ 
        error: 'Request too large',
        errorId 
      }), { 
        status: 413,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json().catch(() => ({}));
    const result = flashcardSchema.safeParse(body);
    
    if (!result.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid request data', 
        details: result.error.format(),
        errorId 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Sanitize inputs
    const { cardId, rfcId, rating } = result.data;
    const sanitizedCardId = sanitizeText(cardId);
    const sanitizedRfcId = sanitizeText(rfcId);
    
    if (!sanitizedCardId || !sanitizedRfcId) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input after sanitization',
        errorId 
      }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const newRank = recordFlashcardRating(user.userId, sanitizedCardId, sanitizedRfcId, rating);
    
    return new Response(JSON.stringify({ success: true, newRank }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error(`[${errorId}] Flashcard progress error:`, {
      error: err.message,
      stack: err.stack,
      timestamp: new Date().toISOString()
    });
    
    return new Response(JSON.stringify({ 
      error: 'Failed to record flashcard rating. Please try again.',
      errorId 
    }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
