import { Redirect } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Path } from "react-native-svg";
import { AppButton } from "../components/app-button";
import { AppText } from "../components/app-text";
import { HowWalklogWorks } from "../components/how-walklog-works";
import { EmptyState } from "../components/empty-state";
import { signInWithGoogle } from "../services/firebase/google-sign-in";
import { useAuthStore } from "../store/auth-store";
import { colors } from "../theme";

type SignInState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string };

function SignInIllustration() {
  return (
    <View style={styles.illustration} pointerEvents="none" accessible={false}>
      <Svg viewBox="0 0 300 260" width="100%" height="100%" fill="none">
        <Path
          d="M45 141 C27 102 47 57 91 48 C131 38 148 57 178 42 C216 27 261 53 264 91 C268 121 254 137 263 161 C275 196 246 229 211 227 C177 225 160 215 130 229 C91 245 45 220 49 188 C52 169 53 159 45 141 Z"
          fill={colors.accentSoft}
          opacity={0.55}
        />
        <G stroke={colors.accent} strokeLinecap="round" strokeLinejoin="round">
          <G opacity={0.4} strokeWidth={1.2}>
            <Path d="M27 91 C35 68 54 63 68 68 M25 96 C32 77 46 70 58 69 M231 59 C249 68 258 83 260 98 M232 63 C247 74 254 85 255 95 M32 181 C43 208 65 224 90 226 M211 230 C234 227 251 212 259 196" />
            <Path
              d="M25 133 C31 119 40 122 43 133 S52 148 61 140 M234 159 C242 150 249 154 250 163 S258 173 268 164"
              strokeDasharray="2 5"
            />
            <Path d="M70 47 l-5 -10 M77 44 l-1 -12 M84 45 l4 -9 M220 208 l7 8 M213 212 l2 12 M205 213 l-2 8" />
          </G>

          <G transform="rotate(-6 150 132)" strokeWidth={2}>
            <Path d="M87 103 Q99 93 111 82 Q129 65 150 51 Q174 69 211 102 M91 100 Q119 76 149 54 Q177 72 208 101 M100 98 Q98 141 100 184 Q100 193 109 193 Q151 196 197 191 Q203 190 203 182 L201 97" />
            <Path
              d="M104 102 Q103 143 103 183 M197 103 L198 179 M95 193 Q145 200 204 193"
              strokeWidth={1}
              opacity={0.55}
            />
            <Path d="M118 110 Q130 108 141 110 L141 135 Q129 136 118 135 Z M130 111 L130 134 M118 122 L140 122 M162 110 Q174 108 186 110 L186 135 Q173 136 162 135 Z M174 111 L174 135 M163 122 L185 122" />
            <Path d="M138 192 Q137 171 138 158 Q139 153 144 153 L159 153 Q164 154 164 159 L165 191 M142 190 L142 160 Q142 157 146 157 M158 174 Q160 172 161 174 Q162 177 159 177 Q157 177 158 174" />
            <Path
              d="M176 74 L177 58 L189 58 L189 84 M180 60 L186 60 M112 141 l7 2 M185 141 l7 -1 M112 146 l4 1 M187 146 l5 -1 M94 203 Q119 200 137 203 M168 203 Q190 201 213 197 M101 207 Q119 205 129 206"
              strokeWidth={1.2}
              opacity={0.7}
            />
          </G>

          <G opacity={0.6} strokeWidth={1.5}>
            <Path d="M48 112 l0 14 M41 119 l14 0 M242 62 l0 12 M236 68 l12 0 M240 150 l0 10 M235 155 l10 0" />
            <Circle cx={65} cy={159} r={3} />
            <Circle cx={230} cy={112} r={2} />
          </G>

          <G opacity={0.65} strokeWidth={1.4}>
            <Path d="M55 88 Q48 86 48 79 Q48 72 55 71 Q62 70 63 77 Q64 82 59 85 L59 94 L62 94 L62 97 L59 97 L59 100 L56 103 L53 100 L53 88 M52 78 Q52 75 55 75 Q58 75 58 78 Q58 81 55 81 Q52 81 52 78 Z M54 90 L54 99" />
            <Path d="M229 182 Q231 180 234 181 L252 190 Q254 191 253 194 L249 202 Q248 204 245 203 L227 194 Q225 193 226 191 Z M231 183 l-2 4 M236 185 l-1 3 M241 188 l-2 4 M246 190 l-1 3 M251 192 l-2 4 M227 195 Q237 200 247 205" />
          </G>
        </G>
      </Svg>
    </View>
  );
}

function GoogleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 48 48" accessible={false}>
      <Circle cx={24} cy={24} r={24} fill="#FFFFFF" />
      <Path
        fill="#4285F4"
        d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11c-.5 2.5-1.9 4.6-4 6v5.1h6.2c3.6-3.3 6.4-8.2 6.4-14.8z"
      />
      <Path
        fill="#34A853"
        d="M24 44c5.4 0 9.9-1.8 13.2-4.8L31 34.1c-1.8 1.2-4.1 1.9-7 1.9-5.2 0-9.6-3.5-11.2-8.2H6.4v5.2C9.7 39.5 16.3 44 24 44z"
      />
      <Path
        fill="#FBBC05"
        d="M12.8 27.8a12 12 0 0 1 0-7.6V15H6.4a20 20 0 0 0 0 18z"
      />
      <Path
        fill="#EA4335"
        d="M24 12c3 0 5.6 1 7.7 3l5.7-5.7A19.2 19.2 0 0 0 24 4C16.3 4 9.7 8.5 6.4 15l6.4 5.2C14.4 15.5 18.8 12 24 12z"
      />
    </Svg>
  );
}

export default function AuthScreen() {
  const auth = useAuthStore((state) => state.auth);

  const [howItWorksVisible, setHowItWorksVisible] = useState(false);

  const [signIn, setSignIn] = useState<SignInState>({ status: "idle" });

  async function handleSignIn() {
    setSignIn({ status: "loading" });

    try {
      await signInWithGoogle();
      setSignIn({ status: "idle" });
    } catch (error) {
      setSignIn({
        status: "error",
        message:
          error instanceof Error ? error.message : "Google sign-in failed.",
      });
    }
  }

  if (auth.status !== "ready") return null;

  if (auth.user) return <Redirect href="/(protected)/(tabs)" />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.main}>
          <View style={styles.brand}>
            <Image
              source={require("../../assets/images/splash-icon.png")}
              style={styles.logo}
              contentFit="contain"
            />

            <AppText variant="title" style={styles.brandName}>
              walklog
            </AppText>
          </View>

          <SignInIllustration />

          <View style={styles.bottom}>
            <View style={styles.headingGroup}>
              <AppText variant="title" style={styles.heading}>
                Your site visits, clearly recorded.
              </AppText>

              <AppText style={styles.description}>
                Capture walkthroughs and keep every detail in one place.
              </AppText>
            </View>

            {signIn.status === "error" ? (
              <EmptyState
                variant="error"
                inline
                title="Couldn’t sign in"
                description={signIn.message}
              />
            ) : null}

            <AppButton
              icon={<GoogleIcon />}
              title={
                signIn.status === "loading"
                  ? "Signing in…"
                  : "Continue with Google"
              }
              disabled={signIn.status === "loading"}
              onPress={handleSignIn}
            />

            <Pressable
              accessibilityRole="button"
              onPress={() => setHowItWorksVisible(true)}
            >
              <AppText style={styles.howItWorks}>
                Before signing in, learn how walklog works and review AI
                guidance.
              </AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <HowWalklogWorks
        visible={howItWorksVisible}
        onClose={() => setHowItWorksVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
  },
  main: { alignSelf: "center", width: "100%", maxWidth: 420, flex: 1 },
  brand: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 48, height: 48 },
  brandName: { fontSize: 22, letterSpacing: -0.5 },
  illustration: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  bottom: { gap: 24 },
  headingGroup: { gap: 8 },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  description: { color: colors.muted, lineHeight: 22 },
  howItWorks: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});
