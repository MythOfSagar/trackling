import { Platform } from "react-native";
import { isRunningInExpoGo } from "expo";
import type { SQLiteDatabase } from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { ReminderUnit } from "@/types/models";

const unitSeconds: Record<ReminderUnit, number> = { minute: 60, hour: 3_600, day: 86_400, week: 604_800, month: 2_592_000, year: 31_536_000 };

export async function scheduleEventReminder(eventId: number, eventName: string, interval: number, unit: ReminderUnit = "day") {
  if (Platform.OS === "web" || isRunningInExpoGo()) return null;
  if (!Number.isInteger(interval) || interval < 1) throw new Error("Reminder interval must be a positive whole number");
  const Notifications = await import("expo-notifications");
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("moments", {
      name: "Moment reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") throw new Error("Notification permission was not granted");
  const seconds = Math.max(60, interval * unitSeconds[unit]);
  return Notifications.scheduleNotificationAsync({
    content: {
      title: `A moment for ${eventName}`,
      body: "Would you like to log this again?",
      data: { eventId },
      ...(Platform.OS === "android" ? { channelId: "moments" } : {}),
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds,
      repeats: true,
    },
  });
}

export async function refreshEventReminder(db: SQLiteDatabase, eventId: number) {
  if (await AsyncStorage.getItem("little-again:reminders-enabled") === "false") return;
  const event = await db.getFirstAsync<{ name: string; reminderEnabled: number; reminderConfig: string | null }>(
    "SELECT name, reminder_enabled AS reminderEnabled, reminder_config AS reminderConfig FROM events WHERE id = ?", eventId,
  );
  if (!event?.reminderEnabled || !event.reminderConfig || Platform.OS === "web" || isRunningInExpoGo()) return;
  try {
    const Notifications = await import("expo-notifications");
    const config = JSON.parse(event.reminderConfig) as { interval?: number; unit?: ReminderUnit; intervalDays?: number; notificationId?: string };
    const interval = config.interval ?? config.intervalDays;
    const unit = config.unit ?? "day";
    if (!interval) return;
    if (config.notificationId) await Notifications.cancelScheduledNotificationAsync(config.notificationId);
    const notificationId = await scheduleEventReminder(eventId, event.name, interval, unit);
    if (notificationId) await db.runAsync("UPDATE events SET reminder_config = ? WHERE id = ?", JSON.stringify({ ...config, interval, unit, notificationId }), eventId);
  } catch {
    // A saved entry must remain successful even if notification permissions changed.
  }
}
