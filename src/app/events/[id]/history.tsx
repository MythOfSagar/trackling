import { goBack } from "@/utils/navigation";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { deleteEntry } from "@/database/repository";
import { useEventsStore } from "@/store/events";
import { usePreferencesStore } from "@/store/preferences";
import { formatClock } from "@/utils/elapsed";

type Entry = { id: number; occurredAt: string; title: string; note: string | null; numericValue: number | null };
const PAGE_SIZE = 40;

export default function HistoryScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const use24Hour = usePreferencesStore((state) => state.use24Hour);
  const [rows, setRows] = useState<Entry[]>([]);
  const [query, setQuery] = useState("");
  const [eventName, setEventName] = useState("History");
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset = true, term = query) => {
    setLoading(true);
    try {
      const offset = reset ? 0 : offsetRef.current;
      const pattern = `%${term.trim()}%`;
      const next = await db.getAllAsync<Entry>(`SELECT id, occurred_at AS occurredAt, title, note, numeric_value AS numericValue FROM entries WHERE event_id = ? AND (? = '%%' OR title LIKE ? OR note LIKE ?) ORDER BY occurred_at DESC LIMIT ? OFFSET ?`, Number(id), pattern, pattern, pattern, PAGE_SIZE, offset);
      setRows((current) => reset ? next : [...current, ...next]);
      offsetRef.current = offset + next.length;
      setHasMore(next.length === PAGE_SIZE);
      if (reset) { const event = await db.getFirstAsync<{ name: string }>("SELECT name FROM events WHERE id = ?", Number(id)); setEventName(event?.name ?? "History"); }
    } finally { setLoading(false); }
  }, [db, id, query]);

  useFocusEffect(useCallback(() => { void load(true); }, [load]));
  const search = (value: string) => { setQuery(value); void load(true, value); };
  const askDelete = (entryId: number) => Alert.alert("Delete this entry?", "This can’t be undone.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { void deleteEntry(db, entryId).then(async () => { await useEventsStore.getState().load(db); await load(true); }); } }]);

  return (
    <View style={s(styles.safe)}>
      <View style={s(styles.heading)}><Pressable onPress={() => goBack()}><Text style={s(styles.back)}>‹  Back</Text></Pressable><Text style={s(styles.title)}>{eventName} history</Text><Text style={s(styles.subtitle)}>Every time you made it happen.</Text><TextInput value={query} onChangeText={search} placeholder="Search notes…" placeholderTextColor="#AAB0AA" style={s(styles.search)} /></View>
      <FlatList data={rows} keyExtractor={(item) => String(item.id)} contentContainerStyle={s(styles.list)} onEndReached={() => { if (hasMore && !loading) void load(false); }} onEndReachedThreshold={0.35} refreshing={loading && rows.length === 0} onRefresh={() => void load(true)} ListEmptyComponent={!loading ? <Text style={s(styles.empty)}>{query ? "No matching entries." : "No entries yet. Add the first one."}</Text> : <ActivityIndicator color="#315B45" style={{ marginTop: 30 }} />} ListFooterComponent={loading && rows.length > 0 ? <ActivityIndicator color="#315B45" style={{ padding: 16 }} /> : null} renderItem={({ item }) => <View style={s(styles.row)}><View style={s(styles.marker)}><View style={s(styles.dot)} /><View style={s(styles.line)} /></View><View style={s(styles.entry)}><Text style={s(styles.date)}>{new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.occurredAt))}</Text><Text style={s(styles.time)}>{formatClock(item.occurredAt, use24Hour)}{item.numericValue !== null ? `  ·  ${item.numericValue}` : ""}</Text><Text style={s(styles.note)}>{item.title}</Text>{item.note ? <Text style={s(styles.note)}>{item.note}</Text> : null}<View style={s(styles.actions)}><Pressable onPress={() => router.push({ pathname: "/entries/new", params: { eventId: String(id), entryId: String(item.id) } })}><Text style={s(styles.action)}>Edit</Text></Pressable><Pressable onPress={() => askDelete(item.id)}><Text style={[s(styles.action), s(styles.delete)]}>Delete</Text></Pressable></View></View></View>} />
    </View>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, heading: { paddingHorizontal: 23, paddingTop: 20 }, back: { color: "#63766A", fontSize: 14, fontWeight: "600" }, title: { color: "#1F3029", fontSize: 28, fontWeight: "700", letterSpacing: -0.8, marginTop: 24 }, subtitle: { color: "#7D8780", fontSize: 14, marginTop: 6 }, search: { height: 48, backgroundColor: "#FFFFFF", borderRadius: 15, paddingHorizontal: 14, color: "#1F3029", marginTop: 19, borderWidth: 1, borderColor: "#EAEEE8" }, list: { paddingHorizontal: 23, paddingTop: 21, paddingBottom: 40, flexGrow: 1 }, row: { flexDirection: "row", minHeight: 92 }, marker: { alignItems: "center", width: 20 }, dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#5A795F", marginTop: 4 }, line: { flex: 1, width: 1, backgroundColor: "#D9E2D9", marginTop: 5 }, entry: { paddingLeft: 10, flex: 1, paddingBottom: 19 }, date: { color: "#34463B", fontSize: 15, fontWeight: "700" }, time: { color: "#7B867D", fontSize: 12, marginTop: 4 }, note: { color: "#66736A", fontSize: 13, marginTop: 7 }, actions: { flexDirection: "row", gap: 16, marginTop: 10 }, action: { color: "#315B45", fontSize: 12, fontWeight: "700" }, delete: { color: "#A35B4A" }, empty: { color: "#89938B", fontSize: 14, textAlign: "center", marginTop: 45 } });

