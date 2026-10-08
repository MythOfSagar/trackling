import { create } from "zustand";
import type { SQLiteDatabase } from "expo-sqlite";
import type { EventItem } from "@/types/models";
import { createEntry, createEvent, getEvents } from "@/database/repository";
import { refreshEventReminder } from "@/features/reminders/scheduleReminder";

type EventsState = {
  events: EventItem[];
  loading: boolean;
  load: (db: SQLiteDatabase) => Promise<void>;
  addEvent: (db: SQLiteDatabase, input: Parameters<typeof createEvent>[1]) => Promise<number>;
  addEntry: (db: SQLiteDatabase, input: Parameters<typeof createEntry>[1]) => Promise<void>;
};

export const useEventsStore = create<EventsState>((set) => ({
  events: [], loading: true,
  load: async (db) => { set({ loading: true }); try { set({ events: await getEvents(db) }); } finally { set({ loading: false }); } },
  addEvent: async (db, input) => { const id = await createEvent(db, input); set({ events: await getEvents(db) }); return id; },
  addEntry: async (db, input) => { await createEntry(db, input); await refreshEventReminder(db, input.eventId); set({ events: await getEvents(db) }); },
}));
