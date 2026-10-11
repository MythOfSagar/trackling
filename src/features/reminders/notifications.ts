import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

export function canUseLocalNotifications() {
  return Platform.OS !== "web" && !isRunningInExpoGo();
}

export async function cancelScheduledReminder(notificationId: string) {
  if (!canUseLocalNotifications()) return;
  const Notifications = await import("expo-notifications");
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

export async function cancelAllScheduledReminders() {
  if (!canUseLocalNotifications()) return;
  const Notifications = await import("expo-notifications");
  await Notifications.cancelAllScheduledNotificationsAsync();
}
