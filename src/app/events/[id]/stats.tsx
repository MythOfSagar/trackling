import { goBack } from "@/utils/navigation";
import { usePreferencesStore } from "@/store/preferences";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

type Stamp = { occurredAt: string; numericValue: number | null };
type MonthCount = { month: string; count: number };

export default function EventStatsScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const [months, setMonths] = useState<MonthCount[]>([]);
  const [name, setName] = useState("Statistics");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const [entries, event] = await Promise.all([
        db.getAllAsync<Stamp>("SELECT occurred_at AS occurredAt, numeric_value AS numericValue FROM entries WHERE event_id = ? ORDER BY occurred_at DESC LIMIT 10000", Number(id)),
        db.getFirstAsync<{ name: string }>("SELECT name FROM events WHERE id = ?", Number(id)),
      ]);
      setStamps(entries); setName(event?.name ?? "Statistics");
      const counts = await db.getAllAsync<{ month: string; count: number }>("SELECT strftime('%Y-%m', occurred_at) AS month, COUNT(*) AS count FROM entries WHERE event_id = ? GROUP BY month ORDER BY month DESC LIMIT 6", Number(id));
      setMonths(counts.reverse());
    } finally { setLoading(false); }
  }, [db, id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const intervals = stamps.slice(0, -1).map((item, index) => Math.max(0, new Date(item.occurredAt).getTime() - new Date(stamps[index + 1].occurredAt).getTime()) / 86_400_000);
  const average = intervals.length ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length : null;
  const numeric = stamps.map((item) => item.numericValue).filter((value): value is number => value !== null);
  const maxCount = Math.max(1, ...months.map((item) => item.count));
  const currentStreak = (() => { if (!stamps.length) return 0; let total = 1; for (let index = 1; index < stamps.length; index += 1) { if (new Date(stamps[index - 1].occurredAt).getTime() - new Date(stamps[index].occurredAt).getTime() <= 86_400_000) total += 1; else break; } return total; })();
  const longestStreak = (() => { if (!stamps.length) return 0; let best = 1; let run = 1; for (const interval of intervals) { if (interval <= 1) { run += 1; best = Math.max(best, run); } else run = 1; } return best; })();

  return <ScrollView style={s(styles.safe)} contentContainerStyle={s(styles.content)}><Pressable onPress={() => goBack()}><Text style={s(styles.back)}>‹  Back</Text></Pressable><Text style={s(styles.title)}>{name}</Text><Text style={s(styles.subtitle)}>A closer look at your rhythm.</Text>{loading ? <ActivityIndicator color="#315B45" style={{ marginTop: 32 }} /> : <>
    <Text style={s(styles.section)}>AT A GLANCE</Text><View style={s(styles.metrics)}><Metric value={String(stamps.length)} label="TOTAL ENTRIES" /><Metric value={`${currentStreak}`} label="CURRENT RUN" /><Metric value={`${longestStreak}`} label="LONGEST RUN" /></View><View style={s(styles.metrics)}><Metric value={average === null ? "—" : `${average.toFixed(1)}d`} label="AVG. INTERVAL" /><Metric value={intervals.length ? `${Math.min(...intervals).toFixed(0)}d` : "—"} label="SHORTEST" /><Metric value={intervals.length ? `${Math.max(...intervals).toFixed(0)}d` : "—"} label="LONGEST GAP" /></View>
    <View style={s(styles.metrics)}><Metric value={numeric.length ? (numeric.reduce((a, b) => a + b, 0) / numeric.length).toFixed(1) : "—"} label="AVG. VALUE" /></View>
    <Text style={s(styles.section)}>ENTRIES BY MONTH</Text><View style={s(styles.chart)}>{months.length ? months.map((month) => <View key={month.month} style={s(styles.barColumn)}><Text style={s(styles.barCount)}>{month.count}</Text><View style={s(styles.barTrack)}><View style={[s(styles.bar), { height: `${Math.max(6, month.count / maxCount * 100)}%` }]} /></View><Text style={s(styles.monthLabel)}>{new Intl.DateTimeFormat(undefined, { month: "short" }).format(new Date(`${month.month}-01T00:00:00`))}</Text></View>) : <Text style={s(styles.noData)}>Log a few moments to see your pattern here.</Text>}</View>
    {stamps.length > 0 && <View style={s(styles.range)}><Text style={s(styles.rangeLabel)}>FIRST RECORDED</Text><Text style={s(styles.rangeValue)}>{new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(stamps[stamps.length - 1].occurredAt))}</Text><Text style={[s(styles.rangeLabel), { marginTop: 16 }]}>MOST RECENT</Text><Text style={s(styles.rangeValue)}>{new Intl.DateTimeFormat(undefined, { month: "long", day: "numeric", year: "numeric" }).format(new Date(stamps[0].occurredAt))}</Text></View>}
  </>}</ScrollView>;
}

function Metric({ value, label }: { value: string; label: string }) { const darkMode = usePreferencesStore((state) => state.darkMode); const s = createThemeStyle(darkMode); return <View style={s(styles.metric)}><Text style={s(styles.metricValue)}>{value}</Text><Text style={s(styles.metricLabel)}>{label}</Text></View>; }

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 20, paddingBottom: 44 }, back: { color: "#63766A", fontSize: 14, fontWeight: "600" }, title: { color: "#1F3029", fontSize: 30, fontWeight: "700", letterSpacing: -0.9, marginTop: 24 }, subtitle: { color: "#7D8780", fontSize: 14, marginTop: 6 }, section: { color: "#88938A", fontSize: 10, fontWeight: "800", letterSpacing: 1.25, marginTop: 29, marginBottom: 12 }, metrics: { flexDirection: "row", gap: 9, marginBottom: 9 }, metric: { flex: 1, backgroundColor: "#FFFFFF", borderRadius: 17, padding: 14, minHeight: 82, borderWidth: 1, borderColor: "#EBEEE9", justifyContent: "center" }, metricValue: { color: "#315B45", fontSize: 21, fontWeight: "700" }, metricLabel: { color: "#929B93", fontSize: 8, fontWeight: "800", letterSpacing: 0.6, marginTop: 6 }, chart: { height: 190, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 1, borderColor: "#EBEEE9", padding: 17, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around" }, barColumn: { flex: 1, alignItems: "center", height: "100%", justifyContent: "flex-end" }, barCount: { color: "#829084", fontSize: 10, marginBottom: 6 }, barTrack: { height: 112, width: 24, justifyContent: "flex-end", backgroundColor: "#F2F4EF", borderRadius: 9, overflow: "hidden" }, bar: { width: "100%", backgroundColor: "#719276", borderRadius: 9 }, monthLabel: { color: "#89938A", fontSize: 10, marginTop: 7 }, noData: { color: "#89938A", fontSize: 13, textAlign: "center", alignSelf: "center" }, range: { backgroundColor: "#FFFFFF", padding: 18, borderRadius: 18, marginTop: 15 }, rangeLabel: { color: "#929B93", fontSize: 9, fontWeight: "800", letterSpacing: 0.9 }, rangeValue: { color: "#405247", fontSize: 14, fontWeight: "600", marginTop: 5 } });

