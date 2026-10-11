import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router, usePathname } from "expo-router";
import { isRunningInExpoGo } from "expo";
import { SQLiteProvider } from "expo-sqlite";
import { initializeDatabase } from "@/database/database";
import { usePreferencesStore } from "@/store/preferences";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { NavigationBar } from "expo-navigation-bar";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import * as SystemUI from "expo-system-ui";

if (Platform.OS !== "web" && !isRunningInExpoGo()) {
  void import("expo-notifications").then((Notifications) => Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  }));
}

function useReminderNavigation() {
  const hydratePreferences = usePreferencesStore((state) => state.hydrate);
  useEffect(() => {
    void hydratePreferences();
    if (Platform.OS === "web" || isRunningInExpoGo()) return;
    let mounted = true;
    let subscription: { remove: () => void } | undefined;
    const redirect = (eventId: unknown) => {
      if (typeof eventId === "number" || typeof eventId === "string") {
        router.push({ pathname: "/events/[id]", params: { id: String(eventId) } });
      }
    };
    void import("expo-notifications").then((Notifications) => {
      if (!mounted) return;
      const initial = Notifications.getLastNotificationResponse();
      redirect(initial?.notification.request.content.data?.eventId);
      subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        redirect(response.notification.request.content.data?.eventId);
      });
    });
    return () => { mounted = false; subscription?.remove(); };
  }, [hydratePreferences]);
}

export default function RootLayout() {
  useReminderNavigation();
  useEffect(() => {
    if (Platform.OS === "android") NavigationBar.setHidden(true);
  }, []);
  const darkMode = usePreferencesStore((state) => state.darkMode);
  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(darkMode ? "#191B20" : "#F6F7F3");
  }, [darkMode]);
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
    <GestureHandlerRootView style={[styles.appRoot, { backgroundColor: darkMode ? "#191B20" : "#F6F7F3" }]}>
      <SQLiteProvider databaseName="lastlittlethings.db" onInit={initializeDatabase}>
        <AppStack darkMode={darkMode} />
      </SQLiteProvider>
    </GestureHandlerRootView>
  );
}

function AppStack({ darkMode }: { darkMode: boolean }) {
  const pathname = usePathname();
  const backgroundColor = darkMode ? "#191B20" : "#F6F7F3";
  const navigationTheme = darkMode
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: backgroundColor, card: backgroundColor } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: backgroundColor, card: backgroundColor } };
  const edgeBackGesture = Gesture.Pan()
    .runOnJS(true)
    .activeOffsetX(24)
    .failOffsetY([-32, 32])
    .onEnd((event) => {
      const completedSwipe = event.translationX > 100 || (event.translationX > 42 && event.velocityX > 500);
      if (Platform.OS === "android" && pathname !== "/" && pathname !== "/index" && completedSwipe && router.canGoBack()) {
        router.back();
      }
    });

  return (
    <ThemeProvider value={navigationTheme}>
      <GestureDetector gesture={edgeBackGesture}>
        <View style={[styles.appRoot, { backgroundColor }]}>
          <Stack screenOptions={{ headerShown: false, gestureEnabled: true, fullScreenGestureEnabled: true, animation: "slide_from_right", contentStyle: { backgroundColor } }} />
        </View>
      </GestureDetector>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  appRoot: { flex: 1 },
  lockScreen: { flex: 1, justifyContent: "center", padding: 28 },
  lockTitle: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  lockCopy: { fontSize: 15, lineHeight: 22, textAlign: "center", marginTop: 12 },
  retryButton: { alignSelf: "center", marginTop: 22, backgroundColor: "#D3E4FF", borderRadius: 18, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: "#17385C", fontWeight: "700", fontSize: 15 },
});
