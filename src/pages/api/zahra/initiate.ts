import type { APIRoute } from 'astro';
import { verifySession } from '../../../lib/auth';
import { getInitiationMessage } from '../../../lib/zahra';
import { db } from '../../../lib/db';
import { sanitizeText } from '../../../lib/sanitize';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const data = getInitiationMessage(user);
    
    // If there is an initiation message, save it so we don't repeat it immediately
    if (data.message) {
      // Sanitize the initiation message before storing
      const sanitizedMessage = sanitizeText(data.message);
      db.prepare("INSERT INTO zahra_messages (user_id, role, content, emotional_state) VALUES (?, 'assistant', ?, ?)").run(user.userId, sanitizedMessage, data.emotionalState);
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: data.message ? sanitizeText(data.message) : null,
      emotionalState: data.emotionalState
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Zahra initiate API error:', err);
    return new Response(JSON.stringify({ 
      error: 'Failed to initialize Zahra session.'
    }), { status: 500 });
  }
};