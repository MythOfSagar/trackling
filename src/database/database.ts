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
  const entryColumns = await db.getAllAsync<{ name: string }>("PRAGMA table_info(entries)");
  if (!entryColumns.some((column) => column.name === "title")) await db.execAsync("ALTER TABLE entries ADD COLUMN title TEXT");
  await db.runAsync("UPDATE entries SET title = 'Recorded moment' WHERE title IS NULL OR title = ''");

}
