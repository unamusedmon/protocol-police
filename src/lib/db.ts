import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'protocol-police.db');
export const db = new Database(dbPath);

// Define Types for Database Rows
export interface UserRow {
  id: number;
  callsign: string;
  password_hash: string;
  created_at: string;
  last_active: string;
  settings: string;
}

export interface ProgressRow {
  id: number;
  user_id: number;
  rfc_id: string;
  fragments_read: number;
  total_fragments: number;
  completed: number;
  completed_at: string | null;
}

export interface FlashcardLogRow {
  id: number;
  user_id: number;
  card_id: string;
  rfc_id: string;
  rating: string;
  rated_at: string;
  next_review: string | null;
}

export interface ScenarioProgressRow {
  id: number;
  user_id: number;
  scenario_id: string;
  completed: number;
  score: number;
  completed_at: string;
}

export interface RankRow {
  id: number;
  user_id: number;
  current_rank: string;
  xp: number;
  updated_at: string;
}

export interface UnlockRow {
  id: number;
  user_id: number;
  item_id: string;
  item_type: string;
  unlocked_at: string;
}

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    callsign TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    settings TEXT DEFAULT '{}'
  );

  CREATE TABLE IF NOT EXISTS zahra_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    role TEXT NOT NULL,
    content TEXT NOT NULL,
    emotional_state TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    rfc_id TEXT NOT NULL,
    fragments_read INTEGER DEFAULT 0,
    total_fragments INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, rfc_id)
  );

  CREATE TABLE IF NOT EXISTS flashcard_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    rfc_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_review TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS scenario_progress (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    scenario_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    completed_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, scenario_id)
  );

  CREATE TABLE IF NOT EXISTS rank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    current_rank TEXT DEFAULT 'PACKET_MONKEY',
    xp INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, item_type, item_id)
  );

  CREATE TABLE IF NOT EXISTS invalidated_sessions (
    token_hash TEXT PRIMARY KEY,
    invalidated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS csrf_tokens (
    token TEXT PRIMARY KEY,
    user_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
`);

// Create indexes for performance
// Note: SQLite doesn't support IF NOT EXISTS for indexes, so we check first
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_users_callsign ON users(callsign);
  CREATE INDEX IF NOT EXISTS idx_zahra_messages_user_id ON zahra_messages(user_id);
  CREATE INDEX IF NOT EXISTS idx_progress_user_id ON progress(user_id);
  CREATE INDEX IF NOT EXISTS idx_progress_user_rfc ON progress(user_id, rfc_id);
  CREATE INDEX IF NOT EXISTS idx_flashcard_log_user_id ON flashcard_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_flashcard_log_user_rfc ON flashcard_log(user_id, rfc_id);
  CREATE INDEX IF NOT EXISTS idx_flashcard_log_user_card ON flashcard_log(user_id, card_id);
  CREATE INDEX IF NOT EXISTS idx_scenario_progress_user_id ON scenario_progress(user_id);
  CREATE INDEX IF NOT EXISTS idx_rank_user_id ON rank(user_id);
  CREATE INDEX IF NOT EXISTS idx_unlocks_user_id ON unlocks(user_id);
  CREATE INDEX IF NOT EXISTS idx_invalidated_sessions_hash ON invalidated_sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_csrf_tokens_token ON csrf_tokens(token);
`);

// Safe migration helper
function ensureColumn(table: string, column: string, type: string) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!info.find(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}

// NOTE: The DEFAULT 1 on user_id columns is a legacy issue that causes data mixing.
// For new deployments, these columns should NOT have a default value.
// Existing deployments should update their schema manually.
try {
  ensureColumn('progress', 'user_id', 'INTEGER NOT NULL');
  ensureColumn('flashcard_log', 'user_id', 'INTEGER NOT NULL');
  ensureColumn('scenario_progress', 'user_id', 'INTEGER NOT NULL');
  ensureColumn('rank', 'user_id', 'INTEGER NOT NULL');
  ensureColumn('unlocks', 'user_id', 'INTEGER NOT NULL');
} catch (e) {
  console.error('Migration error:', e);
}

// Typed query helpers
export const queries = {
  getUser: db.prepare('SELECT * FROM users WHERE id = ?'),
  getUserByCallsign: db.prepare('SELECT * FROM users WHERE callsign = ?'),
  getRank: db.prepare('SELECT * FROM rank WHERE user_id = ?'),
  getProgress: db.prepare('SELECT * FROM progress WHERE user_id = ?'),
  getScenarioProgress: db.prepare('SELECT * FROM scenario_progress WHERE user_id = ?'),
  getUnlocks: db.prepare('SELECT item_id, item_type, unlocked_at FROM unlocks WHERE user_id = ?'),
  getFlashcardStats: db.prepare(`
    SELECT 
      rfc_id, 
      COUNT(DISTINCT card_id) as cards_reviewed,
      MAX(rated_at) as last_review,
      (
        SELECT rating 
        FROM flashcard_log f2 
        WHERE f2.rfc_id = f1.rfc_id AND f2.user_id = ?
        ORDER BY rated_at DESC 
        LIMIT 1
      ) as last_rating
    FROM flashcard_log f1
    WHERE user_id = ?
    GROUP BY rfc_id
  `)
};
