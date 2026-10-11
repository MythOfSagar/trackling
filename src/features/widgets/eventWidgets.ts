import React from "react";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import type { SQLiteDatabase } from "expo-sqlite";
import { getEvents } from "@/database/repository";
import { eventWidgetStorageKey, pendingEventKey } from "./widgetStorage";

const widgetName = "EventWidget";
export async function addEventHomeWidget(eventId: number) {
  if (Platform.OS !== "android" || isRunningInExpoGo()) return false;
  await AsyncStorage.setItem(pendingEventKey, String(eventId));
  const { requestPinWidget } = await import("react-native-android-widget");
  const requested = await requestPinWidget({ widgetName });
  if (!requested) await AsyncStorage.removeItem(pendingEventKey);
  return requested;
}

export async function refreshEventHomeWidgets(db?: SQLiteDatabase) {
  if (Platform.OS !== "android" || isRunningInExpoGo()) return;
  const database = db ?? await SQLite.openDatabaseAsync("lastlittlethings.db");
  const events = await getEvents(database);
  if (!db) await database.closeAsync();
  const [{ requestWidgetUpdate }, { EventWidget }] = await Promise.all([
    import("react-native-android-widget"),
    import("./EventWidget"),
  ]);
  await requestWidgetUpdate({
    widgetName,
    renderWidget: async (widgetInfo) => {
      const eventId = Number(await AsyncStorage.getItem(eventWidgetStorageKey(widgetInfo.widgetId)));
      const event = events.find((item) => item.id === eventId) ?? null;
      return React.createElement(EventWidget, { event, width: widgetInfo.width, height: widgetInfo.height });
    },
  });
}
