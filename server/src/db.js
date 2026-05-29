const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'game.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL DEFAULT '',
    email TEXT,
    full_name TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS games (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    digits INTEGER NOT NULL,
    allow_repeat INTEGER DEFAULT 0,
    allow_zero INTEGER DEFAULT 0,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    room_code TEXT UNIQUE,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id TEXT REFERENCES games(id),
    user_id INTEGER REFERENCES users(id),
    secret_number TEXT,
    attempts INTEGER DEFAULT 0,
    won INTEGER DEFAULT 0,
    completed_at INTEGER,
    time_taken INTEGER
  );

  CREATE TABLE IF NOT EXISTS guesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_player_id INTEGER REFERENCES game_players(id),
    guess TEXT NOT NULL,
    cows INTEGER NOT NULL,
    bulls INTEGER NOT NULL,
    attempt_number INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_game_players_game ON game_players(game_id);
  CREATE INDEX IF NOT EXISTS idx_guesses_player ON guesses(game_player_id);
  CREATE INDEX IF NOT EXISTS idx_games_room ON games(room_code);
`);

// Safe migrations for existing databases (ALTER TABLE ADD COLUMN fails silently if already present)
try { db.exec('ALTER TABLE users ADD COLUMN email TEXT'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN full_name TEXT'); } catch {}
// Unique index on email, ignoring NULLs (guests have no email)
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL');

module.exports = db;
