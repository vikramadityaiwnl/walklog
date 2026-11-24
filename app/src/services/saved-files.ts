import * as Application from "expo-application";
import { Paths } from "expo-file-system";
import * as Linking from "expo-linking";
import { Platform } from "react-native";

export async function openSavedFiles(): Promise<void> {
  if (Platform.OS === "ios") {
    await Linking.openURL(
      Paths.document.uri.replace(/^file:/, "shareddocuments:"),
    );

    return;
  }

  if (!Application.applicationId)
    throw new Error("Couldn’t find the saved files location.");

  await Linking.openURL(
    `content://${Application.applicationId}.walklog-documents/root/walklog`,
  );
}
