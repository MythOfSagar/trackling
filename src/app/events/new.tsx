import { goBack } from "@/utils/navigation";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getCategories } from "@/database/repository";
import { useEventsStore } from "@/store/events";
import type { Category, ReminderUnit } from "@/types/models";
import { PrimaryButton } from "@/components/PrimaryButton";
import { scheduleEventReminder } from "@/features/reminders/scheduleReminder";
import { usePreferencesStore } from "@/store/preferences";
import AsyncStorage from "@react-native-async-storage/async-storage";

const icons = ["🏋️", "✂️", "🛏️", "🪴", "📚", "🚿", "🧹", "🚗", "💊", "🎨", "☕", "✦"];
const colors = ["#E8EFF7", "#F5EAF0", "#E9F1E9", "#F5EFE2", "#E9EBF4", "#F3ECDD"];

export default function CreateEventScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const db = useSQLiteContext();
  const addEvent = useEventsStore((state) => state.addEvent);
  const defaultReminderInterval = usePreferencesStore((state) => state.defaultReminderInterval);
  const defaultReminderUnit = usePreferencesStore((state) => state.defaultReminderUnit);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(icons[0]);
  const [color, setColor] = useState(colors[0]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState(String(defaultReminderInterval));
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>(defaultReminderUnit);

  useFocusEffect(useCallback(() => { void getCategories(db).then((items) => { setCategories(items); setCategoryId((current) => current && items.some((item) => item.id === current) ? current : items[0]?.id ?? null); }); }, [db]));

  const save = async () => {
    if (!name.trim()) { Alert.alert("Give it a name", "Add a name for the thing you want to track."); return; }
    if (!categoryId) {
      Alert.alert("Choose a category", categories.length === 0 ? "Create a category before saving this moment." : "Select a category for this moment.", categories.length === 0 ? [
        { text: "Cancel", style: "cancel" },
        { text: "Create category", onPress: () => router.push("/categories") },
      ] : undefined);
      return;
    }
    const interval = Number(reminderInterval);
    if (reminderEnabled && (!Number.isInteger(interval) || interval < 1 || interval > 999)) { Alert.alert("Check the reminder interval", "Enter a whole number from 1 to 999."); return; }
    setSaving(true);
    try {
      const eventId = await addEvent(db, { name, description, icon, color, categoryId, reminderInterval: reminderEnabled ? interval : undefined, reminderUnit });
      if (reminderEnabled && await AsyncStorage.getItem("little-again:reminders-enabled") !== "false") {
        try {
          const notificationId = await scheduleEventReminder(eventId, name.trim(), interval, reminderUnit);
          if (notificationId) await db.runAsync("UPDATE events SET reminder_config = ? WHERE id = ?", JSON.stringify({ interval, unit: reminderUnit, notificationId }), eventId);
        } catch {
          await db.runAsync("UPDATE events SET reminder_enabled = 0, reminder_config = NULL WHERE id = ?", eventId);
          await useEventsStore.getState().load(db);
          Alert.alert("Moment created", "Notifications weren’t enabled, so a reminder couldn’t be scheduled. You can turn them on in device settings.");
        }
      }
      goBack();
    }
    catch (error) {
      Alert.alert("Couldn’t create this yet", error instanceof Error ? error.message : "Please try again.");
    }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={s(styles.safe)} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s(styles.content)} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => goBack()} style={s(styles.back)}><Text style={s(styles.backText)}>‹</Text><Text style={s(styles.backLabel)}>Back</Text></Pressable>
        <Text style={s(styles.eyebrow)}>A NEW LITTLE RITUAL</Text><Text style={s(styles.title)}>What would you like{`\n`}to remember?</Text><Text style={s(styles.subtitle)}>Create a moment to keep an eye on.</Text>
        <Text style={s(styles.label)}>NAME</Text><TextInput value={name} onChangeText={setName} placeholder="e.g. Morning walk" placeholderTextColor="#AAB0AA" style={s(styles.input)} autoFocus returnKeyType="next" maxLength={60} />
        <Text style={s(styles.label)}>PICK AN ICON</Text><View style={s(styles.iconGrid)}>{icons.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel={`Choose ${item} icon`} onPress={() => setIcon(item)} style={[s(styles.iconOption), icon === item && s(styles.iconOptionSelected)]}><Text style={s(styles.iconText)}>{item}</Text></Pressable>)}</View>
        <Text style={s(styles.label)}>COLOR</Text><View style={s(styles.colorRow)}>{colors.map((item) => <Pressable key={item} accessibilityRole="button" accessibilityLabel="Choose event color" onPress={() => setColor(item)} style={[s(styles.colorOption), { backgroundColor: item }, color === item && s(styles.colorSelected)]} />)}</View>
        <Text style={s(styles.label)}>CATEGORY</Text><View style={s(styles.categoryGrid)}>{categories.map((item) => <Pressable key={item.id} onPress={() => setCategoryId(item.id)} style={[s(styles.categoryOption), categoryId === item.id && s(styles.categorySelected)]}><Text style={s(styles.categoryIcon)}>{item.icon}</Text><Text style={[s(styles.categoryText), categoryId === item.id && s(styles.categoryTextSelected)]}>{item.name}</Text></Pressable>)}</View>{categories.length === 0 ? <Pressable onPress={() => router.push("/categories")}><Text style={s(styles.reminderHint)}>Create a category to continue</Text></Pressable> : null}
        <Text style={s(styles.label)}>DESCRIPTION <Text style={s(styles.optional)}>· OPTIONAL</Text></Text><TextInput value={description} onChangeText={setDescription} placeholder="A little context, if you like" placeholderTextColor="#AAB0AA" style={[s(styles.input), s(styles.description)]} multiline maxLength={180} />
        <View style={s(styles.reminderRow)}><View><Text style={s(styles.reminderTitle)}>Gentle reminder</Text><Text style={s(styles.reminderHint)}>A local notification, just for you</Text></View><Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ false: "#DDE2DB", true: "#91AA93" }} thumbColor={reminderEnabled ? "#315B45" : "#FFFFFF"} accessibilityLabel="Enable a reminder" /></View>
        {reminderEnabled && <><Text style={s(styles.reminderHint)}>Remind me every</Text><View style={s(styles.intervalRow)}><TextInput value={reminderInterval} onChangeText={setReminderInterval} keyboardType="number-pad" maxLength={3} style={s(styles.input)} accessibilityLabel="Reminder interval" /><Text style={s(styles.reminderHint)}>units</Text></View><View style={s(styles.intervalRow)}>{(["minute", "hour", "day", "week", "month", "year"] as ReminderUnit[]).map((unit) => <Pressable key={unit} onPress={() => setReminderUnit(unit)} style={[s(styles.interval), reminderUnit === unit && s(styles.intervalActive)]}><Text style={[s(styles.intervalText), reminderUnit === unit && s(styles.intervalTextActive)]}>{unit}{Number(reminderInterval) === 1 ? "" : "s"}</Text></Pressable>)}</View><Text style={s(styles.reminderHint)}>Month and year intervals use 30 and 365 days.</Text></>}
        <PrimaryButton title="Create moment  ↗" onPress={() => void save()} loading={saving} style={s(styles.submit)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 18, paddingBottom: 42 }, back: { flexDirection: "row", alignItems: "center", marginBottom: 30, gap: 7 }, backText: { color: "#315B45", fontSize: 30, lineHeight: 30 }, backLabel: { color: "#6E7A70", fontSize: 14, fontWeight: "600" }, eyebrow: { color: "#778A78", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 }, title: { color: "#1F3029", fontSize: 31, lineHeight: 37, fontWeight: "700", letterSpacing: -1, marginTop: 10 }, subtitle: { color: "#7D8780", fontSize: 14, marginTop: 9, marginBottom: 28 }, label: { color: "#858E86", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10, marginTop: 18 }, optional: { color: "#ABB1AB", fontWeight: "600", letterSpacing: 0.4 }, input: { height: 54, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECE7", paddingHorizontal: 15, color: "#1F3029", fontSize: 15 }, description: { height: 76, paddingTop: 14, textAlignVertical: "top" }, iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 9 }, iconOption: { width: 49, height: 49, backgroundColor: "#FFFFFF", borderRadius: 16, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#ECEEE9" }, iconOptionSelected: { borderColor: "#315B45", backgroundColor: "#E7EFE6", borderWidth: 2 }, iconText: { fontSize: 22 }, colorRow: { flexDirection: "row", gap: 13, alignItems: "center" }, colorOption: { height: 37, width: 37, borderRadius: 13, borderWidth: 1, borderColor: "#FFFFFF" }, colorSelected: { borderWidth: 3, borderColor: "#315B45" }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, categoryOption: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9, paddingHorizontal: 12, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#ECEEE9" }, categorySelected: { backgroundColor: "#E8EFE7", borderColor: "#9EB5A0" }, categoryIcon: { fontSize: 13 }, categoryText: { color: "#727D74", fontSize: 12, fontWeight: "600" }, categoryTextSelected: { color: "#315B45" }, reminderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#FFFFFF", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 11, marginTop: 22 }, reminderTitle: { color: "#34463B", fontSize: 14, fontWeight: "700" }, reminderHint: { color: "#8A948C", fontSize: 11, marginTop: 3 }, intervalRow: { flexDirection: "row", gap: 8, marginTop: 11 }, interval: { paddingVertical: 9, paddingHorizontal: 12, borderRadius: 12, backgroundColor: "#ECEEE9" }, intervalActive: { backgroundColor: "#DCE9DC" }, intervalText: { color: "#7E8980", fontSize: 11, fontWeight: "600" }, intervalTextActive: { color: "#315B45" }, submit: { marginTop: 29 },
});

