import "expo-router/entry";
import { isRunningInExpoGo } from "expo";
import { Platform } from "react-native";

if (Platform.OS === "android" && !isRunningInExpoGo()) {
  void import("./src/features/widgets/registerAndroidWidgets").then(({ registerAndroidWidgets }) => {
    registerAndroidWidgets();
  });
}
