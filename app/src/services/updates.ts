import * as Updates from "expo-updates";
import { useUpdateStore } from "../store/update-store";

let initialization: Promise<void> | undefined;

export function initializeUpdates(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      try {
        if (Updates.isEnabled && !__DEV__) {
          const update = await Updates.checkForUpdateAsync();

          if (update.isAvailable || update.isRollBackToEmbedded) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
            return;
          }
        }
      } catch (error) {
        console.warn("Unable to check for app updates:", error);
      }

      useUpdateStore.getState().setStatus("ready");
    })();
  }

  return initialization;
}
