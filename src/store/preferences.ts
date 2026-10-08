import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { ReminderUnit } from "@/types/models";

type PreferencesState = {
  use24Hour: boolean;
  darkMode: boolean;
  defaultReminderInterval: number;
  defaultReminderUnit: ReminderUnit;
  hydrate: () => Promise<void>;
  setUse24Hour: (value: boolean) => Promise<void>;
  setDarkMode: (value: boolean) => Promise<void>;
  setDefaultReminderInterval: (interval: number) => Promise<void>;
  setDefaultReminderUnit: (unit: ReminderUnit) => Promise<void>;
};

export const usePreferencesStore = create<PreferencesState>((set) => ({
  use24Hour: false,
  darkMode: false,
  defaultReminderInterval: 3,
  defaultReminderUnit: "day",
  hydrate: async () => {
    const [clock, reminderInterval, reminderUnit, darkMode] = await Promise.all([AsyncStorage.getItem("little-again:clock-24h"), AsyncStorage.getItem("little-again:default-reminder-interval"), AsyncStorage.getItem("little-again:default-reminder-unit"), AsyncStorage.getItem("little-again:dark-mode")]);
    const parsedInterval = Number(reminderInterval);
    const units: ReminderUnit[] = ["minute", "hour", "day", "week", "month", "year"];
    set({ use24Hour: clock === "true", darkMode: darkMode === "true", defaultReminderInterval: Number.isInteger(parsedInterval) && parsedInterval > 0 && parsedInterval <= 999 ? parsedInterval : 3, defaultReminderUnit: units.includes(reminderUnit as ReminderUnit) ? reminderUnit as ReminderUnit : "day" });
  },
  setUse24Hour: async (value) => { set({ use24Hour: value }); await AsyncStorage.setItem("little-again:clock-24h", String(value)); },
  setDarkMode: async (value) => { set({ darkMode: value }); await AsyncStorage.setItem("little-again:dark-mode", String(value)); },
  setDefaultReminderInterval: async (interval) => { set({ defaultReminderInterval: interval }); await AsyncStorage.setItem("little-again:default-reminder-interval", String(interval)); },
  setDefaultReminderUnit: async (unit) => { set({ defaultReminderUnit: unit }); await AsyncStorage.setItem("little-again:default-reminder-unit", unit); },
}));
