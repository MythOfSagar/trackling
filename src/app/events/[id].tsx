import { goBack } from "@/utils/navigation";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { cancelScheduledReminder } from "@/features/reminders/notifications";
import type { EventItem } from "@/types/models";
import { deleteEvent, getEvents } from "@/database/repository";
import { getElapsedTime, formatLastDate, formatClock } from "@/utils/elapsed";
import { useEventsStore } from "@/store/events";
import { usePreferencesStore } from "@/store/preferences";
import { PrimaryButton } from "@/components/PrimaryButton";

type EntryRow = { id: number; occurredAt: string; title: string; note: string | null; numericValue: number | null };

export default function EventDetailsScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const refreshHome = useEventsStore((state) => state.load);
  const use24Hour = usePreferencesStore((state) => state.use24Hour);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [history, setHistory] = useState<EntryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    try {
      const events = await getEvents(db);
      setEvent(events.find((item) => item.id === Number(id)) ?? null);
      setHistory(await db.getAllAsync<EntryRow>("SELECT id, occurred_at AS occurredAt, title, note, numeric_value AS numericValue FROM entries WHERE event_id = ? ORDER BY occurred_at DESC LIMIT 100", Number(id)));
    } finally { setLoading(false); }
  }, [db, id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useEffect(() => { const initial = setTimeout(() => setNow(Date.now()), 0); const timer = setInterval(() => setNow(Date.now()), 15_000); return () => { clearTimeout(initial); clearInterval(timer); }; }, []);

  const addNow = async () => {
    try { await refreshHome(db); router.push({ pathname: "/entries/new", params: { eventId: String(id) } }); }
    catch { Alert.alert("Couldn’t open entry", "Please try again."); }
  };

  const disableReminder = () => Alert.alert("Turn off this reminder?", "You can turn it back on or change its schedule when you edit this moment.", [
    { text: "Cancel", style: "cancel" },
    { text: "Turn off", onPress: () => { void (async () => {
      const row = await db.getFirstAsync<{ reminderConfig: string | null }>("SELECT reminder_config AS reminderConfig FROM events WHERE id = ?", Number(id));
      if (row?.reminderConfig) {
        try {
          const config = JSON.parse(row.reminderConfig) as { notificationId?: string };
          if (config.notificationId) await cancelScheduledReminder(config.notificationId);
        } catch { /* Clear the saved reminder even if its notification is already gone. */ }
      }
      await db.runAsync("UPDATE events SET reminder_enabled = 0, reminder_config = NULL WHERE id = ?", Number(id));
      await refreshHome(db);
      await load();
    })().catch(() => Alert.alert("Couldn’t turn off reminder", "Please try again.")); } },
  ]);

  const removeEvent = () => Alert.alert("Delete this moment?", "Its entry history will also be deleted from this device.", [
    { text: "Cancel", style: "cancel" },
    { text: "Delete", style: "destructive", onPress: () => { void (async () => {
      const row = await db.getFirstAsync<{ reminderConfig: string | null }>("SELECT reminder_config AS reminderConfig FROM events WHERE id = ?", Number(id));
      if (row?.reminderConfig) {
        try {
          const config = JSON.parse(row.reminderConfig) as { notificationId?: string };
          if (config.notificationId) await cancelScheduledReminder(config.notificationId);
        } catch { /* Continue deleting the moment if its notification is already gone. */ }
      }
      await deleteEvent(db, Number(id));
      await refreshHome(db);
      router.replace("/");
    })().catch(() => Alert.alert("Couldn’t delete this moment", "Please try again.")); } },
  ]);

  if (loading) return <View style={s(styles.center)}><ActivityIndicator color="#315B45" /></View>;
  if (!event) return <View style={s(styles.center)}><Text style={s(styles.missing)}>This moment couldn’t be found.</Text><Pressable onPress={() => goBack()}><Text style={s(styles.backLink)}>Go back</Text></Pressable></View>;

  return (
    <ScrollView style={s(styles.safe)} contentContainerStyle={s(styles.content)}>
      <Pressable onPress={() => goBack()} style={s(styles.back)}><Text style={s(styles.backText)}>‹  Your moments</Text></Pressable>
      <View style={[s(styles.heroIcon), { backgroundColor: event.color }]}><Text style={s(styles.icon)}>{event.icon}</Text></View>
      <Text style={s(styles.category)}>{event.categoryName.toUpperCase()}</Text><Text style={s(styles.title)}>{event.name}</Text><Text style={s(styles.elapsed)}>{getElapsedTime(event.lastOccurredAt, now)}</Text>
      <Text style={s(styles.last)}>Last done · {formatLastDate(event.lastOccurredAt, use24Hour)}</Text>
      {event.description ? <Text style={s(styles.description)}>{event.description}</Text> : null}
      <PrimaryButton title="＋  I just did this" onPress={() => void addNow()} style={s(styles.add)} />
      <Pressable onPress={() => router.push({ pathname: "/events/[id]/edit", params: { id: String(id) } })} style={s(styles.editEvent)}><Text style={s(styles.editEventText)}>Edit this moment</Text></Pressable>
      {event.reminderEnabled ? <Pressable onPress={disableReminder} style={s(styles.editEvent)}><Text style={s(styles.editEventText)}>Turn off reminder</Text></Pressable> : null}
      <View style={s(styles.actions)}><Pressable onPress={() => router.push({ pathname: "/events/[id]/history", params: { id: String(id) } })} style={s(styles.action)}><Text style={s(styles.actionText)}>History</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/events/[id]/calendar", params: { id: String(id) } })} style={s(styles.action)}><Text style={s(styles.actionText)}>Calendar</Text></Pressable><Pressable onPress={() => router.push({ pathname: "/events/[id]/stats", params: { id: String(id) } })} style={s(styles.action)}><Text style={s(styles.actionText)}>Stats</Text></Pressable></View>
      <View style={s(styles.statRow)}><View style={s(styles.stat)}><Text style={s(styles.statNumber)}>{event.entryCount}</Text><Text style={s(styles.statLabel)}>TOTAL ENTRIES</Text></View><View style={s(styles.stat)}><Text style={s(styles.statNumber)}>{history.length > 1 ? Math.round((new Date(history[0].occurredAt).getTime() - new Date(history[history.length - 1].occurredAt).getTime()) / 86_400_000) : "—"}</Text><Text style={s(styles.statLabel)}>DAYS TRACKED</Text></View></View>
      <Text style={s(styles.historyTitle)}>Recent history</Text>
      <Pressable onPress={removeEvent} style={s(styles.deleteEvent)}><Text style={s(styles.deleteEventText)}>Delete this moment</Text></Pressable>
      {history.length === 0 ? <Text style={s(styles.noHistory)}>Your first entry will show up here.</Text> : history.map((entry, index) => <View key={entry.id} style={s(styles.entryRow)}><View style={s(styles.timeline)}><View style={[s(styles.dot), index === 0 && s(styles.currentDot)]} />{index < history.length - 1 && <View style={s(styles.line)} />}</View><View style={s(styles.entryText)}><Text style={s(styles.entryDate)}>{new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(entry.occurredAt))}</Text><Text style={s(styles.entryTime)}>{formatClock(entry.occurredAt, use24Hour)}{entry.numericValue !== null ? `  ·  ${entry.numericValue}` : ""}</Text><Text style={s(styles.note)}>{entry.title}</Text>{entry.note ? <Text style={s(styles.note)}>{entry.note}</Text> : null}</View></View>)}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 18, paddingBottom: 44 }, center: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F6F7F3" }, missing: { color: "#1F3029", fontSize: 16, marginBottom: 12 }, back: { marginBottom: 29 }, backText: { color: "#63766A", fontSize: 14, fontWeight: "600" }, heroIcon: { width: 68, height: 68, borderRadius: 23, alignItems: "center", justifyContent: "center", marginBottom: 18 }, icon: { fontSize: 32 }, category: { color: "#819184", fontSize: 10, fontWeight: "800", letterSpacing: 1.3 }, title: { color: "#1F3029", fontWeight: "700", letterSpacing: -1.1, fontSize: 34, marginTop: 5 }, elapsed: { color: "#315B45", fontSize: 22, fontWeight: "700", marginTop: 9 }, last: { color: "#7C877E", fontSize: 13, marginTop: 7 }, description: { color: "#6F7A71", fontSize: 14, lineHeight: 21, marginTop: 15 }, add: { marginTop: 25 }, editEvent: { alignItems: "center", paddingVertical: 13 }, editEventText: { color: "#6E7A70", fontSize: 12, fontWeight: "700" }, deleteEvent: { alignItems: "center", paddingVertical: 14, marginTop: 12 }, deleteEventText: { color: "#A35B4A", fontSize: 12, fontWeight: "700" }, actions: { flexDirection: "row", gap: 9, marginTop: 11 }, action: { flex: 1, height: 42, borderRadius: 14, backgroundColor: "#E9EEE8", alignItems: "center", justifyContent: "center" }, actionText: { color: "#42634B", fontWeight: "700", fontSize: 12 }, statRow: { flexDirection: "row", gap: 12, marginTop: 24 }, stat: { flex: 1, padding: 17, backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#EDEFEA" }, statNumber: { color: "#244D3B", fontSize: 24, fontWeight: "700" }, statLabel: { color: "#8D978F", fontSize: 9, fontWeight: "800", letterSpacing: 0.9, marginTop: 7 }, historyTitle: { color: "#1F3029", fontSize: 19, fontWeight: "700", marginTop: 32, marginBottom: 17 }, noHistory: { color: "#88928A", fontSize: 14 }, entryRow: { flexDirection: "row", minHeight: 74 }, timeline: { width: 22, alignItems: "center" }, dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#B7C5B9", marginTop: 5 }, currentDot: { backgroundColor: "#315B45", width: 11, height: 11 }, line: { width: 1, flex: 1, backgroundColor: "#DCE3DB", marginTop: 4 }, entryText: { flex: 1, paddingLeft: 7, paddingBottom: 15 }, entryDate: { color: "#34463B", fontSize: 14, fontWeight: "700" }, entryTime: { color: "#79847B", fontSize: 12, marginTop: 4 }, note: { color: "#6F7A71", fontSize: 13, marginTop: 6 }, backLink: { color: "#315B45", fontWeight: "700" } });

