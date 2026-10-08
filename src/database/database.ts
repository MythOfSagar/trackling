import type { SQLiteDatabase } from "expo-sqlite";

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      category_id INTEGER NOT NULL REFERENCES categories(id),
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reminder_enabled INTEGER NOT NULL DEFAULT 0,
      reminder_config TEXT
    );
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      occurred_at TEXT NOT NULL,
      note TEXT,
      photo_uri TEXT,
      numeric_value REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_entries_event_id ON entries(event_id);
    CREATE INDEX IF NOT EXISTS idx_entries_occurred_at ON entries(occurred_at DESC);
    CREATE INDEX IF NOT EXISTS idx_events_category_id ON events(category_id);
  `);

  const count = await db.getFirstAsync<{ count: number }>("SELECT COUNT(*) AS count FROM categories");
  if (count?.count === 0) {
    const now = new Date().toISOString();
    const defaults = [
      ["Health", "✳️", "#E9F1E9"], ["Fitness", "◉", "#E8EFF7"],
      ["Personal", "♡", "#F5EAF0"], ["Home", "⌂", "#F5EFE2"],
      ["Work", "▤", "#E9EBF4"], ["Finance", "◇", "#F3ECDD"], ["Other", "✦", "#ECEEE9"],
    ];
    for (const [name, icon, color] of defaults) {
      await db.runAsync("INSERT OR IGNORE INTO categories (name, icon, color, created_at) VALUES (?, ?, ?, ?)", name, icon, color, now);
    }
  }
}
