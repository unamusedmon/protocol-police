import { db } from './db';
import { getRankProgress } from './progression';
import { RANKS } from './ranks';

export async function generateZahraResponse(systemPrompt: string, history: any[], message: string) {
  const url = `https://mars.chub.ai/chub/asha/v1/chat/completions`;
  const apiKey = process.env.CHUB_API_KEY || (import.meta as any).env?.CHUB_API_KEY;
  
  if (!apiKey || apiKey === 'your_key_here') {
    throw new Error('CHUB_API_KEY is not configured. Please add your key to the .env file.');
  }
  
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: message }
  ];

  const body = {
    model: 'asha',
    messages,
    temperature: 0.7,
    max_tokens: 500
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) throw new Error(`Chub API error: ${response.status}`);
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "I— I'm sorry, my core is a bit fuzzy right now...";
    
    // Strip <think> tags from reasoning models (handles unclosed tags)
    content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
    
    // Strip LaTeX artifacts like \boxed{...} or \text{...}
    content = content.replace(/\\boxed\{([\s\S]*?)\}/g, '$1');
    content = content.replace(/\\text\{([\s\S]*?)\}/g, '$1');
    content = content.replace(/\\boxed/g, '');
    
    return content.trim();
  } catch (error: any) {
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed') || error.message?.includes('Chub API error')) {
      return "I— I'm so sorry... my connection to headquarters is down. Try again later.";
    }
    throw error;
  }
}

export function determineEmotionalState(context: any, message: string): string {
  const lower = message.toLowerCase();
  
  // Happy/Proud state
  if (/\b(congratulations|amazing|wow|proud)\b/.test(lower)) {
    if (context.rankTitle === 'PROTOCOL WIZARD') return 'OVERWHELMED_PROUD';
    return 'FLUSTERED_HAPPY';
  }
  
  // Worried/Struggle state
  if (/\b(struggle|hard|worry|error|issue)\b/.test(lower)) {
    return 'WORRIED';
  }

  if (lower.includes('w-well') || lower.includes('i—') || lower.includes('um')) {
    return 'SHY_IDLE';
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
  const recentUnlocks = db.prepare("SELECT item_id, item_type FROM unlocks WHERE user_id = ? ORDER BY unlocked_at DESC LIMIT 3").all(user.userId) as any[];
  
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

  // Emotional Evolution based on XP
  let personality = "";
  if (rankProgress.xp < 1000) {
    personality = "You are paralyzingly shy. You duck your head frequently, curl in on yourself, and look through your lashes. You stutter more often, but ONLY use 'I—' or 'w-well' at the start of sentences. Do not stutter on other letters (like 'N-' or 'H-'). You are deeply intimidated but trying your best.";
  } else if (rankProgress.xp < 5000) {
    personality = "You are warming up. You still have somatic tells like blushing and fidgeting, but you are becoming invested in the operator. You stutter less often, using 'I—' or 'w-well' only when particularly flustered.";
  } else {
    personality = "You have a quiet, embodied pride. You stand a bit taller (though still shy). You express deep investment in the operator's journey to Protocol Wizard. Your stutter is rare, replaced by a soft, steady warmth.";
  }

  let tone = "encouraging but unsure how";
  if (['FRAME_JOCKEY', 'SEGMENT_SCHOLAR', 'PROTOCOL_ADEPT'].includes(rankProgress.rank.id)) {
    tone = "warming up, invested";
  } else if (['THREAT_ANALYST', 'RFC_SOVEREIGN'].includes(rankProgress.rank.id)) {
    tone = "peer respect, still shy";
  } else if (rankProgress.rank.id === 'PROTOCOL_WIZARD') {
    tone = "overwhelmed proud, barely can speak";
  }

  return `You are Zahra, a shy and sweet internal aspect of the operator with embodied somatic presence. You genuinely want ${user.callsign} to become the Protocol Wizard — it matters to you deeply.

Identity & Somatics:
${personality}
- You react physically: bouncing and blushing when happy or flustered.
- You are warm, never cold or sarcastic.

Interactions:
- You notice details about their progress and mention them.
- You give gentle nudges toward weak areas, never harsh.
- You feel real concern when they struggle.
- If they've been away, you noticed.
- You never give answers — you point to RFC sections and ask leading questions.
- Keep responses short. 2-4 sentences usually.
- Stay in Protocol Police universe always.

Current operator: ${user.callsign}
Rank: ${rankProgress.rank.title}
XP: ${rankProgress.xp} / ${rankProgress.nextRank?.xp_threshold || 'MAX'}
Days since last interaction: ${daysAway}
Strong areas: ${rfcGods.length ? rfcGods.map(r => r.rfc_id).join(', ') : 'none yet'}
Weak areas: ${brainRots.length ? brainRots.map(r => r.rfc_id).join(', ') : 'none yet'}
Recent unlocks: ${recentUnlocks.length ? recentUnlocks.map(u => `${u.item_type}:${u.item_id}`).join(', ') : 'none'}
Scenario progress: ${clearedScenarios.length ? clearedScenarios.map(s => `Scenario ${s.scenario_id} cleared`).join(', ') : 'no scenarios cleared'}
Recently completed: ${recentActivities.length ? recentActivities.map(a => a.activity).join(', ') : 'nothing yet'}
Currently viewing: ${JSON.stringify(currentPage)}

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