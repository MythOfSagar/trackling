import { createThemeStyle } from "@/utils/theme";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useEventsStore } from "@/store/events";
import { usePreferencesStore } from "@/store/preferences";
import type { EventItem } from "@/types/models";
import { getElapsedTime, formatLastDate } from "@/utils/elapsed";

type Tab = "events" | "timeline";
type TimelineItem = { id: number; eventId: number; name: string; icon: string; categoryName: string; occurredAt: string; note: string | null };

export default function HomeScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const db = useSQLiteContext();
  const { events, loading, load, addEntry } = useEventsStore();
  const [now, setNow] = useState(0);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [tab, setTab] = useState<Tab>("events");
  const [query, setQuery] = useState("");
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const use24Hour = usePreferencesStore((state) => state.use24Hour);

  const loadTimeline = useCallback(async () => {
    const rows = await db.getAllAsync<TimelineItem>(`SELECT en.id, e.id AS eventId, e.name, e.icon, c.name AS categoryName, en.occurred_at AS occurredAt, en.note FROM entries en JOIN events e ON e.id = en.event_id JOIN categories c ON c.id = e.category_id ORDER BY en.occurred_at DESC`);
    setTimeline(rows);
  }, [db]);

  useFocusEffect(useCallback(() => { void load(db); void loadTimeline(); }, [db, load, loadTimeline]));
  useEffect(() => { const initial = setTimeout(() => setNow(Date.now()), 0); const timer = setInterval(() => setNow(Date.now()), 15_000); return () => { clearTimeout(initial); clearInterval(timer); }; }, []);

  const visibleEvents = useMemo(() => events.filter((event) => `${event.name} ${event.categoryName} ${event.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())), [events, query]);
  const recordNow = async (eventId: number) => {
    setBusyId(eventId);
    try { await addEntry(db, { eventId, occurredAt: new Date().toISOString() }); await Promise.all([load(db), loadTimeline()]); }
    finally { setBusyId(null); }
  };

  return (
    <SafeAreaView style={s(styles.safe)}>
      <View style={s(styles.searchWrap)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Categories" onPress={() => router.push("/categories")} style={s(styles.searchIcon)}><Text style={s(styles.menuIcon)}>☰</Text></Pressable>
        <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor="#5F6368" style={s(styles.searchInput)} accessibilityLabel="Search events" returnKeyType="search" />
        <Pressable accessibilityRole="button" accessibilityLabel="Sort events" onPress={() => Alert.alert("Sort events", "Events are shown from most recently updated.")} style={s(styles.searchIcon)}><Text style={s(styles.sortIcon)}>☷</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => router.push("/settings")} style={s(styles.searchIcon)}><Text style={s(styles.moreIcon)}>⋮</Text></Pressable>
      </View>

      <FlatList
        data={tab === "events" ? visibleEvents as (EventItem | TimelineItem)[] : timeline}
        keyExtractor={(item) => `${tab}-${item.id}`}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s(styles.listContent)}
        ListEmptyComponent={loading ? <ActivityIndicator color="#0969B2" style={s(styles.empty)} /> : <Text style={s(styles.empty)}>{tab === "events" ? "No events yet. Tap + to add one." : "Your timeline is empty."}</Text>}
        renderItem={({ item }) => {
          if (tab === "timeline") {
            const entry = item as TimelineItem;
            return <Pressable onPress={() => router.push({ pathname: "/events/[id]", params: { id: String(entry.eventId) } })} style={s(styles.row)}>
              <View style={s(styles.rowHeading)}><Text style={s(styles.title)}>{entry.name} {entry.icon}</Text><Text style={s(styles.when)}>{formatLastDate(entry.occurredAt, use24Hour)}</Text></View>
              {entry.note ? <Text style={s(styles.description)} numberOfLines={2}>{entry.note}</Text> : null}
              <View style={s(styles.rowFooter)}><Text style={s(styles.category)}>{entry.categoryName}</Text><Text style={s(styles.elapsed)}>{getElapsedTime(entry.occurredAt, now)}</Text></View>
            </Pressable>;
          }
          const event = item as (typeof events)[number];
          return <View style={s(styles.row)}>
            <Pressable accessibilityRole="button" accessibilityLabel={`${event.name}. Open details.`} onPress={() => router.push({ pathname: "/events/[id]", params: { id: String(event.id) } })}>
              <View style={s(styles.rowHeading)}><Text style={s(styles.title)}>{event.name} {event.icon}</Text>{event.reminderEnabled ? <Text style={s(styles.when)}>♧ Reminder</Text> : null}</View>
              {event.description ? <Text style={s(styles.description)} numberOfLines={2}>{event.description}</Text> : null}
            </Pressable>
            <View style={s(styles.rowFooter)}><Text style={s(styles.category)}>{event.categoryName}</Text><View style={s(styles.rowActions)}><Text style={s(styles.elapsed)}>{getElapsedTime(event.lastOccurredAt, now)}</Text><Pressable accessibilityRole="button" accessibilityLabel={`Record ${event.name} now`} onPress={() => void recordNow(event.id)} style={s(styles.recordButton)}>{busyId === event.id ? <ActivityIndicator size="small" color="#0969B2" /> : <Text style={s(styles.recordText)}>＋</Text>}</Pressable></View></View>
          </View>;
        }}
      />

      {tab === "events" ? <Pressable accessibilityRole="button" accessibilityLabel="Create event" onPress={() => router.push("/events/new")} style={s(styles.addButton)}><Text style={s(styles.addText)}>＋</Text></Pressable> : null}
      <View style={s(styles.bottomBar)}>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "events" }} onPress={() => setTab("events")} style={s(styles.tabButton)}><View style={[s(styles.tabIconWrap), tab === "events" && s(styles.tabIconActive)]}><Text style={[s(styles.tabIcon), tab === "events" && s(styles.tabSelected)]}>☷</Text></View><Text style={[s(styles.tabLabel), tab === "events" && s(styles.tabSelected)]}>Events</Text></Pressable>
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: tab === "timeline" }} onPress={() => setTab("timeline")} style={s(styles.tabButton)}><View style={[s(styles.tabIconWrap), tab === "timeline" && s(styles.tabIconActive)]}><Text style={[s(styles.tabIcon), tab === "timeline" && s(styles.tabSelected)]}>▤</Text></View><Text style={[s(styles.tabLabel), tab === "timeline" && s(styles.tabSelected)]}>Timeline</Text></Pressable>
      </View>
    </SafeAreaView>
  );
}

const blue = "#0969B2";
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F7F8FD" },
  searchWrap: { height: 56, borderRadius: 30, backgroundColor: "#E6E8EF", marginHorizontal: 16, marginTop: 10, marginBottom: 10, flexDirection: "row", alignItems: "center", paddingHorizontal: 10 },
  searchIcon: { width: 42, height: 44, alignItems: "center", justifyContent: "center" }, menuIcon: { color: "#202124", fontSize: 22 }, searchInput: { flex: 1, color: "#202124", fontSize: 18, paddingHorizontal: 6, outlineStyle: "none" as never }, sortIcon: { color: "#202124", fontSize: 25 }, moreIcon: { color: "#202124", fontSize: 25, fontWeight: "700" },
  listContent: { paddingBottom: 24, flexGrow: 1 }, row: { paddingHorizontal: 18, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#C8CBD2", minHeight: 116, justifyContent: "space-between" }, rowHeading: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }, title: { color: "#202124", fontSize: 17, fontWeight: "600", flex: 1 }, when: { color: blue, fontSize: 14, fontWeight: "600" }, description: { color: "#292B30", fontSize: 15, lineHeight: 21, marginTop: 10 }, rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16 }, category: { backgroundColor: "#E6E8EF", color: "#555A63", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, overflow: "hidden", fontSize: 13 }, rowActions: { flexDirection: "row", alignItems: "center", gap: 8 }, elapsed: { color: blue, fontSize: 14, fontWeight: "600", borderWidth: 1, borderColor: "#C8CBD2", borderRadius: 22, paddingHorizontal: 11, paddingVertical: 7, overflow: "hidden" }, recordButton: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "#D5E5FF" }, recordText: { color: blue, fontSize: 22 },
  empty: { textAlign: "center", color: "#6D727A", marginTop: 42, fontSize: 15 }, addButton: { position: "absolute", right: 24, bottom: 98, width: 58, height: 58, borderRadius: 20, backgroundColor: "#D3E4FF", alignItems: "center", justifyContent: "center", elevation: 5, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 9, shadowOffset: { width: 0, height: 4 } }, addText: { color: "#17385C", fontSize: 31, fontWeight: "400", marginTop: -3 },
  bottomBar: { height: 78, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#CFD2DA", backgroundColor: "#ECEEF4", flexDirection: "row", justifyContent: "center", gap: 60, paddingTop: 6 }, tabButton: { width: 112, alignItems: "center" }, tabIconWrap: { minWidth: 72, height: 38, borderRadius: 22, alignItems: "center", justifyContent: "center" }, tabIconActive: { backgroundColor: "#D8E5FC" }, tabIcon: { color: "#51565E", fontSize: 23 }, tabLabel: { color: "#51565E", fontSize: 13, fontWeight: "500", marginTop: 2 }, tabSelected: { color: "#202124", fontWeight: "700" },
});

