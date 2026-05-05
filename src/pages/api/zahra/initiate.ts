import type { APIRoute } from 'astro';
import { verifySession } from '../../../lib/auth';
import { getInitiationMessage } from '../../../lib/zahra';
import { db } from '../../../lib/db';

export const GET: APIRoute = async ({ request }) => {
  try {
    const user = await verifySession(request);
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

    const data = getInitiationMessage(user);
    
    // If there is an initiation message, save it so we don't repeat it immediately
    if (data.message) {
      db.prepare("INSERT INTO zahra_messages (user_id, role, content, emotional_state) VALUES (?, 'assistant', ?, ?)").run(user.userId, data.message, data.emotionalState);
    }
    
    return new Response(JSON.stringify({ success: true, ...data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
};