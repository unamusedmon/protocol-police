import { db } from './db';
import { RANKS } from './ranks';

export function checkAndUpdateRank(userId: number) {
  const currentRankRow = db.prepare('SELECT * FROM rank WHERE user_id = ?').get(userId) as any;
  if (!currentRankRow) {
    db.prepare('INSERT INTO rank (user_id, current_rank, xp) VALUES (?, ?, ?)').run(userId, 'PACKET_MONKEY', 0);
    return 'PACKET_MONKEY';
  }
  
  const currentRankId = currentRankRow.current_rank;
  let currentRankIndex = RANKS.findIndex(r => r.id === currentRankId);
  if (currentRankIndex === -1) currentRankIndex = 0;

  let newRankIndex = currentRankIndex;
  
  for (let i = currentRankIndex + 1; i < RANKS.length; i++) {
    const rank = RANKS[i];
    let meetsRequirements = true;

    for (const req of rank.requirements) {
      if (req.type === 'rfc') {
        const progress = db.prepare('SELECT completed FROM progress WHERE user_id = ? AND rfc_id = ?').get(userId, req.id) as any;
        if (!progress || !progress.completed) {
          meetsRequirements = false;
          break;
        }
      } else if (req.type === 'scenario') {
        const progress = db.prepare('SELECT completed FROM scenario_progress WHERE user_id = ? AND scenario_id = ?').get(userId, req.id) as any;
        if (!progress || !progress.completed) {
          meetsRequirements = false;
          break;
        }
      } else if (req.type === 'flashcards' && req.condition === 'all_acceptable_or_god') {
        const latestRatings = db.prepare(`
          SELECT card_id, rating
          FROM flashcard_log
          WHERE user_id = ? AND id IN (
            SELECT MAX(id)
            FROM flashcard_log
            WHERE user_id = ?
            GROUP BY card_id
          )
        `).all(userId, userId) as any[];

        if (latestRatings.length === 0) {
          meetsRequirements = false;
        } else {
          for (const lr of latestRatings) {
            if (lr.rating !== 'ACCEPTABLE' && lr.rating !== 'RFC_GOD') {
              meetsRequirements = false;
              break;
            }
          }
        }
      }
    }

    if (meetsRequirements) {
      newRankIndex = i;
    } else {
      break;
    }
  }

  if (newRankIndex > currentRankIndex) {
    const newRank = RANKS[newRankIndex];
    db.prepare('UPDATE rank SET current_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?').run(newRank.id, userId);
    
    // Process unlocks
    for (const unlock of newRank.unlocks) {
      db.prepare(`
        INSERT OR IGNORE INTO unlocks (user_id, item_id, item_type)
        VALUES (?, ?, ?)
      `).run(userId, unlock.id, unlock.type);
    }
    
    return newRank.id;
  }

  return currentRankId;
}

export function getRankProgress(userId: number) {
  let currentRankRow = db.prepare('SELECT * FROM rank WHERE user_id = ?').get(userId) as any;
  if (!currentRankRow) {
    db.prepare('INSERT INTO rank (user_id, current_rank, xp) VALUES (?, ?, ?)').run(userId, 'PACKET_MONKEY', 0);
    currentRankRow = { current_rank: 'PACKET_MONKEY', xp: 0 };
  }

  const currentRankId = currentRankRow.current_rank;
  const xp = currentRankRow.xp;
  
  const currentRankIndex = RANKS.findIndex(r => r.id === currentRankId);
  const currentRank = RANKS[currentRankIndex] || RANKS[0];
  
  const nextRank = currentRankIndex < RANKS.length - 1 ? RANKS[currentRankIndex + 1] : null;
  
  let percentage = 100;
  if (nextRank) {
    const range = nextRank.xp_threshold - currentRank.xp_threshold;
    const progress = xp - currentRank.xp_threshold;
    percentage = Math.max(0, Math.min(100, (progress / range) * 100));
  }
  
  return {
    rank: currentRank,
    xp,
    nextRank,
    percentage: Math.round(percentage)
  };
}

export function recordFragmentRead(userId: number, rfcId: string, fragmentIndex: number, totalFragments: number) {
  const existing = db.prepare('SELECT * FROM progress WHERE user_id = ? AND rfc_id = ?').get(userId, rfcId) as any;
  
  let fragmentsRead = 1;
  let isCompleted = false;
  
  if (existing) {
    fragmentsRead = existing.fragments_read + 1;
    if (fragmentsRead > existing.total_fragments) {
        fragmentsRead = existing.total_fragments;
    }
    isCompleted = fragmentsRead >= totalFragments;
    
    db.prepare(`
      UPDATE progress 
      SET fragments_read = ?, total_fragments = ?, completed = ?, completed_at = CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE completed_at END
      WHERE user_id = ? AND rfc_id = ?
    `).run(fragmentsRead, totalFragments, isCompleted ? 1 : 0, isCompleted ? 1 : 0, userId, rfcId);
  } else {
    isCompleted = 1 >= totalFragments;
    db.prepare(`
      INSERT INTO progress (user_id, rfc_id, fragments_read, total_fragments, completed, completed_at)
      VALUES (?, ?, ?, ?, ?, CASE WHEN ? THEN CURRENT_TIMESTAMP ELSE NULL END)
    `).run(userId, rfcId, 1, totalFragments, isCompleted ? 1 : 0, isCompleted ? 1 : 0);
  }

  // Add XP
  db.prepare('UPDATE rank SET xp = xp + 10 WHERE user_id = ?').run(userId);
  
  return checkAndUpdateRank(userId);
}

export function recordFlashcardRating(userId: number, cardId: string, rfcId: string, rating: string) {
  db.prepare(`
    INSERT INTO flashcard_log (user_id, card_id, rfc_id, rating)
    VALUES (?, ?, ?, ?)
  `).run(userId, cardId, rfcId, rating);
  
  // Add XP based on rating
  let xpGain = 0;
  if (rating === 'RFC_GOD') xpGain = 20;
  else if (rating === 'ACCEPTABLE') xpGain = 10;
  else if (rating === 'SKILL_ISSUE') xpGain = 5;
  else if (rating === 'BRAIN_ROT') xpGain = 1;
  
  if (xpGain > 0) {
    db.prepare('UPDATE rank SET xp = xp + ? WHERE user_id = ?').run(xpGain, userId);
  }

  return checkAndUpdateRank(userId);
}

export function recordScenarioComplete(userId: number, scenarioId: string, score: number) {
  const existing = db.prepare('SELECT * FROM scenario_progress WHERE user_id = ? AND scenario_id = ?').get(userId, scenarioId) as any;
  
  if (existing) {
    db.prepare(`
      UPDATE scenario_progress 
      SET completed = 1, score = MAX(score, ?), completed_at = CURRENT_TIMESTAMP
      WHERE user_id = ? AND scenario_id = ?
    `).run(score, userId, scenarioId);
  } else {
    db.prepare(`
      INSERT INTO scenario_progress (user_id, scenario_id, completed, score, completed_at)
      VALUES (?, ?, 1, ?, CURRENT_TIMESTAMP)
    `).run(userId, scenarioId, score);
  }
  
  // Add XP
  db.prepare('UPDATE rank SET xp = xp + ? WHERE user_id = ?').run(score, userId);

  return checkAndUpdateRank(userId);
}

export function getUnlocks(userId: number) {
  return db.prepare('SELECT item_id, item_type, unlocked_at FROM unlocks WHERE user_id = ?').all(userId);
}