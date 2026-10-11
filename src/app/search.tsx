import { goBack } from "@/utils/navigation";
import { usePreferencesStore } from "@/store/preferences";
import { createThemeStyle } from "@/utils/theme";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";

type Result = { kind: "event" | "entry"; eventId: number; name: string; icon: string; color: string; occurredAt: string | null; title: string | null; note: string | null; categoryName: string };

export default function SearchScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const db = useSQLiteContext();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) return;
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      const pattern = `%${term}%`;
      void db.getAllAsync<Result>(`
        SELECT 'event' AS kind, e.id AS eventId, e.name, e.icon, e.color, NULL AS occurredAt, NULL AS title, e.description AS note, c.name AS categoryName
        FROM events e JOIN categories c ON c.id = e.category_id WHERE e.name LIKE ? OR c.name LIKE ? OR COALESCE(e.description, '') LIKE ?
        UNION ALL
        SELECT 'entry' AS kind, e.id AS eventId, e.name, e.icon, e.color, en.occurred_at AS occurredAt, en.title, en.note, c.name AS categoryName
        FROM entries en JOIN events e ON e.id = en.event_id JOIN categories c ON c.id = e.category_id
        WHERE COALESCE(en.title, '') LIKE ? OR COALESCE(en.note, '') LIKE ? OR en.occurred_at LIKE ? OR e.name LIKE ? OR c.name LIKE ?
        ORDER BY occurredAt DESC LIMIT 50
      `, pattern, pattern, pattern, pattern, pattern, pattern, pattern, pattern).then((items) => { if (active) setResults(items); }).catch(() => { if (active) setResults([]); }).finally(() => { if (active) setLoading(false); });
    }, 180);
    return () => { active = false; clearTimeout(timer); };
  }, [db, query]);

  return <View style={s(styles.safe)}><Pressable onPress={() => goBack()} style={s(styles.back)}><Text style={s(styles.backText)}>‹  Back</Text></Pressable><Text style={s(styles.title)}>Search your moments</Text><Text style={s(styles.subtitle)}>Find an event, note, category, or date.</Text><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="What are you looking for?" placeholderTextColor="#AAB0AA" style={s(styles.input)} returnKeyType="search" />
    {loading ? <ActivityIndicator color="#315B45" style={{ marginTop: 30 }} /> : <FlatList data={query.trim() ? results : []} keyExtractor={(item, index) => `${item.kind}-${item.eventId}-${item.occurredAt ?? ""}-${index}`} contentContainerStyle={s(styles.list)} keyboardShouldPersistTaps="handled" ListEmptyComponent={query.trim() ? <Text style={s(styles.empty)}>No moments found. Try another word.</Text> : <Text style={s(styles.empty)}>Start typing to search your local history.</Text>} renderItem={({ item }) => <Pressable onPress={() => router.push({ pathname: item.kind === "entry" ? "/events/[id]/history" : "/events/[id]", params: { id: String(item.eventId) } })} style={s(styles.result)}><View style={[s(styles.icon), { backgroundColor: item.color }]}><Text style={s(styles.emoji)}>{item.icon}</Text></View><View style={s(styles.resultText)}><Text style={s(styles.name)}>{item.name}</Text><Text numberOfLines={2} style={s(styles.detail)}>{item.title || item.note || item.categoryName}{item.occurredAt ? `  ·  ${new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(item.occurredAt))}` : ""}</Text></View><Text style={s(styles.arrow)}>↗</Text></Pressable>} />}
  </View>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3", paddingTop: 20 }, back: { marginHorizontal: 23 }, backText: { color: "#63766A", fontSize: 14, fontWeight: "600" }, title: { color: "#1F3029", fontSize: 29, fontWeight: "700", letterSpacing: -0.8, marginHorizontal: 23, marginTop: 26 }, subtitle: { color: "#7D8780", fontSize: 14, marginHorizontal: 23, marginTop: 6 }, input: { height: 52, marginHorizontal: 23, marginTop: 20, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECE7", borderRadius: 16, paddingHorizontal: 15, fontSize: 14, color: "#1F3029" }, list: { paddingHorizontal: 23, paddingTop: 15, paddingBottom: 40, flexGrow: 1 }, empty: { color: "#89938B", fontSize: 14, textAlign: "center", marginTop: 42 }, result: { flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 17, padding: 12, marginBottom: 9, borderWidth: 1, borderColor: "#EBEEE9" }, icon: { width: 42, height: 42, borderRadius: 15, alignItems: "center", justifyContent: "center" }, emoji: { fontSize: 21 }, resultText: { flex: 1, marginLeft: 11 }, name: { color: "#34463B", fontSize: 14, fontWeight: "700" }, detail: { color: "#859087", fontSize: 11, marginTop: 4 }, arrow: { color: "#A4AEA5", fontSize: 17, paddingHorizontal: 4 } });

