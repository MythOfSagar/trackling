import * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import type { SQLiteDatabase } from "expo-sqlite";

type BackupCategory = { id: number; name: string; icon: string; color: string; created_at: string };
type BackupEvent = { id: number; name: string; icon: string; color: string; category_id: number; description: string | null; created_at: string; updated_at: string; reminder_enabled: number; reminder_config: string | null };
type BackupEntry = { id: number; event_id: number; occurred_at: string; note: string | null; photo_uri: string | null; numeric_value: number | null; created_at: string; updated_at: string };
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const validId = (value: unknown) => Number.isSafeInteger(value) && Number(value) > 0;
const validText = (value: unknown): value is string => typeof value === "string" && value.length > 0;
const validTimestamp = (value: unknown): value is string => validText(value) && Number.isFinite(Date.parse(value));

export async function exportBackup(db: SQLiteDatabase) {
  const [categories, events, entries] = await Promise.all([
    db.getAllAsync<BackupCategory>("SELECT * FROM categories ORDER BY id"),
    db.getAllAsync<BackupEvent>("SELECT * FROM events ORDER BY id"),
    db.getAllAsync<BackupEntry>("SELECT * FROM entries ORDER BY id"),
  ]);
  const backup = { version: 1, exportedAt: new Date().toISOString(), categories, events, entries };
  const file = new File(Paths.cache, `little-again-backup-${Date.now()}.json`);
  file.create();
  file.write(JSON.stringify(backup, null, 2));
  if (!(await Sharing.isAvailableAsync())) throw new Error("File sharing isn’t available on this device.");
  await Sharing.shareAsync(file.uri, { mimeType: "application/json", dialogTitle: "Export your moments" });
}

export async function importBackup(db: SQLiteDatabase) {
  const selection = await DocumentPicker.getDocumentAsync({ type: "application/json", copyToCacheDirectory: true, multiple: false });
  if (selection.canceled) return null;
  const file = new File(selection.assets[0].uri);
  let parsed: unknown;
  try { parsed = JSON.parse(await file.text()); } catch { throw new Error("That file isn’t valid JSON."); }
  if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.categories) || !Array.isArray(parsed.events) || !Array.isArray(parsed.entries)) {
    throw new Error("This file isn’t a supported Little Again backup.");
  }
  const categories = parsed.categories as unknown[];
  const events = parsed.events as unknown[];
  const entries = parsed.entries as unknown[];
  if (categories.length > 500 || events.length > 10_000 || entries.length > 100_000) throw new Error("This backup is larger than the supported import size.");
  const categoryIds = new Set<number>();
  const eventIds = new Set<number>();
  for (const item of categories) {
    if (!isRecord(item) || !validId(item.id) || !validText(item.name) || !validText(item.icon) || !validText(item.color) || !validTimestamp(item.created_at)) throw new Error("A category in this backup has invalid fields.");
    if (categoryIds.has(Number(item.id))) throw new Error("This backup contains duplicate category IDs.");
    categoryIds.add(Number(item.id));
  }
  for (const item of events) {
    if (!isRecord(item) || !validId(item.id) || !validText(item.name) || !validText(item.icon) || !validText(item.color) || !validId(item.category_id) || !validTimestamp(item.created_at) || !validTimestamp(item.updated_at) || !(item.description === null || typeof item.description === "string") || !(item.reminder_enabled === 0 || item.reminder_enabled === 1) || !(item.reminder_config === null || typeof item.reminder_config === "string")) throw new Error("An event in this backup has invalid fields.");
    if (eventIds.has(Number(item.id))) throw new Error("This backup contains duplicate event IDs.");
    if (!categoryIds.has(Number(item.category_id))) throw new Error("An event references a category that isn’t in this backup.");
    eventIds.add(Number(item.id));
  }
  for (const item of entries) {
    if (!isRecord(item) || !validId(item.id) || !validId(item.event_id) || !validTimestamp(item.occurred_at) || !validTimestamp(item.created_at) || !validTimestamp(item.updated_at) || !(item.note === null || typeof item.note === "string") || !(item.photo_uri === null || typeof item.photo_uri === "string") || !(item.numeric_value === null || typeof item.numeric_value === "number" && Number.isFinite(item.numeric_value))) throw new Error("An entry in this backup has invalid fields.");
    if (!eventIds.has(Number(item.event_id))) throw new Error("An entry references an event that isn’t in this backup.");
  }

  await db.withTransactionAsync(async () => {
    const categoryMap = new Map<number, number>();
    const eventMap = new Map<number, number>();
    for (const item of categories as BackupCategory[]) {
      const existing = await db.getFirstAsync<{ id: number }>("SELECT id FROM categories WHERE name = ? COLLATE NOCASE", item.name);
      if (existing) categoryMap.set(item.id, existing.id);
      else {
        const result = await db.runAsync("INSERT INTO categories (name, icon, color, created_at) VALUES (?, ?, ?, ?)", item.name, item.icon, item.color, item.created_at);
        categoryMap.set(item.id, result.lastInsertRowId);
      }
    }
    for (const item of events as BackupEvent[]) {
      const categoryId = categoryMap.get(item.category_id);
      if (!categoryId) throw new Error("A category could not be restored.");
      const existing = await db.getFirstAsync<{ id: number }>("SELECT id FROM events WHERE id = ? AND name = ?", item.id, item.name);
      if (existing) eventMap.set(item.id, existing.id);
      else {
        const result = await db.runAsync("INSERT INTO events (name, icon, color, category_id, description, created_at, updated_at, reminder_enabled, reminder_config) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", item.name, item.icon, item.color, categoryId, item.description, item.created_at, item.updated_at, item.reminder_enabled === 1 ? 1 : 0, item.reminder_config);
        eventMap.set(item.id, result.lastInsertRowId);
      }
    }
    for (const item of entries as BackupEntry[]) {
      const eventId = eventMap.get(item.event_id);
      if (!eventId) throw new Error("An event could not be restored.");
      const duplicate = await db.getFirstAsync<{ id: number }>("SELECT id FROM entries WHERE event_id = ? AND occurred_at = ? AND COALESCE(note, '') = COALESCE(?, '') AND COALESCE(numeric_value, -999999999) = COALESCE(?, -999999999) LIMIT 1", eventId, item.occurred_at, item.note, item.numeric_value);
      if (!duplicate) await db.runAsync("INSERT INTO entries (event_id, occurred_at, note, photo_uri, numeric_value, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", eventId, item.occurred_at, item.note, item.photo_uri, item.numeric_value, item.created_at, item.updated_at);
    }
  });
  return { categories: categories.length, events: events.length, entries: entries.length };
}
