import { goBack } from "@/utils/navigation";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { usePreferencesStore } from "@/store/preferences";
import { formatClock } from "@/utils/elapsed";

type CalendarEntry = { id: number; occurredAt: string; title: string; note: string | null; numericValue: number | null };
type StoredDay = { day: string; count: number };
const pad = (value: number) => String(value).padStart(2, "0");
const keyFor = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export default function EventCalendarScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const use24Hour = usePreferencesStore((state) => state.use24Hour);
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState(() => keyFor(new Date()));
  const [days, setDays] = useState<StoredDay[]>([]);
  const [entries, setEntries] = useState<CalendarEntry[]>([]);
  const [name, setName] = useState("Calendar");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const first = new Date(month.getFullYear(), month.getMonth(), 1);
      const start = new Date(first.getTime() - 86_400_000).toISOString();
      const end = new Date(month.getFullYear(), month.getMonth() + 1, 2).toISOString();
      const [rows, event] = await Promise.all([
        db.getAllAsync<CalendarEntry>("SELECT id, occurred_at AS occurredAt, title, note, numeric_value AS numericValue FROM entries WHERE event_id = ? AND occurred_at >= ? AND occurred_at < ? ORDER BY occurred_at", Number(id), start, end),
        db.getFirstAsync<{ name: string }>("SELECT name FROM events WHERE id = ?", Number(id)),
      ]);
      const grouped = new Map<string, number>();
      for (const row of rows) { const key = keyFor(new Date(row.occurredAt)); grouped.set(key, (grouped.get(key) ?? 0) + 1); }
      setDays(Array.from(grouped, ([day, count]) => ({ day, count })));
      setEntries(rows.filter((row) => keyFor(new Date(row.occurredAt)) === selected));
      setName(event?.name ?? "Calendar");
    } finally { setLoading(false); }
  }, [db, id, month, selected]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const cells = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first.getDay()).fill(null), ...Array.from({ length: count }, (_, index) => index + 1)];
  }, [month]);
  const monthTitle = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" }).format(month);
  const dates = new Set(days.map((item) => item.day));

  const changeMonth = (offset: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + offset, 1);
    setMonth(next); setSelected(keyFor(new Date(next.getFullYear(), next.getMonth(), 1)));
  };

  return <ScrollView style={s(styles.safe)} contentContainerStyle={s(styles.content)}><Pressable onPress={() => goBack()}><Text style={s(styles.back)}>‹  Back</Text></Pressable><Text style={s(styles.title)}>{name}</Text><Text style={s(styles.subtitle)}>Your moments, day by day.</Text>
    <View style={s(styles.calendar)}><View style={s(styles.monthRow)}><Pressable onPress={() => changeMonth(-1)} style={s(styles.monthButton)}><Text style={s(styles.monthArrow)}>‹</Text></Pressable><Text style={s(styles.monthTitle)}>{monthTitle}</Text><Pressable onPress={() => changeMonth(1)} style={s(styles.monthButton)}><Text style={s(styles.monthArrow)}>›</Text></Pressable></View>
      <View style={s(styles.grid)}>{["S", "M", "T", "W", "T", "F", "S"].map((weekday, index) => <Text key={`${weekday}${index}`} style={s(styles.weekday)}>{weekday}</Text>)}{cells.map((day, index) => { if (day === null) return <View key={`blank-${index}`} style={s(styles.dayCell)} />; const dateKey = keyFor(new Date(month.getFullYear(), month.getMonth(), day)); const marked = dates.has(dateKey); return <Pressable key={dateKey} onPress={() => setSelected(dateKey)} style={s(styles.dayCell)}><View style={[s(styles.dayCircle), selected === dateKey && s(styles.daySelected)]}><Text style={[s(styles.dayText), selected === dateKey && s(styles.dayTextSelected)]}>{day}</Text></View><View style={[s(styles.dayMark), marked && s(styles.dayMarked)]} /></Pressable>; })}</View>
    </View>
    <View style={s(styles.dayHeading)}><View><Text style={s(styles.dayTitle)}>{new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric" }).format(new Date(`${selected}T12:00:00`))}</Text><Text style={s(styles.daySubtitle)}>{entries.length} {entries.length === 1 ? "moment" : "moments"}</Text></View><Pressable onPress={() => router.push({ pathname: "/entries/new", params: { eventId: String(id), date: selected } })} style={s(styles.add)}><Text style={s(styles.addText)}>＋ Add</Text></Pressable></View>
    {loading ? <ActivityIndicator color="#315B45" style={{ marginTop: 24 }} /> : entries.length ? entries.map((entry) => <View key={entry.id} style={s(styles.entry)}><Text style={s(styles.entryTime)}>{formatClock(entry.occurredAt, use24Hour)}</Text><Text style={s(styles.entryNote)}>{entry.title}{entry.note ? ` � ${entry.note}` : ""}</Text>{entry.numericValue !== null ? <Text style={s(styles.entryValue)}>{entry.numericValue}</Text> : null}</View>) : <Text style={s(styles.empty)}>Nothing recorded for this day.</Text>}
  </ScrollView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 20, paddingBottom: 42 }, back: { color: "#63766A", fontSize: 14, fontWeight: "600" }, title: { color: "#1F3029", fontSize: 30, fontWeight: "700", letterSpacing: -0.9, marginTop: 24 }, subtitle: { color: "#7D8780", fontSize: 14, marginTop: 6 }, calendar: { padding: 16, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: "#EBEEE9", marginTop: 24 }, monthRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 }, monthButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center" }, monthArrow: { color: "#496450", fontSize: 27 }, monthTitle: { color: "#304239", fontSize: 16, fontWeight: "700" }, grid: { flexDirection: "row", flexWrap: "wrap" }, weekday: { width: "14.2857%", textAlign: "center", color: "#A0A79F", fontSize: 10, fontWeight: "700", paddingBottom: 8 }, dayCell: { width: "14.2857%", height: 45, alignItems: "center", justifyContent: "center" }, dayCircle: { width: 33, height: 33, alignItems: "center", justifyContent: "center", borderRadius: 12 }, daySelected: { backgroundColor: "#315B45" }, dayText: { color: "#506056", fontSize: 12 }, dayTextSelected: { color: "#FFFFFF", fontWeight: "700" }, dayMark: { position: "absolute", bottom: 1, width: 4, height: 4, borderRadius: 2 }, dayMarked: { backgroundColor: "#719276" }, dayHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 28, marginBottom: 14 }, dayTitle: { color: "#34463B", fontSize: 18, fontWeight: "700" }, daySubtitle: { color: "#89938B", fontSize: 12, marginTop: 4 }, add: { backgroundColor: "#E8EFE7", paddingVertical: 10, paddingHorizontal: 13, borderRadius: 13 }, addText: { color: "#315B45", fontWeight: "700", fontSize: 12 }, entry: { padding: 15, borderRadius: 16, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", marginBottom: 9 }, entryTime: { color: "#718075", fontSize: 12, width: 73 }, entryNote: { color: "#34463B", fontWeight: "600", flex: 1, fontSize: 13 }, entryValue: { color: "#315B45", fontWeight: "700", fontSize: 12 }, empty: { color: "#89938B", fontSize: 13, textAlign: "center", marginTop: 15 } });

