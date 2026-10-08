import { Stack, router } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { initializeDatabase } from "@/database/database";
import { usePreferencesStore } from "@/store/preferences";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Notifications from "expo-notifications";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

function useReminderNavigation() {
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  useEffect(() => {
    void hydratePreferences();
    if (Platform.OS === "web") return;
    const redirect = (eventId: unknown) => {
      if (typeof eventId === "number" || typeof eventId === "string") {
        router.push({ pathname: "/events/[id]", params: { id: String(eventId) } });
      }
    };
    const initial = Notifications.getLastNotificationResponse();
    redirect(initial?.notification.request.content.data?.eventId);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      redirect(response.notification.request.content.data?.eventId);
    });
    return () => subscription.remove();
  }, [hydratePreferences]);
}

export default function RootLayout() {
  useReminderNavigation();
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const [retryLock, setRetryLock] = useState(0);
  const [databaseTabState, setDatabaseTabState] = useState<"checking" | "ready" | "busy">(() => Platform.OS === "web" && typeof navigator !== "undefined" && Boolean(navigator.locks) ? "checking" : "ready");

  useEffect(() => {
    if (Platform.OS !== "web" || !navigator.locks) return;
    let mounted = true;
    let releaseLock: (() => void) | undefined;
    void navigator.locks.request("little-again-sqlite", { ifAvailable: true }, (lock) => {
      if (!mounted) return;
      if (!lock) {
        setDatabaseTabState("busy");
        return;
      }
      setDatabaseTabState("ready");
      return new Promise<void>((resolve) => { releaseLock = resolve; });
    }).catch(() => { if (mounted) setDatabaseTabState("ready"); });
    return () => {
      mounted = false;
      releaseLock?.();
    };
  }, [retryLock]);

  if (databaseTabState !== "ready") {
    return <View style={[styles.lockScreen, { backgroundColor: darkMode ? "#191B20" : "#F7F8FD" }]}>
      <Text style={[styles.lockTitle, { color: darkMode ? "#E8EBF0" : "#202124" }]}>Little Again is open in another tab</Text>
      <Text style={[styles.lockCopy, { color: darkMode ? "#AAB7C7" : "#5F6368" }]}>Close the other app tab to use this one. This keeps your browser database from being opened twice.</Text>
      <Pressable accessibilityRole="button" onPress={() => { setDatabaseTabState("checking"); setRetryLock((value) => value + 1); }} style={styles.retryButton}><Text style={styles.retryText}>Retry</Text></Pressable>
    </View>;
  }
  return (
    <SQLiteProvider databaseName="lastlittlethings.db" onInit={initializeDatabase}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: darkMode ? "#191B20" : "#F6F7F3" } }} />
    </SQLiteProvider>
  );
}

const styles = StyleSheet.create({
  lockScreen: { flex: 1, justifyContent: "center", padding: 28 },
  lockTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  lockCopy: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
  retryButton: { alignSelf: "center", marginTop: 22, backgroundColor: "#D3E4FF", borderRadius: 18, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: "#17385C", fontWeight: "700", fontSize: 15 },
});
