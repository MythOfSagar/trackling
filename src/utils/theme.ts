import { StyleSheet, type StyleProp, type ViewStyle, type TextStyle, type ImageStyle } from "react-native";

type NativeStyle = ViewStyle | TextStyle | ImageStyle;

function luminance(color: string) {
  const match = color.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
  if (!match) return 1;
  const raw = match[1].length === 3 ? [...match[1]].map((part) => part + part).join("") : match[1];
  const values = [0, 2, 4].map((index) => parseInt(raw.slice(index, index + 2), 16) / 255).map((value) => value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

export function themeStyle<T extends NativeStyle>(style: StyleProp<T>, darkMode: boolean): T | undefined {
  const flattened = StyleSheet.flatten(style) as T | undefined;
  if (!flattened || !darkMode) return flattened;
  const next = { ...flattened } as Record<string, unknown>;
  for (const key of ["color", "backgroundColor", "borderColor", "borderTopColor", "borderBottomColor", "borderLeftColor", "borderRightColor"] as const) {
    const value = next[key];
    if (typeof value !== "string") continue;
    const light = luminance(value);
    if (key === "color") next[key] = light < 0.42 ? "#E8EBF0" : light < 0.62 ? "#AAB7C7" : value;
    else if (key.startsWith("border")) next[key] = light > 0.12 ? "#3B414A" : "#525963";
    else if (light > 0.9) next[key] = "#22262D";
    else if (light > 0.55) next[key] = "#30353D";
  }
  return next as T;
}

export function createThemeStyle(darkMode: boolean) {
  return <T extends NativeStyle>(style: StyleProp<T>) => themeStyle(style, darkMode);
}

