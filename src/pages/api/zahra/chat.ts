import type { APIRoute } from 'astro';
import { verifySession } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { generateZahraResponse, determineEmotionalState, buildSystemPrompt } from '../../../lib/zahra';

export const POST: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const body = await request.json();
    const { message, currentPage } = body;
    
    if (!message) {
      return new Response(JSON.stringify({ error: 'Message required' }), { status: 400 });
    }

    // Get rank info for context
    const rankRow = db.prepare('SELECT current_rank FROM rank WHERE user_id = ?').get(user.userId) as any;
    
    // Load last 20 messages
    const history = db.prepare("SELECT role, content FROM zahra_messages WHERE user_id = ? ORDER BY id DESC LIMIT 20").all(user.userId) as any[];
    // Reverse to chronological
    history.reverse();

    // Save user message
    db.prepare("INSERT INTO zahra_messages (user_id, role, content) VALUES (?, 'user', ?)").run(user.userId, message);

    const systemPrompt = buildSystemPrompt(user, currentPage);
    const responseText = await generateZahraResponse(systemPrompt, history, message);
    const emotionalState = determineEmotionalState({ rankTitle: rankRow?.current_rank }, responseText);

    // Save assistant message
    db.prepare("INSERT INTO zahra_messages (user_id, role, content, emotional_state) VALUES (?, 'assistant', ?, ?)").run(user.userId, responseText, emotionalState);

    return new Response(JSON.stringify({ success: true, response: responseText, emotionalState }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('Zahra Chat API Error:', err);
    return new Response(JSON.stringify({ error: err.message || 'Internal Server Error' }), { status: 500 });
  }
};