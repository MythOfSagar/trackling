import { goBack } from "@/utils/navigation";
import { usePreferencesStore } from "@/store/preferences";
import { createThemeStyle } from "@/utils/theme";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { getEvents, updateEntry } from "@/database/repository";
import { useEventsStore } from "@/store/events";
import type { EventItem } from "@/types/models";
import { PrimaryButton } from "@/components/PrimaryButton";
import { refreshEventReminder } from "@/features/reminders/scheduleReminder";

function localDateTime(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function parseLocalDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || date.getHours() !== Number(hour) || date.getMinutes() !== Number(minute)) return null;
  return date;
}

export default function AddEntryScreen() {
  const darkMode = usePreferencesStore((state) => state.darkMode);
  const s = createThemeStyle(darkMode);

  const { eventId, entryId, date } = useLocalSearchParams<{ eventId: string; entryId?: string; date?: string }>();
  const db = useSQLiteContext();
  const addEntry = useEventsStore((state) => state.addEntry);
  const [event, setEvent] = useState<EventItem | null>(null);
  const [occurredAt, setOccurredAt] = useState(date ? `${date} 12:00` : localDateTime(new Date()));
  const [title, setTitle] = useState("Recorded moment");
  const [note, setNote] = useState("");
  const [numericValue, setNumericValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void Promise.all([
      getEvents(db).then((items) => { const found = items.find((item) => item.id === Number(eventId)) ?? null; setEvent(found); if (found && !entryId) setTitle(found.name); }),
      entryId ? db.getFirstAsync<{ occurredAt: string; title: string | null; note: string | null; numericValue: number | null }>("SELECT occurred_at AS occurredAt, title, note, numeric_value AS numericValue FROM entries WHERE id = ?", Number(entryId)) : Promise.resolve(null),
    ]).then(([, entry]) => { if (entry) { setOccurredAt(localDateTime(new Date(entry.occurredAt))); setTitle(entry.title ?? "Recorded moment"); setNote(entry.note ?? ""); setNumericValue(entry.numericValue === null ? "" : String(entry.numericValue)); } });
  }, [db, eventId, entryId]);

  const save = async () => {
    const parsed = parseLocalDateTime(occurredAt);
    if (!parsed) { Alert.alert("Check the date and time", "Use YYYY-MM-DD HH:mm, for example 2026-10-08 19:30."); return; }
    if (parsed.getTime() > Date.now() + 60_000) { Alert.alert("That time is in the future", "Choose a time that has already happened."); return; }
    if (numericValue.trim() && !Number.isFinite(Number(numericValue))) { Alert.alert("Check the number", "Enter a valid numeric value or leave it blank."); return; }
    setSaving(true);
    try {
      const input = { eventId: Number(eventId), occurredAt: parsed.toISOString(), title, note, numericValue: numericValue.trim() ? Number(numericValue) : null };
      if (entryId) {
        await updateEntry(db, Number(entryId), input);
        await refreshEventReminder(db, Number(eventId));
        await useEventsStore.getState().load(db);
      } else await addEntry(db, input);
      goBack();
    } catch { Alert.alert("Couldn’t save this entry", "Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <KeyboardAvoidingView style={s(styles.safe)} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={s(styles.content)} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => goBack()} style={s(styles.back)}><Text style={s(styles.backText)}>‹  Back</Text></Pressable>
        <View style={s(styles.eventHead)}><View style={[s(styles.iconBox), { backgroundColor: event?.color ?? "#E8EFE7" }]}><Text style={s(styles.icon)}>{event?.icon ?? "✳"}</Text></View><View><Text style={s(styles.eyebrow)}>{entryId ? "EDIT A MOMENT" : "ADD A MOMENT"}</Text><Text style={s(styles.title)}>{event?.name ?? "New entry"}</Text></View></View>
        <Text style={s(styles.intro)}>Log when it happened. Your timeline will update right away.</Text>
        <Text style={s(styles.label)}>DATE & TIME</Text><TextInput value={occurredAt} onChangeText={setOccurredAt} style={s(styles.input)} autoCapitalize="none" autoCorrect={false} accessibilityLabel="Date and time, year month day and 24 hour time" />
        <Text style={s(styles.hint)}>Local time · YYYY-MM-DD HH:mm</Text>
        <Pressable onPress={() => setOccurredAt(localDateTime(new Date()))} style={s(styles.nowButton)}><Text style={s(styles.nowText)}>Use current time</Text></Pressable>
        <Text style={s(styles.label)}>TITLE</Text><TextInput value={title} onChangeText={setTitle} style={s(styles.input)} placeholder="Recorded moment" placeholderTextColor="#AAB0AA" maxLength={80} />
        <Text style={s(styles.label)}>DESCRIPTION <Text style={s(styles.optional)}>· OPTIONAL</Text></Text><TextInput value={note} onChangeText={setNote} style={[s(styles.input), s(styles.multiline)]} placeholder="Add a detail, or save it as is" placeholderTextColor="#AAB0AA" multiline maxLength={500} />
        <Text style={s(styles.label)}>NUMBER <Text style={s(styles.optional)}>· OPTIONAL</Text></Text><TextInput value={numericValue} onChangeText={setNumericValue} style={s(styles.input)} placeholder="e.g. 80" placeholderTextColor="#AAB0AA" keyboardType="decimal-pad" />
        <PrimaryButton title="Save entry  ↗" onPress={() => void save()} loading={saving} style={s(styles.submit)} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: "#F6F7F3" }, content: { paddingHorizontal: 23, paddingTop: 18, paddingBottom: 42 }, back: { marginBottom: 29 }, backText: { color: "#63766A", fontSize: 14, fontWeight: "600" }, eventHead: { flexDirection: "row", alignItems: "center", gap: 13 }, iconBox: { width: 54, height: 54, borderRadius: 19, alignItems: "center", justifyContent: "center" }, icon: { fontSize: 24 }, eyebrow: { color: "#819184", fontSize: 10, fontWeight: "800", letterSpacing: 1.2 }, title: { color: "#1F3029", fontSize: 26, fontWeight: "700", letterSpacing: -0.7, marginTop: 3 }, intro: { color: "#7D8780", fontSize: 14, lineHeight: 21, marginTop: 17, marginBottom: 16 }, label: { color: "#858E86", fontSize: 10, fontWeight: "800", letterSpacing: 1.2, marginBottom: 10, marginTop: 20 }, optional: { color: "#ABB1AB", fontWeight: "600", letterSpacing: 0.4 }, input: { minHeight: 54, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E9ECE7", paddingHorizontal: 15, color: "#1F3029", fontSize: 15 }, multiline: { minHeight: 90, textAlignVertical: "top", paddingTop: 14 }, hint: { color: "#9AA39B", fontSize: 11, marginTop: 7 }, nowButton: { alignSelf: "flex-start", backgroundColor: "#E8EFE7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: 12 }, nowText: { color: "#315B45", fontWeight: "700", fontSize: 12 }, submit: { marginTop: 30 } });

