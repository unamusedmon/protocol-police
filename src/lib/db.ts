import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'protocol-police.db');
export const db = new Database(dbPath);

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
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS progress (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    rfc_id TEXT NOT NULL,
    fragments_read INTEGER DEFAULT 0,
    total_fragments INTEGER DEFAULT 0,
    completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS flashcard_log (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    card_id TEXT NOT NULL,
    rfc_id TEXT NOT NULL,
    rating TEXT NOT NULL,
    rated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    next_review TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scenario_progress (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    scenario_id TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    completed_at TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS rank (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    current_rank TEXT DEFAULT 'PACKET_MONKEY',
    xp INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS unlocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Safe migration helper
function ensureColumn(table: string, column: string, type: string) {
  const info = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!info.find(c => c.name === column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
  }
}

try {
  ensureColumn('progress', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('flashcard_log', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('scenario_progress', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('rank', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
  ensureColumn('unlocks', 'user_id', 'INTEGER NOT NULL DEFAULT 1');
} catch (e) {
  console.error('Migration error:', e);
}