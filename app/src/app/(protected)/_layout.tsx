import { Redirect, Stack } from "expo-router";
import { useAuthStore } from "../../store/auth-store";

export default function ProtectedLayout() {
  const auth = useAuthStore((state) => state.auth);

  if (auth.status !== "ready") return null;
  if (!auth.user) return <Redirect href="/auth" />;

  return (
    <Stack>
      <Stack.Screen name="ai-playground" options={{ title: "AI playground" }} />
    </Stack>
  );
}
