import { Image } from "expo-image";
import { StyleSheet, View } from "react-native";
import { InferenceSelector } from "./inference-selector";

export function AppHeader() {
  return (
    <View style={styles.container}>
      <Image
        source={require("../../assets/images/splash-icon.png")}
        style={styles.logo}
        contentFit="contain"
        accessibilityLabel="walklog"
      />

      <InferenceSelector />
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
});
