export type EventItem = {
  id: number;
  name: string;
  icon: string;
  color: string;
  categoryId: number;
  categoryName: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  lastOccurredAt: string | null;
  entryCount: number;
  reminderEnabled: boolean;
};

export type Category = { id: number; name: string; icon: string; color: string };

export type CreateEventInput = {
  name: string;
  icon: string;
  color: string;
  categoryId: number;
  description?: string;
  reminderInterval?: number;
  reminderUnit?: ReminderUnit;
};

export type ReminderUnit = "minute" | "hour" | "day" | "week" | "month" | "year";

export type CreateEntryInput = {
  eventId: number;
  occurredAt: string;
  title?: string;
  note?: string;
  numericValue?: number | null;
};
