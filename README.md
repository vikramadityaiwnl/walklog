# walklog

walklog is an offline-first mobile app for construction and property walkthroughs. It turns typed, spoken, or video walkthrough observations into structured punch-list items, lets users attach photos and track work, and produces a report to share. It is built for people who need to document issues on site, including when their connection is unreliable.

The app uses Firebase AI Logic for on-device and cloud AI, Firebase Authentication for Google sign-in, Cloud Firestore for records and offline synchronization, Cloud Storage for photos, and App Check to protect Firebase services. It is an iOS and Android app built with Expo and React Native.

## How AI works

walklog uses Firebase AI Logic for both on-device and cloud inference. It turns notes into structured items and can refine those items. Cloud processing uses `gemini-3.1-flash-lite` through the Gemini Developer API and requires an internet connection. Photo refinement is available in cloud mode and, on supported Android devices, with one photo in on-device mode.

Voice capture uses a separate Whisper tiny multilingual model (about 78 MB) for on-device transcription. The app offers a download when it is needed.

Video capture analyzes recorded or imported video and its audio using cloud AI to identify issues and select relevant video frames as photos. It requires an internet connection. Review the resulting items and photos before saving them.

Firebase AI Logic hybrid inference is experimental; see the [iOS](https://firebase.google.com/docs/ai-logic/hybrid/ios/get-started) and [Android](https://firebase.google.com/docs/ai-logic/hybrid/android/get-started) documentation.

## Prerequisites

- Node.js compatible with the installed Expo SDK: Node 22.13 or later in the 22.x line, 24.3 or later in the 24.x line, or a newer supported release. npm is used with the committed lockfile.
- A Firebase project with permissions to configure its products and deploy rules. A Google account is needed to sign in to walklog.
- **iOS:** macOS, Xcode and its command-line tools, CocoaPods, and an iOS simulator or a provisioned physical device. On-device AI needs iOS 26 or later and an Apple Intelligence-capable environment with the model available. A simulator's model behavior can differ from a physical device.
- **Android:** Android Studio, Android SDK, a compatible JDK, and an emulator with Google Play services or a physical Android device. The app's minimum Android SDK is 26. Gemini Nano requires a [supported device](https://developers.google.com/ml-kit/genai/) and AICore; an ordinary emulator should not be assumed to support it.
- Internet access for initial setup, Google sign-in, model downloads, cloud AI, and syncing. Cloud Storage for Firebase currently requires the pay-as-you-go Blaze plan; check [pricing and billing requirements](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) before enabling it.

This project uses custom native modules, Firebase native SDKs, and `whisper.rn`. **Expo Go is not supported:** build the native app as described below.

## Set up Firebase

Use your own Firebase project for development. The repository contains Firebase app configuration files for the original project; they identify that project and are not a reusable authorization grant. Replace **both** files before building, even when building only iOS: the JavaScript sign-in code reads the web OAuth client ID from the Android configuration.

1. Create a Firebase project. Register an Android app and an iOS app in that **same** project. Their identifiers must match `expo.android.package` and `expo.ios.bundleIdentifier` in [`app/app.json`](app/app.json); both currently default to `com.thevikramaditya.walklog`. If you change either identifier, register and download matching Firebase app configurations.
2. In **Authentication → Sign-in method**, enable Google. Set the support email and configure the Google OAuth consent screen/audience as needed; add test users if your consent screen is in testing mode. For Android Google sign-in, register the SHA-1 of the certificate used to sign the build in Firebase Project Settings. Include the appropriate debug, release, or Play App Signing certificate for each build you distribute.
3. Download the refreshed Android `google-services.json` to `app/google-services.json` and the iOS `GoogleService-Info.plist` to `app/GoogleService-Info.plist`. Download them **after** enabling Google sign-in and adding the Android SHA-1. The Android JSON must contain a `client_type: 3` web OAuth client: [`google-sign-in.ts`](app/src/services/firebase/google-sign-in.ts) reads it for both platforms. The iOS plist needs the Google sign-in configuration, including its reversed client ID, for the Expo config plugin. Do not manually copy a client ID from a different Firebase project.
4. Create the default Cloud Firestore database and default Cloud Storage bucket. Deploy this repository's rules and indexes to **your** project with the [Firebase CLI](https://firebase.google.com/docs/cli). From the repository root:

   ```sh
   cd firebase
   firebase login
   firebase deploy --project YOUR_FIREBASE_PROJECT_ID --only firestore:rules,firestore:indexes,storage
   cd ..
   ```

   Always specify `--project`: [`firebase/.firebaserc`](firebase/.firebaserc) names the original project. The rules restrict records and photos to the signed-in user.

5. In **AI Services → AI Logic**, get started with the **Gemini Developer API** provider and complete the guided setup. This enables the Firebase AI Logic API and Gemini Developer API for the project. The app uses the Firebase AI Logic SDK; **do not put a Gemini API key in the app**. See [Firebase AI Logic setup](https://firebase.google.com/docs/ai-logic).
6. In **Security → App Check**, register both Firebase apps. For local development, follow the debug-token steps below. For distributed builds, configure App Attest with DeviceCheck fallback on iOS and Play Integrity on Android, including their Firebase/Google Cloud and signing requirements. The code chooses the debug provider for development and those platform providers for non-development builds. Test your actual signed build and enforcement settings on the target devices.

Firebase app config files contain project identifiers and Firebase API keys, which Firebase describes as public-by-design when appropriately restricted. They do **not** replace Security Rules, App Check, API restrictions, or quota monitoring. Review the contest's separate prohibition on production API keys and secrets before making a submission public. Never commit service-account credentials, Gemini API keys, signing keys, App Check debug tokens, or real user data. See [Firebase's API key guidance](https://firebase.google.com/support/faq#api-keys-for-firebase).

## Configure App Check for local development

Create a local env file:

```sh
cd app
cp .env.example .env
```

For each platform you intend to run, open **Firebase Console → Security → App Check → Apps**, select the corresponding app, and use **Manage debug tokens** to create a token. Add each token to `app/.env`:

```dotenv
EXPO_PUBLIC_FIREBASE_APP_CHECK_APPLE_DEBUG_TOKEN=your_apple_debug_token
EXPO_PUBLIC_FIREBASE_APP_CHECK_ANDROID_DEBUG_TOKEN=your_android_debug_token
```

Use the token for the Firebase app and project you configured above. These variables are embedded into the development JavaScript bundle: `EXPO_PUBLIC_` does **not** make them secret. Keep `.env` and debug builds private, do not commit or publish tokens, and revoke any leaked token. Restart Metro after changing the env file. The app selects the debug provider only when `__DEV__` is true; a non-development/preview build uses real device attestation instead. See the Firebase debug-provider documentation for [Apple](https://firebase.google.com/docs/app-check/ios/debug-provider) and [Android](https://firebase.google.com/docs/app-check/android/debug-provider).

## Install and run

From a fresh clone, after completing Firebase and App Check setup:

```sh
git clone https://github.com/vikramadityaiwnl/walklog.git
cd walklog/app
npm ci
```

`npm ci` also runs `patch-package` through `postinstall`; the checked-in patches and Expo config plugins are required by the current native integration. Then run one platform:

```sh
# macOS, Xcode, and an iOS simulator or connected device
npm run ios

# Android emulator or connected device
npm run android
```

Expo generates the ignored native `ios/` and `android/` projects, builds the app, and starts the development server. Run `npm start` from `app/` to restart Metro for an already installed development build. Rebuild the native app after changing native modules, Expo plugins, app identifiers, or Firebase configuration files; reload JavaScript after changes to `.env`. If you already generated native projects before changing native configuration, regenerate them with `npx expo prebuild --clean` and rebuild. **That command deletes and recreates the generated native directories**, so preserve any manual native changes first.

For Android sign-in with the default local debug keystore, you can obtain its SHA-1 with:

```sh
keytool -list -v -alias androiddebugkey -keystore "$HOME/.android/debug.keystore" -storepass android -keypass android
```

The debug keystore is usually created by the first Android debug build. If it does not exist yet, build once, register the SHA-1 in Firebase, download the updated `google-services.json`, and rebuild. A different signing key has a different fingerprint.

The checked-in Expo configuration also contains the original owner's EAS project and update URL. Local native development does not require access to that EAS project. If you intend to use EAS Build or Updates under your own account, configure your own project, signing credentials, channels, and update URL instead of publishing to the existing project. See [Expo EAS](https://docs.expo.dev/eas/).

## Try the app

1. Start online and sign in with a Google account. Create a project or a walkthrough.
2. Open a walkthrough and add notes. For a quick text test, use: “The kitchen tap is leaking. The living room window has a cracked pane.” Select an available processing mode and create items.
3. For voice, download the transcription model when prompted, record or import audio, and review the transcript before creating items.
4. For video, record or import a walkthrough, connect to the internet, and create items. Review the identified issues and selected photos. Recording requires a device with a camera; on the iOS simulator, import a video instead.
5. Open an item, edit it, add a photo, and try refinement. Choose cloud processing to include photos on iOS. Generate and share a report from the walkthrough.
6. To exercise offline behavior, first sign in, make the relevant data available locally, and ensure the on-device model is ready. Disconnect and make changes; reconnect to allow pending records and photos to sync. First sign-in, initial model downloads, cloud AI, and synchronization require connectivity.

On-device AI availability depends on the device and its settings. Cloud processing is available when online. Generated AI results can be imperfect; review items and suggested actions before sharing.

## Troubleshooting

- **Google sign-in fails:** Check that the Android package/iOS bundle identifier matches your Firebase apps, Google sign-in is enabled, your consent-screen audience permits your account, and the Android signing SHA-1 is registered. Download the updated files and rebuild. Confirm the Android JSON has a web OAuth client (`client_type: 3`) even for an iOS build.
- **App Check or Firebase requests fail:** Verify the app belongs to the selected Firebase project, its debug token is registered for the correct Firebase app, and Metro was restarted after setting `.env`. For distributed builds, check platform attestation configuration, signing, and App Check metrics. Debug tokens are not a substitute for release attestation.
- **Permission denied or photos do not sync:** Confirm the intended project and bucket, deploy the Firestore and Storage rules above, sign in, and check connectivity and Storage billing. Rules do not create the database or bucket for you.
- **On-device AI is unavailable:** Check device support, OS version, system AI settings, and model readiness. On Android, update AICore and download the model if offered. On iOS, check Apple Intelligence settings. Use cloud mode when available or enter details manually.
- **Cloud AI fails:** Verify AI Logic was initialized with the Gemini Developer API, App Check is working, the configured model is available to the project, and there is connectivity and quota. Firebase provides [AI Logic troubleshooting](https://firebase.google.com/docs/ai-logic/faq-and-troubleshooting).
- **Native build or sign-in changes are not reflected:** Restart Metro and rebuild. After changing app configuration or native dependencies, regenerate the native projects if needed, taking care with `prebuild --clean` as described above.

## Project structure and verification

- `app/src/` — screens, components, stores, and app services.
- `app/modules/firebase-ai-hybrid/` — native Firebase AI Logic bridge for iOS and Android.
- `app/plugins/` and `app/patches/` — Expo native configuration and dependency patches.
- `firebase/` — Firestore and Storage security rules and Firestore indexes.

From `app/`, run `npx tsc --noEmit` to type-check and `npm run format:check -- <files>` to check formatting. Firebase deployment and real-device behavior require a configured project and appropriate test devices.

## License

walklog is licensed under the [Apache License 2.0](LICENSE).
