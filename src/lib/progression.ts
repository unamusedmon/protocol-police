import { db, queries, type RankRow, type ProgressRow, type ScenarioProgressRow, type FlashcardLogRow, type UnlockRow } from './db';
import { RANKS, type Rank } from './ranks';

/**
 * XP gain constants for different actions
 */
export const XP_GAIN = {
  RFC_GOD: 20,
  ACCEPTABLE: 10,
  SKILL_ISSUE: 5,
  BRAIN_ROT: 1,
  FRAGMENT: 10,
  SCENARIO: 1 // Will be multiplied by score
} as const;

/**
 * Batch-fetch all requirement data for a user in a single query.
 * This solves the N+1 query problem.
 */
function fetchAllRequirements(userId: number): {
  rfcProgress: Map<string, boolean>;
  scenarioProgress: Map<string, boolean>;
  flashcardRatings: Map<string, string>;
} {
  const rfcProgress = new Map<string, boolean>();
  const scenarioProgress = new Map<string, boolean>();
  const flashcardRatings = new Map<string, string>();

  // Fetch all RFC progress in one query
  const rfcRows = db.prepare(`
    SELECT rfc_id, completed FROM progress WHERE user_id = ?
  `).all(userId) as { rfc_id: string; completed: number }[];
  
  for (const row of rfcRows) {
    rfcProgress.set(row.rfc_id, Boolean(row.completed));
  }

  // Fetch all scenario progress in one query
  const scenarioRows = db.prepare(`
    SELECT scenario_id, completed FROM scenario_progress WHERE user_id = ?
  `).all(userId) as { scenario_id: string; completed: number }[];
  
  for (const row of scenarioRows) {
    scenarioProgress.set(row.scenario_id, Boolean(row.completed));
  }

  // Fetch latest rating for each flashcard in one query
  const ratingRows = db.prepare(`
    SELECT card_id, rating, rfc_id
    FROM flashcard_log
    WHERE user_id = ? AND id IN (
      SELECT MAX(id) FROM flashcard_log WHERE user_id = ? GROUP BY card_id
    )
  `).all(userId, userId) as { card_id: string; rating: string; rfc_id: string }[];
  
  for (const row of ratingRows) {
    flashcardRatings.set(row.card_id, row.rating);
  }

  return { rfcProgress, scenarioProgress, flashcardRatings };
}

/**
 * Checks if a user has met the requirements for higher ranks and updates them if so.
 * Also processes any item unlocks associated with the new rank.
 * 
 * Uses batched queries to avoid N+1 problem.
 * 
 * @param userId The ID of the user to check
 * @returns The ID of the user's current (potentially updated) rank
 */
