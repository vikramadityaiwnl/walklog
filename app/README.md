# WalkLog app

The iOS and Android apps initialize Firebase App Check before mounting routes.
Provider setup does not require a network connection; Firebase requests obtain
tokens when needed. Release builds use App Attest with DeviceCheck fallback on
iOS and Play Integrity on Android. Register the apps and providers in Firebase
and configure the corresponding Apple and Google credentials before release.

For local development, copy `.env.example` to `.env`, fill in separately
registered Firebase App Check debug tokens, and run `npm start`. Expo loads
the `EXPO_PUBLIC_` variables into the development bundle. Debug tokens grant
access to protected Firebase resources: keep `.env` private, do not commit
the tokens, and revoke them if exposed. Do not supply these variables to
production or preview builds. If no token is supplied, the native debug
provider can generate one for registration in Firebase.

Native dependency or configuration changes require a new iOS or Android build.
The Firebase iOS integration uses Swift Package Manager; the package patches in
`patches/` are applied automatically by `npm install`.
