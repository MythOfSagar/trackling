import type { SQLiteDatabase } from "expo-sqlite";
import type { Category, CreateEntryInput, CreateEventInput, EventItem } from "@/types/models";

type EventRow = {
  id: number; name: string; icon: string; color: string; categoryId: number;
  categoryName: string; description: string | null; createdAt: string; updatedAt: string;
  lastOccurredAt: string | null; entryCount: number; reminderEnabled: number;
};

export async function getCategories(db: SQLiteDatabase) {
  return db.getAllAsync<Category>("SELECT id, name, icon, color FROM categories ORDER BY id");
}

export async function getEvents(db: SQLiteDatabase): Promise<EventItem[]> {
  const rows = await db.getAllAsync<EventRow>(`
    SELECT e.id, e.name, e.icon, e.color, e.category_id AS categoryId,
      c.name AS categoryName, e.description, e.created_at AS createdAt,
      e.updated_at AS updatedAt, MAX(en.occurred_at) AS lastOccurredAt,
      COUNT(en.id) AS entryCount, e.reminder_enabled AS reminderEnabled
    FROM events e JOIN categories c ON c.id = e.category_id
    LEFT JOIN entries en ON en.event_id = e.id
    GROUP BY e.id ORDER BY COALESCE(MAX(en.occurred_at), e.created_at) DESC
  `);
  return rows.map((row) => ({ ...row, reminderEnabled: row.reminderEnabled === 1 }));
}

export async function createEvent(db: SQLiteDatabase, input: CreateEventInput) {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    "INSERT INTO events (name, icon, color, category_id, description, created_at, updated_at, reminder_enabled, reminder_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    input.name.trim(), input.icon, input.color, input.categoryId, input.description?.trim() || null, now, now, input.reminderInterval ? 1 : 0, input.reminderInterval ? JSON.stringify({ interval: input.reminderInterval, unit: input.reminderUnit ?? "day" }) : null,
  );
  return result.lastInsertRowId;
}

export async function updateEvent(db: SQLiteDatabase, eventId: number, input: CreateEventInput & { reminderEnabled: boolean }) {
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE events SET name = ?, icon = ?, color = ?, category_id = ?, description = ?, updated_at = ?, reminder_enabled = ?, reminder_config = ? WHERE id = ?",
    input.name.trim(), input.icon, input.color, input.categoryId, input.description?.trim() || null, now, input.reminderEnabled ? 1 : 0,
    input.reminderEnabled ? JSON.stringify({ interval: input.reminderInterval ?? 3, unit: input.reminderUnit ?? "day" }) : null, eventId,
  );
}

export async function createEntry(db: SQLiteDatabase, input: CreateEntryInput) {
  const now = new Date().toISOString();
  await db.runAsync(
    "INSERT INTO entries (event_id, occurred_at, note, numeric_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
    input.eventId, input.occurredAt, input.note?.trim() || null, input.numericValue ?? null, now, now,
  );
  await db.runAsync("UPDATE events SET updated_at = ? WHERE id = ?", now, input.eventId);
}

export async function deleteEntry(db: SQLiteDatabase, entryId: number) {
  await db.runAsync("DELETE FROM entries WHERE id = ?", entryId);
}

export async function updateEntry(db: SQLiteDatabase, entryId: number, input: CreateEntryInput) {
  const now = new Date().toISOString();
  await db.runAsync("UPDATE entries SET occurred_at = ?, note = ?, numeric_value = ?, updated_at = ? WHERE id = ? AND event_id = ?", input.occurredAt, input.note?.trim() || null, input.numericValue ?? null, now, entryId, input.eventId);
  await db.runAsync("UPDATE events SET updated_at = ? WHERE id = ?", now, input.eventId);
}
