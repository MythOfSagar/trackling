import { createThemeStyle } from "@/utils/theme";
import { useEffect, useState } from "react";
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { exportBackup, importBackup } from "@/database/backup";
import { useEventsStore } from "@/store/events";
import { scheduleEventReminder, refreshEventReminder } from "@/features/reminders/scheduleReminder";
import { usePreferencesStore } from "@/store/preferences";
import type { ReminderUnit } from "@/types/models";

const REMINDERS_KEY = "little-again:reminders-enabled";

export default function SettingsScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const db = useSQLiteContext();
  const reload = useEventsStore((state) => state.load);
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const use24Hour = usePreferencesStore((state) => state.use24Hour);
  const setUse24Hour = usePreferencesStore((state) => state.setUse24Hour);
  const setDarkMode = usePreferencesStore((state) => state.setDarkMode);
  const defaultReminderInterval = usePreferencesStore((state) => state.defaultReminderInterval);
  const defaultReminderUnit = usePreferencesStore((state) => state.defaultReminderUnit);
  const setDefaultReminderInterval = usePreferencesStore((state) => state.setDefaultReminderInterval);
  const setDefaultReminderUnit = usePreferencesStore((state) => state.setDefaultReminderUnit);
  const [defaultIntervalInput, setDefaultIntervalInput] = useState(String(defaultReminderInterval));
  useEffect(() => { void AsyncStorage.getItem(REMINDERS_KEY).then((value) => { if (value !== null) setRemindersEnabled(value === "true"); }); }, []);

  const setReminders = async (enabled: boolean) => {
    setBusy(true);
    try {
      if (Platform.OS === "web") {
        await AsyncStorage.setItem(REMINDERS_KEY, String(enabled));
        setRemindersEnabled(enabled);
      } else if (!enabled) {
        await Notifications.cancelAllScheduledNotificationsAsync();
      } else {
        const events = await db.getAllAsync<{ id: number; name: string; reminderConfig: string | null }>("SELECT id, name, reminder_config AS reminderConfig FROM events WHERE reminder_enabled = 1");
        for (const event of events) {
          const config = event.reminderConfig ? JSON.parse(event.reminderConfig) as { interval?: number; unit?: ReminderUnit; intervalDays?: number; notificationId?: string } : null;
          const interval = config?.interval ?? config?.intervalDays;
          if (!interval) continue;
          const unit = config?.unit ?? "day";
          const notificationId = await scheduleEventReminder(event.id, event.name, interval, unit);
          if (notificationId) await db.runAsync("UPDATE events SET reminder_config = ? WHERE id = ?", JSON.stringify({ ...config, interval, unit, notificationId }), event.id);
        }
      }
      await AsyncStorage.setItem(REMINDERS_KEY, String(enabled));
      setRemindersEnabled(enabled);
    } catch {
      Alert.alert("Couldn’t update reminders", "Check notification permissions in your device settings and try again.");
    } finally { setBusy(false); }
  };

  const exportData = async () => {
    setBusy(true);
    try { await exportBackup(db); }
    catch (error) { Alert.alert("Export didn’t finish", error instanceof Error ? error.message : "Please try again."); }
    finally { setBusy(false); }
  };

  const chooseImport = () => Alert.alert("Import a backup", "Imported records are added to the moments on this device.", [{ text: "Cancel", style: "cancel" }, { text: "Choose file", onPress: () => { void doImport(); } }]);
  const doImport = async () => {
    setBusy(true);
    try {
      const result = await importBackup(db);
      if (!result) return;
      if (remindersEnabled) {
        const eventIds = await db.getAllAsync<{ id: number }>("SELECT id FROM events WHERE reminder_enabled = 1");
        for (const event of eventIds) await refreshEventReminder(db, event.id);
      }
      await reload(db);
      Alert.alert("Import complete", `${result.events} moments, ${result.entries} entries, and ${result.categories} categories were read from the backup.`);
    } catch (error) { Alert.alert("Import didn’t finish", error instanceof Error ? error.message : "Choose a valid Little Again JSON backup."); }
    finally { setBusy(false); }
  };

  const deleteAll = () => Alert.alert("Delete all moments?", "This permanently removes all events and entries from this device. Categories will stay.", [{ text: "Cancel", style: "cancel" }, { text: "Delete everything", style: "destructive", onPress: () => { void (async () => { if (Platform.OS !== "web") await Notifications.cancelAllScheduledNotificationsAsync(); await db.runAsync("DELETE FROM entries"); await db.runAsync("DELETE FROM events"); await reload(db); router.back(); })().catch(() => Alert.alert("Couldn’t delete data", "Please try again.")); } }]);

  return <ScrollView style={s(styles.safe)} contentContainerStyle={s(styles.content)}><Pressable onPress={() => router.back()}><Text style={s(styles.back)}>‹  Back</Text></Pressable><Text style={s(styles.title)}>Settings</Text><Text style={s(styles.subtitle)}>Make this little space yours.</Text>
    <Text style={s(styles.section)}>YOUR SPACE</Text><View style={s(styles.row)}><View style={s(styles.rowIcon)}><Text>◷</Text></View><View style={s(styles.rowText)}><Text style={s(styles.rowTitle)}>24-hour clock</Text><Text style={s(styles.rowHint)}>Use 18:30 instead of 6:30 PM</Text></View><Switch value={use24Hour} onValueChange={(value) => void setUse24Hour(value)} trackColor={{ false: "#DDE2DB", true: "#91AA93" }} thumbColor={use24Hour ? "#315B45" : "#FFFFFF"} accessibilityLabel="Use 24-hour time" /></View><View style={s(styles.row)}><View style={s(styles.rowIcon)}><Text>◐</Text></View><View style={s(styles.rowText)}><Text style={s(styles.rowTitle)}>Dark theme</Text><Text style={s(styles.rowHint)}>{darkMode ? "Dark appearance is on" : "Use a darker appearance"}</Text></View><Switch value={darkMode} onValueChange={(value) => void setDarkMode(value)} trackColor={{ false: "#C8CBD2", true: "#6D9FE2" }} thumbColor={darkMode ? "#D3E4FF" : "#FFFFFF"} accessibilityLabel="Use dark theme" /></View><Pressable onPress={() => router.push("/categories")} style={s(styles.row)}><View style={s(styles.rowIcon)}><Text>✳</Text></View><View style={s(styles.rowText)}><Text style={s(styles.rowTitle)}>Categories</Text><Text style={s(styles.rowHint)}>Create and manage groups</Text></View><Text style={s(styles.arrow)}>�</Text></Pressable>
    <Text style={s(styles.section)}>REMINDERS</Text><View style={s(styles.row)}><View style={s(styles.rowIcon)}><Text>◷</Text></View><View style={s(styles.rowText)}><Text style={s(styles.rowTitle)}>Local notifications</Text><Text style={s(styles.rowHint)}>Reminders stay on this device</Text></View><Switch value={remindersEnabled} disabled={busy} onValueChange={(value) => void setReminders(value)} trackColor={{ false: "#DDE2DB", true: "#91AA93" }} thumbColor={remindersEnabled ? "#315B45" : "#FFFFFF"} accessibilityLabel="Enable all local reminders" /></View><View style={s(styles.timeCard)}><Text style={s(styles.rowTitle)}>Default reminder period</Text><TextInput value={defaultIntervalInput} onChangeText={(value) => { setDefaultIntervalInput(value); const parsed = Number(value); if (Number.isInteger(parsed) && parsed > 0 && parsed <= 999) void setDefaultReminderInterval(parsed); }} keyboardType="number-pad" maxLength={3} style={s({ height: 44, marginTop: 10, borderRadius: 12, backgroundColor: "#F1F3EF", paddingHorizontal: 12, color: "#34463B" })} accessibilityLabel="Default reminder interval" /><View style={s(styles.timeChoices)}>{(["minute", "hour", "day", "week", "month", "year"] as ReminderUnit[]).map((unit) => <Pressable key={unit} onPress={() => void setDefaultReminderUnit(unit)} style={[s(styles.timeChoice), unit === defaultReminderUnit && s(styles.timeChoiceSelected)]}><Text style={[s(styles.timeText), unit === defaultReminderUnit && s(styles.timeTextSelected)]}>{unit}{defaultReminderInterval === 1 ? "" : "s"}</Text></Pressable>)}</View><Text style={s(styles.rowHint)}>Used as the starting period for new reminders.</Text></View>
    <Text style={s(styles.section)}>YOUR DATA</Text><Pressable disabled={busy} onPress={() => void exportData()} style={s(styles.row)}><View style={s(styles.rowIcon)}><Text>↗</Text></View><View style={s(styles.rowText)}><Text style={s(styles.rowTitle)}>Export backup</Text><Text style={s(styles.rowHint)}>Save a private JSON copy</Text></View><Text style={s(styles.arrow)}>›</Text></Pressable><Pressable disabled={busy} onPress={chooseImport} style={s(styles.row)}><View style={s(styles.rowIcon)}><Text>↙</Text></View><View style={s(styles.rowText)}><Text style={s(styles.rowTitle)}>Import backup</Text><Text style={s(styles.rowHint)}>Restore a Little Again JSON file</Text></View><Text style={s(styles.arrow)}>›</Text></Pressable><Pressable onPress={deleteAll} style={[s(styles.row), s(styles.dangerRow)]}><View style={[s(styles.rowIcon), s(styles.dangerIcon)]}><Text>⌫</Text></View><View style={s(styles.rowText)}><Text style={s(styles.dangerTitle)}>Delete all moments</Text><Text style={s(styles.rowHint)}>Remove local event and entry data</Text></View><Text style={s(styles.arrow)}>›</Text></Pressable>
    <Text style={s(styles.section)}>ABOUT</Text><View style={s(styles.about)}><Text style={s(styles.aboutBrand)}>little again</Text><Text style={s(styles.aboutCopy)}>Version {Constants.expoConfig?.version ?? "1.0.0"}</Text><Text style={s(styles.aboutCopy)}>Your tracking data is stored on this device. Nothing is sent to a server.</Text></View>
  </ScrollView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 20, paddingBottom: 44 }, back: { color: "#63766A", fontSize: 14, fontWeight: "600" }, title: { color: "#1F3029", fontSize: 30, fontWeight: "700", letterSpacing: -0.9, marginTop: 24 }, subtitle: { color: "#7D8780", fontSize: 14, marginTop: 6 }, section: { color: "#88938A", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginTop: 26, marginBottom: 10 }, row: { minHeight: 67, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 12, marginBottom: 7, borderWidth: 1, borderColor: "#EBEEE9" }, rowIcon: { width: 37, height: 37, borderRadius: 13, backgroundColor: "#E9F0E8", alignItems: "center", justifyContent: "center" }, rowText: { flex: 1, marginLeft: 11 }, rowTitle: { color: "#34463B", fontSize: 13, fontWeight: "700" }, rowHint: { color: "#8B958C", fontSize: 10, marginTop: 3 }, arrow: { color: "#A3ADA4", fontSize: 21, paddingHorizontal: 5 }, timeCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 13, marginBottom: 7, borderWidth: 1, borderColor: "#EBEEE9" }, timeChoices: { flexDirection: "row", gap: 7, marginTop: 11 }, timeChoice: { paddingVertical: 8, paddingHorizontal: 11, borderRadius: 12, backgroundColor: "#F1F3EF" }, timeChoiceSelected: { backgroundColor: "#E3ECE2" }, timeText: { color: "#77837A", fontSize: 11, fontWeight: "600" }, timeTextSelected: { color: "#315B45" }, dangerRow: { marginTop: 3 }, dangerIcon: { backgroundColor: "#F6EDE9" }, dangerTitle: { color: "#97594B", fontSize: 13, fontWeight: "700" }, about: { backgroundColor: "#FFFFFF", padding: 16, borderRadius: 17 }, aboutBrand: { color: "#315B45", fontSize: 15, fontWeight: "800" }, aboutCopy: { color: "#828D84", fontSize: 11, lineHeight: 17, marginTop: 6 } });

