import { getApp } from "@react-native-firebase/app";
import { Platform, TurboModuleRegistry, type TurboModule } from "react-native";
import { useAppCheckStore } from "../store/app-check-store";

interface AppCheckNativeModule extends TurboModule {
  configureProvider(
    appName: string,
    providerName: string,
    debugToken: string | null,
  ): Promise<void>;
  setTokenAutoRefreshEnabled(appName: string, enabled: boolean): void;
}

let initialization: Promise<void> | undefined;

export function initializeAppCheck(): Promise<void> {
  if (!initialization) {
    initialization = (async () => {
      const app = getApp();
      // RNFirebase 27's modular initializer returns before native setup finishes.
      // Await the native module so Firebase requests cannot race the provider.
      const appCheck = TurboModuleRegistry.getEnforcing<AppCheckNativeModule>(
        "NativeRNFBTurboAppCheck",
      );
      const provider = __DEV__
        ? "debug"
        : Platform.OS === "ios"
          ? "appAttestWithDeviceCheckFallback"
          : "playIntegrity";
      const debugToken = __DEV__
        ? Platform.OS === "ios"
          ? process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_APPLE_DEBUG_TOKEN
          : process.env.EXPO_PUBLIC_FIREBASE_APP_CHECK_ANDROID_DEBUG_TOKEN
        : undefined;

      await appCheck.configureProvider(app.name, provider, debugToken ?? null);
      appCheck.setTokenAutoRefreshEnabled(app.name, true);

      useAppCheckStore.getState().setAppCheck("ready");
    })().catch((error: unknown) => {
      initialization = undefined;

      console.warn("Firebase App Check initialization failed:", error);
      useAppCheckStore.getState().setAppCheck("error");
    });
  }

  return initialization;
}
