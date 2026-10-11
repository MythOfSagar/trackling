import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import type { WidgetConfigurationScreenProps } from "react-native-android-widget";
import type { EventItem } from "@/types/models";
import { getEvents } from "@/database/repository";
import { EventWidget } from "./EventWidget";
import { eventWidgetStorageKey, pendingEventKey } from "./widgetStorage";

export function WidgetConfigurationScreen({ widgetInfo, renderWidget, setResult }: WidgetConfigurationScreenProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const db = await SQLite.openDatabaseAsync("lastlittlethings.db");
        const [items, pending, current] = await Promise.all([
          getEvents(db),
          AsyncStorage.getItem(pendingEventKey),
          AsyncStorage.getItem(eventWidgetStorageKey(widgetInfo.widgetId)),
        ]);
        await db.closeAsync();
        if (!active) return;
        setEvents(items);
        const preferred = Number(pending);
        const currentId = Number(current);
        setSelectedId(items.some((item) => item.id === preferred) ? preferred : items.some((item) => item.id === currentId) ? currentId : items[0]?.id ?? null);
      } catch {
        if (active) setEvents([]);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [widgetInfo.widgetId]);

  const choose = async () => {
    const event = events.find((item) => item.id === selectedId);
    if (!event) return;
    await AsyncStorage.setItem(eventWidgetStorageKey(widgetInfo.widgetId), String(event.id));
    await AsyncStorage.removeItem(pendingEventKey);
    renderWidget(<EventWidget event={event} width={widgetInfo.width} height={widgetInfo.height} />);
    setResult("ok");
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Choose a moment</Text>
      <Text style={styles.subtitle}>This widget will show its name and time since your last entry.</Text>
      {loading ? <ActivityIndicator color="#315B45" style={styles.loading} /> : events.length ? (
        <ScrollView contentContainerStyle={styles.list}>
          {events.map((event) => (
            <Pressable key={event.id} onPress={() => setSelectedId(event.id)} style={[styles.option, selectedId === event.id && styles.optionSelected]}>
              <Text style={styles.icon}>{event.icon}</Text>
              <View style={styles.optionText}><Text numberOfLines={1} style={styles.name}>{event.name}</Text><Text numberOfLines={1} style={styles.category}>{event.categoryName}</Text></View>
              {selectedId === event.id ? <Text style={styles.check}>✓</Text> : null}
            </Pressable>
          ))}
        </ScrollView>
      ) : <Text style={styles.empty}>Create an event in Little Again first, then add its widget.</Text>}
      <Pressable disabled={!selectedId || loading} onPress={() => void choose()} style={[styles.button, (!selectedId || loading) && styles.buttonDisabled]}>
        <Text style={styles.buttonText}>Add widget</Text>
      </Pressable>
      <Pressable onPress={() => { void AsyncStorage.removeItem(pendingEventKey); setResult("cancel"); }} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({ screen: { flex: 1, backgroundColor: "#F6F7F3", padding: 22 }, title: { fontSize: 23, fontWeight: "700", color: "#1F3029", marginTop: 8 }, subtitle: { fontSize: 14, lineHeight: 20, color: "#718078", marginTop: 7, marginBottom: 16 }, loading: { marginTop: 38 }, list: { gap: 8, paddingBottom: 8 }, option: { minHeight: 58, paddingHorizontal: 12, borderRadius: 15, backgroundColor: "#FFFFFF", flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#E9ECE7" }, optionSelected: { borderColor: "#315B45", backgroundColor: "#EAF0E9" }, icon: { fontSize: 21 }, optionText: { flex: 1 }, name: { color: "#34463B", fontWeight: "700", fontSize: 14 }, category: { color: "#849087", fontSize: 11, marginTop: 3 }, check: { color: "#315B45", fontWeight: "700", fontSize: 18 }, empty: { color: "#718078", fontSize: 14, marginTop: 24, lineHeight: 21 }, button: { minHeight: 48, borderRadius: 15, backgroundColor: "#244D3B", alignItems: "center", justifyContent: "center", marginTop: 12 }, buttonDisabled: { opacity: 0.45 }, buttonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 }, cancel: { alignSelf: "center", padding: 12 }, cancelText: { color: "#718078", fontWeight: "600" } });
