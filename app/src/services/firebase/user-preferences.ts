import {
  doc,
  getFirestore,
  onSnapshot,
  setDoc,
} from "@react-native-firebase/firestore";
import type { InferenceChoice } from "../../store/inference-store";
import { useInferenceStore } from "../../store/inference-store";

function inferencePreference(ownerId: string) {
  return doc(getFirestore(), "users", ownerId, "preferences", "ai");
}

export function observeUserPreferences(ownerId: string): () => void {
  useInferenceStore.getState().setPreference("device");

  return onSnapshot(inferencePreference(ownerId), (snapshot) => {
    if (!snapshot.exists()) return;

    const preference = snapshot.data().preferredInference;
    if (preference === "device" || preference === "cloud")
      useInferenceStore.getState().setPreference(preference);
  });
}

export function saveInferencePreference(
  ownerId: string,
  preference: InferenceChoice,
): Promise<void> {
  useInferenceStore.getState().setPreference(preference);

  return setDoc(
    inferencePreference(ownerId),
    { preferredInference: preference, updatedAt: Date.now() },
    { merge: true },
  );
}
