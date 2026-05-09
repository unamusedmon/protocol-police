import type { APIRoute } from 'astro';
import { z } from 'zod';
import { verifySession } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { generateZahraResponse, determineEmotionalState, buildSystemPrompt } from '../../../lib/zahra';
import { sanitizeText } from '../../../lib/sanitize';

// Validation schema for chat request
const chatSchema = z.object({
  message: z.string().min(1).max(10000, 'Message too long'),
  currentPage: z.any().optional()
});

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json().catch(() => ({}));
    
    // Validate input
    const parsed = chatSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ 
        error: 'Invalid input',
        details: parsed.error.format()
      }), { status: 400 });
    }

    const { message, currentPage } = parsed.data;
    
    // Sanitize message before processing
    const sanitizedMessage = sanitizeText(message);

    // Get rank info for context
    const rankRow = db.prepare('SELECT current_rank FROM rank WHERE user_id = ?').get(user.userId) as any;
    
    // Load last 20 messages (sanitize each content)
    const history = db.prepare("SELECT role, content FROM zahra_messages WHERE user_id = ? ORDER BY id DESC LIMIT 20").all(user.userId) as any[];
    // Reverse to chronological
    history.reverse();

    // Save user message (sanitized)
    db.prepare("INSERT INTO zahra_messages (user_id, role, content) VALUES (?, 'user', ?)").run(user.userId, sanitizedMessage);

    const systemPrompt = buildSystemPrompt(user, currentPage);
    const responseText = await generateZahraResponse(systemPrompt, history, sanitizedMessage);
    const emotionalState = determineEmotionalState({ rankTitle: rankRow?.current_rank }, responseText);

    // Save assistant message (already sanitized by generateZahraResponse)
    db.prepare("INSERT INTO zahra_messages (user_id, role, content, emotional_state) VALUES (?, 'assistant', ?, ?)").run(user.userId, responseText, emotionalState);

    return new Response(JSON.stringify({ success: true, response: responseText, emotionalState }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    // SECURITY: Don't leak internal error details
    console.error('Zahra Chat API Error:', err);
    return new Response(JSON.stringify({ 
      error: 'An error occurred while processing your message. Please try again.'
    }), { status: 500 });
  }
};