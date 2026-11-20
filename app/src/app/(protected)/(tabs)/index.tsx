import { StyleSheet, View } from "react-native";
import { AppText } from "../../../components/app-text";
import { colors } from "../../../theme";

export default function Walkthroughs() {
  return (
    <View style={styles.container}>
      <AppText variant="title">Walkthroughs</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center",
  },
});