export function checkAndUpdateRank(userId: number): string {
  const currentRankRow = queries.getRank.get(userId) as RankRow | undefined;
  if (!currentRankRow) {
    db.prepare('INSERT INTO rank (user_id, current_rank, xp) VALUES (?, ?, ?)').run(userId, 'PACKET_MONKEY', 0);
    return 'PACKET_MONKEY';
  }
  
  const currentRankId = currentRankRow.current_rank;
  let currentRankIndex = RANKS.findIndex(r => r.id === currentRankId);
  if (currentRankIndex === -1) currentRankIndex = 0;

  // Fetch all requirement data in batch (solves N+1 problem)
  const { rfcProgress, scenarioProgress, flashcardRatings } = fetchAllRequirements(userId);

  let newRankIndex = currentRankIndex;
  
  for (let i = currentRankIndex + 1; i < RANKS.length; i++) {
    const rank = RANKS[i];
    let meetsRequirements = true;

    for (const req of rank.requirements) {
      if (req.type === 'rfc' && req.id) {
        if (!rfcProgress.get(req.id)) {
          meetsRequirements = false;
          break;
        }
      } else if (req.type === 'scenario' && req.id) {
        if (!scenarioProgress.get(req.id)) {
          meetsRequirements = false;
          break;
        }
      } else if (req.type === 'flashcards' && req.condition === 'all_acceptable_or_god') {
        if (flashcardRatings.size === 0) {
          meetsRequirements = false;
          break;
        }
        
        // Check all flashcards have acceptable or god rating
        for (const rating of flashcardRatings.values()) {
          if (rating !== 'ACCEPTABLE' && rating !== 'RFC_GOD') {
            meetsRequirements = false;
            break;
          }
        }
        
        if (!meetsRequirements) break;
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
    
    // Use transaction for atomic update
    const updateRank = db.transaction(() => {
      db.prepare('UPDATE rank SET current_rank = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?')
        .run(newRank.id, userId);
      
      // Batch insert unlocks
      if (newRank.unlocks.length > 0) {
        const insertUnlock = db.prepare(`
          INSERT OR IGNORE INTO unlocks (user_id, item_id, item_type)
          VALUES (?, ?, ?)
        `);
        for (const unlock of newRank.unlocks) {
          insertUnlock.run(userId, unlock.id, unlock.type);
        }
      }
    });
    
    updateRank();
    return newRank.id;
  }

  return currentRankId;
}

export interface RankProgress {
  rank: Rank;
  xp: number;
  nextRank: Rank | null;
  percentage: number;
}

/**
 * Retrieves the current rank and XP progress for a user.
 * 
 * @param userId The ID of the user
 * @returns An object containing rank details, current XP, next rank, and progress percentage
 */
export function getRankProgress(userId: number): RankProgress {
  let currentRankRow = queries.getRank.get(userId) as RankRow | undefined;
  if (!currentRankRow) {
    db.prepare('INSERT INTO rank (user_id, current_rank, xp) VALUES (?, ?, ?)').run(userId, 'PACKET_MONKEY', 0);
    currentRankRow = { id: 0, user_id: userId, current_rank: 'PACKET_MONKEY', xp: 0, updated_at: new Date().toISOString() };
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

/**
 * Records that a user has read an RFC fragment and adds XP.
 * Triggers a rank check upon completion.
 * 
 * @param userId The ID of the user
 * @param rfcId The ID of the RFC (e.g., 'rfc791')
 * @param fragmentIndex The index of the fragment read
 * @param totalFragments Total number of fragments in the RFC
 * @returns The user's rank ID after potentially ranking up
 */
export function recordFragmentRead(userId: number, rfcId: string, fragmentIndex: number, totalFragments: number): string {
  const existing = db.prepare('SELECT * FROM progress WHERE user_id = ? AND rfc_id = ?').get(userId, rfcId) as ProgressRow | undefined;
  
  let fragmentsRead = 1;
  let isCompleted = false;
  
  if (existing) {
    fragmentsRead = existing.fragments_read + 1;
    if (fragmentsRead > totalFragments) {
        fragmentsRead = totalFragments;
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

export function recordFlashcardRating(userId: number, cardId: string, rfcId: string, rating: string): string {
  // Validate rating
  const validRatings = ['RFC_GOD', 'ACCEPTABLE', 'SKILL_ISSUE', 'BRAIN_ROT'];
  if (!validRatings.includes(rating)) {
    throw new Error(`Invalid rating: ${rating}`);
  }
  
  const xpGain = XP_GAIN[rating as keyof typeof XP_GAIN];
  
  db.prepare(`
    INSERT INTO flashcard_log (user_id, card_id, rfc_id, rating)
    VALUES (?, ?, ?, ?)
  `).run(userId, cardId, rfcId, rating);
  
  // Add XP based on rating
  if (xpGain > 0) {
    db.prepare('UPDATE rank SET xp = xp + ? WHERE user_id = ?').run(xpGain, userId);
  }

  return checkAndUpdateRank(userId);
}

export function recordScenarioComplete(userId: number, scenarioId: string, score: number): string {
  const existing = queries.getScenarioProgress.get(userId, scenarioId) as ScenarioProgressRow | undefined;
  
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

export function getUnlocks(userId: number): UnlockRow[] {
  return queries.getUnlocks.all(userId) as UnlockRow[];
}
