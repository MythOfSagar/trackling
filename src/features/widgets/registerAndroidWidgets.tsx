import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { registerWidgetConfigurationScreen, registerWidgetTaskHandler } from "react-native-android-widget";
import { getEvents } from "@/database/repository";
import { EventWidget } from "./EventWidget";
import { WidgetConfigurationScreen } from "./WidgetConfigurationScreen";
import { eventWidgetStorageKey } from "./widgetStorage";

export function registerAndroidWidgets() {
  registerWidgetConfigurationScreen(WidgetConfigurationScreen);
  registerWidgetTaskHandler(async ({ widgetInfo, widgetAction, renderWidget }) => {
    const key = eventWidgetStorageKey(widgetInfo.widgetId);
    if (widgetAction === "WIDGET_DELETED") {
      await AsyncStorage.removeItem(key);
      return;
    }

    try {
      const eventId = Number(await AsyncStorage.getItem(key));
      const db = await SQLite.openDatabaseAsync("lastlittlethings.db");
      const events = await getEvents(db);
      await db.closeAsync();
      const event = events.find((item) => item.id === eventId) ?? null;
      if (!event && eventId) await AsyncStorage.removeItem(key);
      renderWidget(<EventWidget event={event} width={widgetInfo.width} height={widgetInfo.height} />);
    } catch {
      renderWidget(<EventWidget event={null} width={widgetInfo.width} height={widgetInfo.height} />);
    }
  });
}
