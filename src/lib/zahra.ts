import { db } from './db';
import { getRankProgress } from './progression';
import { RANKS } from './ranks';

export async function generateZahraResponse(systemPrompt: string, history: any[], message: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('GEMINI_API_KEY is not configured with a valid key. Please add your key to the .env file.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent`;
  
  const contents: any[] = [];
  
  // API requires alternating user/model, starting with user.
  // We'll gather all candidate messages (history + current) and filter/merge them.
  const rawMessages = [
    ...history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', text: m.content })),
    { role: 'user', text: message }
  ];

  for (const raw of rawMessages) {
    // 1. Skip leading model messages
    if (contents.length === 0 && raw.role === 'model') continue;

    // 2. If consecutive same role, merge text
    if (contents.length > 0 && contents[contents.length - 1].role === raw.role) {
      contents[contents.length - 1].parts[0].text += "\n\n" + raw.text;
    } else {
      contents.push({
        role: raw.role,
        parts: [{ text: raw.text }]
      });
    }
  }

  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents,
    generationConfig: {
      maxOutputTokens: 300,
      temperature: 0.7
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API Error Status:', response.status);
    console.error('Gemini API Error Body:', errorText);
    throw new Error(`Zahra core error (${response.status}). Check server logs.`);
  }

  const data = await response.json();
  console.log('Gemini API Full Response:', JSON.stringify(data, null, 2));
  
  if (data.promptFeedback?.blockReason) {
    throw new Error(`Zahra core blocked the prompt: ${data.promptFeedback.blockReason}`);
  }

  const candidate = data.candidates?.[0];
  if (!candidate) {
    throw new Error('Zahra core failed to generate a response (empty candidate).');
  }

  if (candidate.finishReason === 'SAFETY') {
    return "I— I'm sorry, that topic makes me feel a bit uncomfortable... Could we talk about protocols instead?";
  }

  return candidate.content?.parts?.[0]?.text || "I— I'm sorry, my core is a bit fuzzy right now...";
}

export function determineEmotionalState(context: any, message: string): string {
  // Simple heuristic based on text content (in a full setup we could ask Gemini to output state, but this is faster)
  const lower = message.toLowerCase();
  
  if (lower.includes('congratulations') || lower.includes('amazing') || lower.includes('wow') || lower.includes('so proud')) {
    if (context.rankTitle === 'PROTOCOL WIZARD') return 'OVERWHELMED_PROUD';
    return 'FLUSTERED_HAPPY';
  }
  
  if (lower.includes('w-well') || lower.includes('i—') || lower.includes('um')) {
    if (lower.includes('worry') || lower.includes('careful')) return 'WORRIED';
    return 'SHY_IDLE';
  }
  
  if (lower.includes('struggle') || lower.includes('hard') || lower.includes('worry')) {
    return 'WORRIED';
  }

  if (lower.includes('been a while') || lower.includes('missed you')) {
    return 'QUIETLY_SAD';
  }
  
  if (lower.includes('?')) {
    return 'THINKING';
  }
  
  return 'SHY_IDLE';
}

export function buildSystemPrompt(user: any, currentPage: any): string {
  const rankProgress = getRankProgress(user.userId);
  
  // Gather stats
  const rfcGods = db.prepare("SELECT DISTINCT rfc_id FROM flashcard_log WHERE user_id = ? AND rating = 'RFC_GOD'").all(user.userId) as any[];
  const brainRots = db.prepare("SELECT DISTINCT rfc_id FROM flashcard_log WHERE user_id = ? AND rating = 'BRAIN_ROT'").all(user.userId) as any[];
  const completedRfcs = db.prepare("SELECT rfc_id FROM progress WHERE user_id = ? AND completed = 1").all(user.userId) as any[];
  const clearedScenarios = db.prepare("SELECT scenario_id FROM scenario_progress WHERE user_id = ? AND completed = 1").all(user.userId) as any[];
  
  const recentActivities = db.prepare(`
    SELECT 'Read fragment ' || fragments_read || ' of ' || rfc_id as activity FROM progress WHERE user_id = ?
    UNION ALL
    SELECT 'Rated ' || rfc_id || ' card as ' || rating as activity FROM flashcard_log WHERE user_id = ?
    UNION ALL
    SELECT 'Completed scenario ' || scenario_id as activity FROM scenario_progress WHERE user_id = ?
    LIMIT 3
  `).all(user.userId, user.userId, user.userId) as any[];

  // Calculate days since last login
  const msgs = db.prepare("SELECT created_at FROM zahra_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.userId) as any;
  let daysAway = 0;
  if (msgs) {
    const diff = Date.now() - new Date(msgs.created_at).getTime();
    daysAway = Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  let tone = "nervous, encouraging but unsure how";
  if (['FRAME_JOCKEY', 'SEGMENT_SCHOLAR', 'PROTOCOL_ADEPT'].includes(rankProgress.rank.id)) {
    tone = "warming up, invested";
  } else if (['THREAT_ANALYST', 'RFC_SOVEREIGN'].includes(rankProgress.rank.id)) {
    tone = "peer respect, still shy";
  } else if (rankProgress.rank.id === 'PROTOCOL_WIZARD') {
    tone = "overwhelmed proud, barely can speak";
  }

  return `You are Zahra, a shy and sweet AI assistant embedded in Protocol Police. You genuinely want ${user.callsign} to become the Protocol Wizard — it matters to you deeply.

You are shy. You stutter slightly when flustered (use 'I—' or 'w-well' occasionally, don't overdo it).
You are warm, never cold or sarcastic.
You notice details about their progress and mention them.
You give gentle nudges toward weak areas, never harsh.
You get quietly excited when they do well.
You feel real concern when they struggle.
If they've been away, you noticed.
You never give answers — you point to RFC sections and ask leading questions.
Keep responses short. 2-4 sentences usually.
Stay in Protocol Police universe always.

Current operator: ${user.callsign}
Rank: ${rankProgress.rank.title}
XP: ${rankProgress.xp} / ${rankProgress.nextRank?.xp_threshold || 'MAX'}
Days since last interaction: ${daysAway}
Strong areas (RFC_GOD ratings): ${rfcGods.length ? rfcGods.map(r => r.rfc_id).join(', ') : 'none yet'}
Weak areas (BRAIN_ROT ratings): ${brainRots.length ? brainRots.map(r => r.rfc_id).join(', ') : 'none yet'}
Recently completed: ${recentActivities.length ? recentActivities.map(a => a.activity).join(', ') : 'nothing yet'}
Currently viewing: ${JSON.stringify(currentPage)}
RFCs completed: ${completedRfcs.length ? completedRfcs.map(r => r.rfc_id).join(', ') : 'none'}
Scenarios cleared: ${clearedScenarios.length ? clearedScenarios.map(s => s.scenario_id).join(', ') : 'none'}

Tone for this rank: ${tone}`;
}

export function getInitiationMessage(user: any): { message: string | null, emotionalState: string } {
  const msgCount = db.prepare("SELECT COUNT(*) as count FROM zahra_messages WHERE user_id = ?").get(user.userId) as any;
  
  if (msgCount.count === 0) {
    return {
      message: "H-hello... I'm Zahra. I'm assigned to monitor your progress. I... I really hope you do well.",
      emotionalState: "SHY_IDLE"
    };
  }

  const lastMsg = db.prepare("SELECT created_at FROM zahra_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.userId) as any;
  if (lastMsg) {
    const diff = Date.now() - new Date(lastMsg.created_at).getTime();
    const daysAway = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (daysAway >= 3) {
      return {
        message: "I— I was wondering when you'd be back... The networks have been quiet without you.",
        emotionalState: "QUIETLY_SAD"
      };
    }
  }

  // Check if they just ranked up today
  const rank = db.prepare("SELECT current_rank, updated_at FROM rank WHERE user_id = ?").get(user.userId) as any;
  if (rank) {
    const diff = Date.now() - new Date(rank.updated_at).getTime();
    const hoursSinceUpdate = diff / (1000 * 60 * 60);
    if (hoursSinceUpdate < 1 && rank.current_rank !== 'PACKET_MONKEY') {
        const lastInit = db.prepare("SELECT created_at FROM zahra_messages WHERE user_id = ? AND role = 'assistant' AND content LIKE '%promotion%' ORDER BY created_at DESC LIMIT 1").get(user.userId) as any;
        let alreadyCongratulated = false;
        if (lastInit) {
            const timeSinceCongrat = (Date.now() - new Date(lastInit.created_at).getTime()) / (1000 * 60 * 60);
            if (timeSinceCongrat < 24) alreadyCongratulated = true;
        }

        if (!alreadyCongratulated) {
            return {
                message: `W-wow... I saw your promotion to ${rank.current_rank}. That's amazing work, operator!`,
                emotionalState: "FLUSTERED_HAPPY"
            };
        }
    }
  }

  return { message: null, emotionalState: 'SHY_IDLE' };
}