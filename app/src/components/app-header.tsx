import { Image } from "expo-image";
import { router } from "expo-router";
import { BellIcon } from "react-native-heroicons/outline";
import { Pressable, StyleSheet, View } from "react-native";
import { InferenceSelector } from "./inference-selector";
import { colors } from "../theme";

export function AppHeader() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/splash-icon.png")}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="walklog"
      />

      <View style={styles.controls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reminders"
          hitSlop={8}
          onPress={() => router.push("/(protected)/reminders")}
          style={styles.action}
        >
          <BellIcon size={24} color={colors.foreground} />
        </Pressable>

        <InferenceSelector />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  logo: { height: 44, width: 44 },
  controls: { flexDirection: "row", alignItems: "center", gap: 8 },
  action: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
});
