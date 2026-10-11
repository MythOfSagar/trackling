import { goBack } from "@/utils/navigation";
import { usePreferencesStore } from "@/store/preferences";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCategories } from "@/database/repository";
import type { Category } from "@/types/models";

const icons = ["✳️", "◉", "♡", "⌂", "▤", "◇", "✦", "☀", "☕", "♧"];
const colors = ["#E9F1E9", "#E8EFF7", "#F5EAF0", "#F5EFE2", "#E9EBF4", "#F3ECDD"];

export default function CategoriesScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const db = useSQLiteContext();
  const [items, setItems] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(icons[0]);
  const [color, setColor] = useState(colors[0]);
  const load = useCallback(async () => setItems(await getCategories(db)), [db]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const add = async () => {
    if (!name.trim()) { Alert.alert("Name your category", "Enter a short category name first."); return; }
    try { await db.runAsync("INSERT INTO categories (name, icon, color, created_at) VALUES (?, ?, ?, ?)", name.trim(), icon, color, new Date().toISOString()); setName(""); await load(); }
    catch { Alert.alert("Category not added", "A category with that name may already exist."); }
  };
  return <ScrollView style={s(styles.safe)} contentContainerStyle={s(styles.content)}><Pressable onPress={() => goBack()}><Text style={s(styles.back)}>‹  Settings</Text></Pressable><Text style={s(styles.title)}>Categories</Text><Text style={s(styles.subtitle)}>Group the moments you track.</Text><View style={s(styles.card)}><Text style={s(styles.label)}>NEW CATEGORY</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Garden" placeholderTextColor="#AAB0AA" style={s(styles.input)} maxLength={32} /><View style={s(styles.options)}>{icons.map((item) => <Pressable key={item} onPress={() => setIcon(item)} style={[s(styles.iconOption), icon === item && s(styles.selected)]}><Text>{item}</Text></Pressable>)}</View><View style={s(styles.options)}>{colors.map((item) => <Pressable key={item} onPress={() => setColor(item)} style={[s(styles.color), { backgroundColor: item }, color === item && s(styles.colorSelected)]} />)}</View><Pressable onPress={() => void add()} style={s(styles.create)}><Text style={s(styles.createText)}>Add category</Text></Pressable></View><Text style={s(styles.label)}>ALL CATEGORIES</Text>{items.map((item) => <View key={item.id} style={s(styles.item)}><View style={[s(styles.itemIcon), { backgroundColor: item.color }]}><Text>{item.icon}</Text></View><Text style={s(styles.itemName)}>{item.name}</Text><Text style={s(styles.chevron)}>›</Text></View>)}</ScrollView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { padding: 23, paddingTop: 20, paddingBottom: 45 }, back: { color: "#63766A", fontSize: 14, fontWeight: "600" }, title: { color: "#1F3029", fontSize: 30, fontWeight: "700", letterSpacing: -0.9, marginTop: 24 }, subtitle: { color: "#7D8780", fontSize: 14, marginTop: 6, marginBottom: 23 }, card: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#EBEEE9", marginBottom: 26 }, label: { color: "#858E86", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, input: { height: 48, borderRadius: 14, backgroundColor: "#F7F8F5", paddingHorizontal: 13, color: "#1F3029", marginTop: 12 }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 13 }, iconOption: { width: 39, height: 39, borderRadius: 12, backgroundColor: "#F6F7F3", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" }, selected: { borderColor: "#315B45", backgroundColor: "#E8EFE7" }, color: { width: 28, height: 28, borderRadius: 10 }, colorSelected: { borderWidth: 2, borderColor: "#315B45" }, create: { minHeight: 45, backgroundColor: "#244D3B", borderRadius: 14, alignItems: "center", justifyContent: "center", marginTop: 16 }, createText: { color: "#FFFFFF", fontWeight: "700" }, item: { height: 59, flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 15, paddingHorizontal: 12, marginTop: 8 }, itemIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center" }, itemName: { color: "#34463B", fontSize: 14, fontWeight: "600", flex: 1, marginLeft: 11 }, chevron: { color: "#A5AEA5", fontSize: 20 } });

