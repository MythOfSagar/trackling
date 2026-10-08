import { Pressable, Text, StyleSheet, ActivityIndicator, type ViewStyle } from "react-native";

export function PrimaryButton({ title, onPress, loading = false, style }: { title: string; onPress: () => void; loading?: boolean; style?: ViewStyle }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={loading} style={({ pressed }) => [styles.button, pressed && styles.pressed, style]}>
      {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.text}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { minHeight: 54, borderRadius: 18, backgroundColor: "#244D3B", alignItems: "center", justifyContent: "center", paddingHorizontal: 20 },
  pressed: { opacity: 0.82 }, text: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
