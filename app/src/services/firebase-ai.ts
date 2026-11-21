import { requireOptionalNativeModule } from "expo";
import { Platform } from "react-native";

export type InferenceMode = "auto" | "device" | "cloud";

export type ModelAvailability = {
  status: "available" | "downloadable" | "downloading" | "unavailable";
  message: string;
};

export type Generation = {
  text: string;
  source: "on-device" | "cloud" | "unknown";
};

interface FirebaseAiNativeModule {
  checkAvailability(): Promise<ModelAvailability>;
  downloadModel(): Promise<void>;
  generateText(prompt: string, mode: InferenceMode): Promise<Generation>;
}

const native =
  requireOptionalNativeModule<FirebaseAiNativeModule>("FirebaseAiHybrid");

function getNativeModule(): FirebaseAiNativeModule {
  if (!native)
    throw new Error(
      "Firebase AI is unavailable. Install a new development build.",
    );

  return native;
}

export function checkModelAvailability(): Promise<ModelAvailability> {
  return getNativeModule().checkAvailability();
}

export function downloadModel(): Promise<void> {
  if (Platform.OS !== "android") {
    throw new Error(
      "Apple Intelligence manages its model download in Settings.",
    );
  }

  return getNativeModule().downloadModel();
}

export async function generateText(
  prompt: string,
  mode: InferenceMode,
): Promise<Generation> {
  if (!prompt.trim()) throw new Error("Enter a prompt first.");

  const result = await getNativeModule().generateText(prompt, mode);
  if (!result.text.trim())
    throw new Error("The model returned an empty response.");

  return result;
}
