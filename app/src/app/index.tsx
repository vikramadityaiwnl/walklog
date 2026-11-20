import { Redirect } from "expo-router";
import { useAuthStore } from "../store/auth-store";

export default function Index() {
  const auth = useAuthStore((state) => state.auth);

  if (auth.status !== "ready") return null;

  return <Redirect href={auth.user ? "/(protected)/home" : "/auth"} />;
}
