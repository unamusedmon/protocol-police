import { db, queries, type FlashcardLogRow, type ProgressRow, type ScenarioProgressRow, type UnlockRow } from './db';
import { getRankProgress } from './progression';
import { RANKS } from './ranks';
import { sanitizeText } from './sanitize';

export async function generateZahraResponse(systemPrompt: string, history: { role: string, content: string }[], message: string): Promise<string> {
  const url = `https://mars.chub.ai/chub/asha/v1/chat/completions`;
  const apiKey = process.env.CHUB_API_KEY || (import.meta as any).env?.CHUB_API_KEY;
  
  // SECURITY: Check API key without leaking info in error
  if (!apiKey || apiKey.length < 20) {
    throw new Error('AI service is not properly configured.');
  }
  
  // SECURITY: Check for insecure patterns
  const insecurePatterns = ['your_', 'chub-', 'chk-', '12345', 'password'];
  if (insecurePatterns.some(pattern => apiKey.toLowerCase().includes(pattern))) {
    throw new Error('AI service configuration error. Please generate a new API key.');
  }
  
  // SECURITY: Sanitize all inputs to prevent prompt injection
  const sanitizedMessage = sanitizeText(message);
  const sanitizedHistory = history.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: sanitizeText(m.content)
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...sanitizedHistory,
    { role: 'user', content: sanitizedMessage }
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

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Chub API error: ${response.status} - ${errorText.substring(0, 100)}`);
    }
    
    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || "I— I'm sorry, my core is a bit fuzzy right now...";
    
    // Strip <think> tags from reasoning models (handles unclosed tags)
    content = content.replace(/<think>[\s\S]*?(?:<\/think>|$)/g, '').trim();
    
    // SECURITY: Full sanitization of AI response before storage/display
    // Remove all HTML tags and script content
    content = sanitizeText(content);
    
    // Strip LaTeX artifacts like \boxed{...} or \text{...}
    content = content.replace(/\\boxed\{([\s\S]*?)\}/g, '$1');
    content = content.replace(/\\text\{([\s\S]*?)\}/g, '$1');
    content = content.replace(/\\boxed/g, '');
    
    return content.trim();
  } catch (error: any) {
    // SECURITY: Don't leak internal error details to client
    if (error.cause?.code === 'ECONNREFUSED' || error.message?.includes('fetch failed') || error.message?.includes('Chub API error')) {
      return "I— I'm so sorry... my connection to headquarters is down. Try again later.";
    }
    // Generic error for all other cases
    console.error('Zahra generation error:', error.message);
    return "I— I'm so sorry... something went wrong with my core systems.";
  }
}

export function determineEmotionalState(context: { rankTitle: string }, message: string): string {
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

export function buildSystemPrompt(user: { userId: number, callsign: string }, currentPage: any): string {
  const rankProgress = getRankProgress(user.userId);
  
  // Consolidate stats collection
  const stats = db.prepare(`
    SELECT 
      (SELECT COUNT(DISTINCT rfc_id) FROM flashcard_log WHERE user_id = ? AND rating = 'RFC_GOD') as god_count,
      (SELECT COUNT(DISTINCT rfc_id) FROM flashcard_log WHERE user_id = ? AND rating = 'BRAIN_ROT') as rot_count,
      (SELECT COUNT(*) FROM progress WHERE user_id = ? AND completed = 1) as completed_rfcs,
      (SELECT COUNT(*) FROM scenario_progress WHERE user_id = ? AND completed = 1) as cleared_scenarios
  `).get(user.userId, user.userId, user.userId, user.userId) as { god_count: number, rot_count: number, completed_rfcs: number, cleared_scenarios: number };
  
  const recentUnlocks = queries.getUnlocks.all(user.userId) as UnlockRow[];
  
  const recentActivities = db.prepare(`
    SELECT 'Read fragment ' || fragments_read || ' of ' || rfc_id as activity FROM progress WHERE user_id = ?
    UNION ALL
    SELECT 'Rated ' || rfc_id || ' card as ' || rating as activity FROM flashcard_log WHERE user_id = ?
    UNION ALL
    SELECT 'Completed scenario ' || scenario_id as activity FROM scenario_progress WHERE user_id = ?
    ORDER BY activity DESC
    LIMIT 3
  `).all(user.userId, user.userId, user.userId) as { activity: string }[];

  // Calculate days since last login
  const msgs = db.prepare("SELECT created_at FROM zahra_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.userId) as { created_at: string } | undefined;
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
Strong areas: ${stats.god_count ? `${stats.god_count} RFCs mastered` : 'none yet'}
Weak areas: ${stats.rot_count ? `${stats.rot_count} RFCs needing attention` : 'none yet'}
Recent unlocks: ${recentUnlocks.length ? recentUnlocks.slice(0, 3).map(u => `${u.item_type}:${u.item_id}`).join(', ') : 'none'}
Scenario progress: ${stats.cleared_scenarios ? `${stats.cleared_scenarios} scenarios cleared` : 'no scenarios cleared'}
Recently completed: ${recentActivities.length ? recentActivities.map(a => a.activity).join(', ') : 'nothing yet'}
Currently viewing: ${JSON.stringify(currentPage)}

Tone for this rank: ${tone}`;
}

export function getInitiationMessage(user: { userId: number, callsign: string }): { message: string | null, emotionalState: string } {
  const msgCount = db.prepare("SELECT COUNT(*) as count FROM zahra_messages WHERE user_id = ?").get(user.userId) as { count: number };
  
  if (msgCount.count === 0) {
    return {
      message: "H-hello... I'm Zahra. I'm assigned to monitor your progress. I... I really hope you do well.",
      emotionalState: "SHY_IDLE"
    };
  }

  const lastMsg = db.prepare("SELECT created_at FROM zahra_messages WHERE user_id = ? ORDER BY created_at DESC LIMIT 1").get(user.userId) as { created_at: string } | undefined;
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
  const rank = queries.getRank.get(user.userId) as RankRow | undefined;
  if (rank) {
    const diff = Date.now() - new Date(rank.updated_at).getTime();
    const hoursSinceUpdate = diff / (1000 * 60 * 60);
    if (hoursSinceUpdate < 1 && rank.current_rank !== 'PACKET_MONKEY') {
        const lastInit = db.prepare("SELECT created_at FROM zahra_messages WHERE user_id = ? AND role = 'assistant' AND content LIKE '%promotion%' ORDER BY created_at DESC LIMIT 1").get(user.userId) as { created_at: string } | undefined;
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
