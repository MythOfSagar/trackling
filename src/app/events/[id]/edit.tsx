import { goBack } from "@/utils/navigation";
import { createThemeStyle } from "@/utils/theme";
import { useCallback, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { cancelScheduledReminder } from "@/features/reminders/notifications";
import { getCategories, updateEvent } from "@/database/repository";
import { useEventsStore } from "@/store/events";
import { scheduleEventReminder } from "@/features/reminders/scheduleReminder";
import { usePreferencesStore } from "@/store/preferences";
import type { Category, EventItem, ReminderUnit } from "@/types/models";
import { PrimaryButton } from "@/components/PrimaryButton";

const icons = ["🏋️", "✂️", "🛏️", "🪴", "📚", "🚿", "🧹", "🚗", "💊", "🎨", "☕", "✦"];
const colors = ["#E8EFF7", "#F5EAF0", "#E9F1E9", "#F5EFE2", "#E9EBF4", "#F3ECDD"];

export default function EditEventScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const reload = useEventsStore((state) => state.load);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState(icons[0]);
  const [color, setColor] = useState(colors[0]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderInterval, setReminderInterval] = useState("3");
  const [reminderUnit, setReminderUnit] = useState<ReminderUnit>("day");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [allEvents, allCategories, row] = await Promise.all([
      getCategories(db),
      db.getAllAsync<EventItem>(`SELECT e.id, e.name, e.icon, e.color, e.category_id AS categoryId, c.name AS categoryName, e.description, e.created_at AS createdAt, e.updated_at AS updatedAt, MAX(en.occurred_at) AS lastOccurredAt, COUNT(en.id) AS entryCount, e.reminder_enabled AS reminderEnabled FROM events e JOIN categories c ON c.id = e.category_id LEFT JOIN entries en ON en.event_id = e.id WHERE e.id = ? GROUP BY e.id`, Number(id)),
      db.getFirstAsync<{ reminderConfig: string | null }>("SELECT reminder_config AS reminderConfig FROM events WHERE id = ?", Number(id)),
    ]);
    setCategories(allEvents);
    const found = allCategories[0];
    if (found) { setEvent({ ...found, reminderEnabled: Number(found.reminderEnabled) === 1 }); setName(found.name); setDescription(found.description ?? ""); setIcon(found.icon); setColor(found.color); setCategoryId(found.categoryId); setReminderEnabled(Number(found.reminderEnabled) === 1); }
    if (row?.reminderConfig) { try { const config = JSON.parse(row.reminderConfig) as { interval?: number; unit?: ReminderUnit; intervalDays?: number }; const interval = config.interval ?? config.intervalDays; if (interval) setReminderInterval(String(interval)); if (config.unit) setReminderUnit(config.unit); } catch { /* Ignore malformed legacy reminder configuration. */ } }
  }, [db, id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    if (!name.trim() || !categoryId) { Alert.alert("Check the details", "A name and category are needed."); return; }
    const interval = Number(reminderInterval);
    if (reminderEnabled && (!Number.isInteger(interval) || interval < 1 || interval > 999)) { Alert.alert("Check the reminder interval", "Enter a whole number from 1 to 999."); return; }
    setSaving(true);
    try {
      const old = await db.getFirstAsync<{ reminderConfig: string | null }>("SELECT reminder_config AS reminderConfig FROM events WHERE id = ?", Number(id));
      const oldConfig = old?.reminderConfig ? JSON.parse(old.reminderConfig) as { notificationId?: string } : null;
      if (!reminderEnabled && oldConfig?.notificationId) await cancelScheduledReminder(oldConfig.notificationId);
      await updateEvent(db, Number(id), { name, description, icon, color, categoryId, reminderInterval: reminderEnabled ? interval : undefined, reminderUnit, reminderEnabled });
      if (reminderEnabled) {
        const permission = await AsyncStorage.getItem("little-again:reminders-enabled");
        if (permission !== "false") {
          if (oldConfig?.notificationId) await cancelScheduledReminder(oldConfig.notificationId);
          const notificationId = await scheduleEventReminder(Number(id), name.trim(), interval, reminderUnit);
          if (notificationId) await db.runAsync("UPDATE events SET reminder_config = ? WHERE id = ?", JSON.stringify({ interval, unit: reminderUnit, notificationId }), Number(id));
        }
      }
      await reload(db); goBack();
    } catch { Alert.alert("Couldn’t update this moment", "Please check notification permissions and try again."); }
    finally { setSaving(false); }
  };

  const remove = () => Alert.alert("Delete this moment?", "Its entry history will also be deleted from this device.", [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: () => { void (async () => { const row = await db.getFirstAsync<{ reminderConfig: string | null }>("SELECT reminder_config AS reminderConfig FROM events WHERE id = ?", Number(id)); if (row?.reminderConfig) { try { const config = JSON.parse(row.reminderConfig) as { notificationId?: string }; if (config.notificationId) await cancelScheduledReminder(config.notificationId); } catch { /* Continue removing local event data. */ } } await db.runAsync("DELETE FROM events WHERE id = ?", Number(id)); await reload(db); router.replace("/"); })().catch(() => Alert.alert("Couldn’t delete this moment", "Please try again.")); } }]);

  if (!event) return <View style={s(styles.safe)}><Text style={s(styles.missing)}>Loading moment…</Text></View>;
  return <ScrollView style={s(styles.safe)} contentContainerStyle={s(styles.content)}><Pressable onPress={() => goBack()}><Text style={s(styles.back)}>‹  Back</Text></Pressable><Text style={s(styles.eyebrow)}>MAKE IT YOURS</Text><Text style={s(styles.title)}>Edit moment</Text><Text style={s(styles.label)}>NAME</Text><TextInput value={name} onChangeText={setName} style={s(styles.input)} maxLength={60} /><Text style={s(styles.label)}>ICON</Text><View style={s(styles.options)}>{icons.map((value) => <Pressable key={value} onPress={() => setIcon(value)} style={[s(styles.icon), value === icon && s(styles.selected)]}><Text>{value}</Text></Pressable>)}</View><Text style={s(styles.label)}>COLOR</Text><View style={s(styles.options)}>{colors.map((value) => <Pressable key={value} onPress={() => setColor(value)} style={[s(styles.color), { backgroundColor: value }, value === color && s(styles.colorSelected)]} />)}</View><Text style={s(styles.label)}>CATEGORY</Text><View style={s(styles.options)}>{categories.map((item) => <Pressable key={item.id} onPress={() => setCategoryId(item.id)} style={[s(styles.category), item.id === categoryId && s(styles.selected)]}><Text style={s(styles.categoryText)}>{item.icon}  {item.name}</Text></Pressable>)}</View><Text style={s(styles.label)}>DESCRIPTION</Text><TextInput value={description} onChangeText={setDescription} style={[s(styles.input), s(styles.multiline)]} multiline maxLength={180} /><View style={s(styles.reminder)}><View style={{ flex: 1 }}><Text style={s(styles.reminderTitle)}>Gentle reminder</Text><Text style={s(styles.hint)}>Repeats every {reminderInterval} {reminderUnit}{Number(reminderInterval) === 1 ? "" : "s"}</Text></View><Switch value={reminderEnabled} onValueChange={setReminderEnabled} trackColor={{ false: "#DDE2DB", true: "#91AA93" }} thumbColor={reminderEnabled ? "#315B45" : "#FFFFFF"} /></View>{reminderEnabled && <><View style={s(styles.options)}><TextInput value={reminderInterval} onChangeText={setReminderInterval} keyboardType="number-pad" maxLength={3} style={s(styles.input)} accessibilityLabel="Reminder interval" />{(["minute", "hour", "day", "week", "month", "year"] as ReminderUnit[]).map((unit) => <Pressable key={unit} onPress={() => setReminderUnit(unit)} style={[s(styles.category), reminderUnit === unit && s(styles.selected)]}><Text style={s(styles.categoryText)}>{unit}{Number(reminderInterval) === 1 ? "" : "s"}</Text></Pressable>)}</View><Text style={s(styles.hint)}>Month and year intervals use 30 and 365 days.</Text></>}<PrimaryButton title="Save changes" onPress={() => void save()} loading={saving} style={s(styles.save)} /><Pressable onPress={remove} style={s(styles.delete)}><Text style={s(styles.deleteText)}>Delete this moment</Text></Pressable></ScrollView>;
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 20, paddingBottom: 45 }, missing: { color: "#34463B", margin: 24 }, back: { color: "#63766A", fontSize: 14, fontWeight: "600", marginBottom: 26 }, eyebrow: { color: "#778A78", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, title: { color: "#1F3029", fontSize: 30, fontWeight: "700", letterSpacing: -0.9, marginTop: 6 }, label: { color: "#858E86", fontSize: 10, fontWeight: "800", letterSpacing: 1.1, marginTop: 20, marginBottom: 10 }, input: { height: 52, borderRadius: 15, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECE7", paddingHorizontal: 14, color: "#1F3029", fontSize: 14 }, multiline: { minHeight: 76, paddingTop: 13, textAlignVertical: "top" }, options: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, icon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "transparent" }, selected: { borderColor: "#315B45", backgroundColor: "#E8EFE7" }, color: { width: 30, height: 30, borderRadius: 10 }, colorSelected: { borderWidth: 2, borderColor: "#315B45" }, category: { paddingHorizontal: 11, paddingVertical: 9, borderRadius: 13, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "transparent" }, categoryText: { color: "#647168", fontSize: 11, fontWeight: "600" }, reminder: { flexDirection: "row", alignItems: "center", padding: 13, backgroundColor: "#FFFFFF", borderRadius: 16, marginTop: 20 }, reminderTitle: { color: "#34463B", fontSize: 13, fontWeight: "700" }, hint: { color: "#88938A", fontSize: 11, marginTop: 4 }, save: { marginTop: 24 }, delete: { alignItems: "center", padding: 15, marginTop: 5 }, deleteText: { color: "#A35B4A", fontSize: 13, fontWeight: "700" } });

