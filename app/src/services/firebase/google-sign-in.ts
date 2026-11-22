import {
  GoogleAuthProvider,
  getAuth,
  signInWithCredential,
  signOut,
} from "@react-native-firebase/auth";
import {
  GoogleSignin,
  isSuccessResponse,
} from "@react-native-google-signin/google-signin";
import googleServices from "../../../google-services.json";

const webClientId = googleServices.client[0]?.oauth_client.find(
  (client) => client.client_type === 3,
)?.client_id;

GoogleSignin.configure({ webClientId });

export async function signInWithGoogle(): Promise<void> {
  if (!webClientId) throw new Error("Google sign-in is not configured.");

  const hasPlayServices = await GoogleSignin.hasPlayServices({
    showPlayServicesUpdateDialog: true,
  });
  if (!hasPlayServices)
    throw new Error("Google Play services are unavailable.");
  const response = await GoogleSignin.signIn();

  if (!isSuccessResponse(response)) return;

  if (!response.data.idToken)
    throw new Error("Google did not return an ID token.");

  const credential = GoogleAuthProvider.credential(response.data.idToken);
  await signInWithCredential(getAuth(), credential);
}

export async function signOutUser(): Promise<void> {
  await GoogleSignin.signOut().catch((error: unknown) => {
    console.warn("Google sign-out failed:", error);
  });
  await signOut(getAuth());
}
