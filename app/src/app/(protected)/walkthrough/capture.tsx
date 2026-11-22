import { useEffect, useRef, useState } from "react";
import { router, useLocalSearchParams } from "expo-router";
import * as Crypto from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import * as Network from "expo-network";
import { File, Paths } from "expo-file-system";
import {
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioStream,
} from "expo-audio";
import RNFS from "react-native-fs";
import { initWhisper, type WhisperContext } from "whisper.rn";
import { RealtimeTranscriber } from "whisper.rn/realtime-transcription";
import {
  MicrophoneIcon,
  SpeakerXMarkIcon,
  SpeakerWaveIcon,
  StopIcon,
  TrashIcon,
} from "react-native-heroicons/outline";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { InferenceSelector } from "../../../components/inference-selector";
import { walkthroughStyles as styles } from "../../../components/walkthrough-styles";
import { extractAudio, extractItems } from "../../../services/extract-items";
import { randomBannerColor } from "../../../services/banner-colors";
import { transcribeImportedAudio } from "../../../services/transcribe-imported-audio";
import {
  downloadWhisperModel,
  getWhisperModel,
} from "../../../services/whisper-model";
import { createWalkthroughStorage } from "../../../services/walkthrough-storage";
import { WhisperAudioStream } from "../../../services/whisper-audio-stream";
import { useAuthStore } from "../../../store/auth-store";
import { useInferenceStore } from "../../../store/inference-store";
import { colors } from "../../../theme";

type CaptureMode = "voice" | "type";

interface AudioFile {
  uri: string;
  mimeType: string;
}

interface DownloadProgress {
  bytes: number;
  total: number;
}

interface VoiceDraft {
  audio?: AudioFile;
  transcript: string;
  finalized: boolean;
}

type Operation =
  | { status: "idle" | "preparing" | "stopping" | "processing" }
  | { status: "downloading"; progress: DownloadProgress }
  | { status: "recording"; muted: boolean };

interface RecordingSession {
  context: WhisperContext | null;
  stream: WhisperAudioStream | null;
  transcriber: RealtimeTranscriber | null;
  slices: Record<number, string>;
  outputPath?: string;
  sliceTimer: ReturnType<typeof setInterval> | null;
  starting: boolean;
  stopping: boolean;
}

export default function Capture() {
  const { walkthroughId } = useLocalSearchParams<{ walkthroughId: string }>();

  const auth = useAuthStore((state) => state.auth);
  const mode = useInferenceStore((state) => state.mode);

  const [captureMode, setCaptureMode] = useState<CaptureMode>("voice");
  const [operation, setOperation] = useState<Operation>({ status: "idle" });
  const [voice, setVoice] = useState<VoiceDraft>({
    transcript: "",
    finalized: false,
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  const recording = useRef<RecordingSession>({
    context: null,
    stream: null,
    transcriber: null,
    slices: {},
    sliceTimer: null,
    starting: false,
    stopping: false,
  });
  const mounted = useRef(true);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const { audio, transcript, finalized: transcriptFinalized } = voice;
  const muted = operation.status === "recording" && operation.muted;
  const progress =
    operation.status === "downloading" ? operation.progress : undefined;

  const { stream: audioStream } = useAudioStream({
    sampleRate: 16000,
    channels: 1,
    encoding: "int16",
    onBuffer: (buffer) => recording.current.stream?.handleBuffer(buffer),
  });

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
      if (recording.current.sliceTimer)
        clearInterval(recording.current.sliceTimer);

      const transcriber = recording.current.transcriber;
      const context = recording.current.context;

      void (async () => {
        if (transcriber) await transcriber.release();
        if (context) await context.release();
      })();
    };
  }, []);

  async function startRecording() {
    if (operation.status !== "idle" || recording.current.starting) return;

    recording.current.starting = true;
    setError("");

    try {
      const modelPath = getWhisperModel();

      if (!modelPath) {
        setOperation({
          status: "downloading",
          progress: { bytes: 0, total: 77691713 },
        });
        await downloadWhisperModel((bytes, total) => {
          if (mounted.current)
            setOperation({ status: "downloading", progress: { bytes, total } });
        });
        if (mounted.current) {
          setOperation({ status: "idle" });
        }

        return;
      }

      setOperation({ status: "preparing" });
      const permission = await requestRecordingPermissionsAsync();
      if (!permission.granted)
        throw new Error("Allow microphone access to record a walkthrough.");

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      const context = await initWhisper({ filePath: modelPath });
      recording.current.context = context;

      const stream = new WhisperAudioStream(audioStream);
      recording.current.stream = stream;
      const path = `${RNFS.DocumentDirectoryPath}/walklog-${Crypto.randomUUID()}.wav`;
      recording.current.outputPath = path;
      recording.current.slices = {};
      setVoice({ transcript: "", finalized: false });

      const transcriber = new RealtimeTranscriber(
        { whisperContext: context, audioStream: stream, fs: RNFS },
        {
          audioOutputPath: path,
          audioSliceSec: 25,
          realtimeProcessingPauseMs: 1500,
          initRealtimeAfterMs: 1500,
          transcribeOptions: { language: "auto" },
        },
        {
          onTranscribe: (event) => {
            if (event.type !== "transcribe" || !event.data || !mounted.current)
              return;

            recording.current.slices[event.sliceIndex] =
              event.data.result.trim();

            const transcript = Object.entries(recording.current.slices)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([, text]) => text)
              .filter(Boolean)
              .join(" ");

            setVoice((current) => ({ ...current, transcript }));
          },
          onError: (message) => {
            if (mounted.current) setError(`Transcription issue: ${message}`);
          },
        },
      );
      recording.current.transcriber = transcriber;
      await transcriber.start();

      recording.current.sliceTimer = setInterval(() => {
        void transcriber.nextSlice();
      }, 20000);
      setOperation({ status: "recording", muted: false });
    } catch (cause) {
      if (recording.current.transcriber)
        await recording.current.transcriber.release().catch(() => {});
      if (recording.current.context)
        await recording.current.context.release().catch(() => {});

      recording.current.transcriber = null;
      recording.current.context = null;
      recording.current.stream = null;
      if (mounted.current) {
        setOperation({ status: "idle" });
        setError(
          cause instanceof Error ? cause.message : "Couldn’t start recording.",
        );
      }
    } finally {
      recording.current.starting = false;
    }
  }

  async function toggleMute() {
    const stream = recording.current.stream;
    if (!stream || operation.status !== "recording") return;

    try {
      if (muted) await stream.start();
      else await stream.stop();
      setOperation({ status: "recording", muted: !muted });
    } catch {
      setError("Couldn’t change the microphone state.");
    }
  }

  async function stopRecording() {
    const transcriber = recording.current.transcriber;
    if (
      !transcriber ||
      operation.status !== "recording" ||
      recording.current.stopping
    )
      return;

    recording.current.stopping = true;
    setOperation({ status: "stopping" });

    try {
      if (recording.current.sliceTimer)
        clearInterval(recording.current.sliceTimer);
      recording.current.sliceTimer = null;

      if (recording.current.stream?.isRecording())
        await recording.current.stream.stop();
      await transcriber.nextSlice();
      await transcriber.stop();

      if (recording.current.outputPath) {
        const recordingInfo = await RNFS.stat(recording.current.outputPath);
        if (Number(recordingInfo.size) <= 44) {
          throw new Error(
            "No microphone audio was captured. Check the microphone and try again.",
          );
        }

        setVoice((current) => ({
          ...current,
          audio: {
            uri: `file://${recording.current.outputPath}`,
            mimeType: "audio/wav",
          },
        }));

        const context = recording.current.context;
        if (context) {
          const result = await context.transcribe(
            recording.current.outputPath,
            {
              language: "auto",
            },
          ).promise;
          if (!result.isAborted && result.result.trim()) {
            setVoice((current) => ({
              ...current,
              transcript: result.result.trim(),
              finalized: true,
            }));
          }
        }
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t finish the recording.",
      );
    } finally {
      await transcriber.release().catch(() => {});
      await recording.current.context?.release().catch(() => {});
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});

      recording.current.transcriber = null;
      recording.current.context = null;
      recording.current.stream = null;
      setOperation({ status: "idle" });
      recording.current.stopping = false;
    }
  }

  async function importAudio() {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const source = result.assets[0];
      const suffix = source.name.match(/\.[a-z0-9]+$/i)?.[0] ?? ".m4a";
      const destination = new File(
        Paths.document,
        `walklog-audio-${Crypto.randomUUID()}${suffix}`,
      );
      new File(source.uri).copy(destination);

      setVoice({
        transcript: "",
        finalized: false,
        audio: {
          uri: destination.uri,
          mimeType:
            source.mimeType === "audio/x-m4a" || suffix.toLowerCase() === ".m4a"
              ? "audio/mp4"
              : source.mimeType || "audio/mp4",
        },
      });
      setError("");
    } catch {
      setError("Couldn’t import this audio. Please try again.");
    }
  }

  function clearVoice() {
    setVoice({ transcript: "", finalized: false });
    setError("");
  }

  async function complete() {
    if (!ownerId || !walkthroughId || operation.status !== "idle") return;

    setError("");
    setOperation({ status: "processing" });

    try {
      if (mode === "cloud") {
        const network = await Network.getNetworkStateAsync();
        if (!network.isConnected || network.isInternetReachable === false)
          throw new Error("Connect to the internet to use cloud processing.");
      }

      let rawTranscript = captureMode === "type" ? note : transcript;
      let results;
      if (captureMode === "type") results = await extractItems(note, mode);
      else if (mode === "cloud" && audio)
        results = await extractAudio(audio.uri, audio.mimeType);
      else {
        if (!transcriptFinalized && audio) {
          let modelPath = getWhisperModel();

          if (!modelPath) {
            setOperation({
              status: "downloading",
              progress: { bytes: 0, total: 77691713 },
            });
            modelPath = await downloadWhisperModel((bytes, total) => {
              if (mounted.current)
                setOperation({
                  status: "downloading",
                  progress: { bytes, total },
                });
            });
            setOperation({ status: "processing" });
          }

          const context = await initWhisper({ filePath: modelPath });
          try {
            rawTranscript = await transcribeImportedAudio(context, audio.uri);
          } finally {
            await context.release();
          }

          setVoice((current) => ({
            ...current,
            transcript: rawTranscript,
            finalized: true,
          }));
        }

        if (!rawTranscript.trim())
          throw new Error("No speech was detected. Try recording again.");

        results = await extractItems(rawTranscript, "device");
      }

      const now = Date.now();
      const items = results.map((item) => ({
        ...item,
        id: Crypto.randomUUID(),
        walkthroughId,
        bannerColor: randomBannerColor(),
        rawTranscript,
        status: "Open" as const,
        photos: [],
        createdAt: now,
        updatedAt: now,
      }));
      await createWalkthroughStorage(ownerId).createItems(items);

      if (items.length === 1)
        router.replace({
          pathname: "/walkthrough/item-view",
          params: { walkthroughId, id: items[0].id },
        });
      else router.back();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Couldn’t create items. Please try again.",
      );
    } finally {
      setOperation({ status: "idle" });
    }
  }

  const busy = operation.status !== "idle" && operation.status !== "recording";
  const mb = (bytes: number) => (bytes / 1000000).toFixed(1);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, screenStyles.content]}
      >
        <View style={styles.section}>
          <AppText variant="title" style={styles.heading}>
            Add items
          </AppText>

          <AppText style={styles.subheading}>
            Describe your walkthrough and let walklog find the items.
          </AppText>
        </View>

        <View style={screenStyles.segments}>
          {(["voice", "type"] as const).map((option) => (
            <Pressable
              key={option}
              accessibilityRole="radio"
              accessibilityState={{
                selected: captureMode === option,
                disabled: operation.status !== "idle",
              }}
              disabled={operation.status !== "idle"}
              onPress={() => setCaptureMode(option)}
              style={[
                screenStyles.segment,
                captureMode === option && screenStyles.selected,
              ]}
            >
              <AppText weight="semibold">
                {option === "voice" ? "Voice" : "Type"}
              </AppText>
            </Pressable>
          ))}
        </View>

        {captureMode === "voice" ? (
          <View style={screenStyles.voice}>
            {!audio &&
            !transcript &&
            (operation.status === "idle" ||
              operation.status === "preparing" ||
              operation.status === "downloading") ? (
              <View style={screenStyles.voiceIntro}>
                {operation.status === "preparing" ? (
                  <ActivityIndicator
                    size="large"
                    color={colors.accent}
                    accessibilityLabel="Preparing recording"
                  />
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Start recording"
                    disabled={busy}
                    onPress={startRecording}
                    style={screenStyles.bigMic}
                  >
                    <MicrophoneIcon size={38} color={colors.onAccent} />
                  </Pressable>
                )}

                <AppText weight="semibold">
                  {operation.status === "preparing" ? "Preparing…" : "Record"}
                </AppText>
              </View>
            ) : null}

            {operation.status === "recording" || transcript ? (
              <View style={styles.section}>
                <AppText weight="semibold">Transcript</AppText>

                <TextInput
                  accessibilityLabel="Transcript"
                  multiline
                  editable={operation.status === "idle"}
                  value={transcript}
                  onChangeText={(transcript) =>
                    setVoice((current) => ({ ...current, transcript }))
                  }
                  placeholder={
                    muted ? "Microphone muted" : "Your words will appear here…"
                  }
                  style={[styles.input, styles.multiline]}
                />
              </View>
            ) : null}

            {audio && !transcript ? (
              <AppText style={styles.subheading}>
                Audio ready to process.
              </AppText>
            ) : null}

            {!audio && operation.status === "idle" ? (
              <>
                <View style={screenStyles.divider}>
                  <View style={screenStyles.dividerLine} />

                  <AppText style={screenStyles.dividerText}>OR</AppText>

                  <View style={screenStyles.dividerLine} />
                </View>

                <AppButton
                  title="Import audio"
                  variant="secondary"
                  onPress={importAudio}
                />
              </>
            ) : null}
          </View>
        ) : (
          <View style={styles.section}>
            <AppText weight="semibold">Walkthrough notes</AppText>

            <TextInput
              accessibilityLabel="Walkthrough notes"
              multiline
              editable={operation.status === "idle"}
              value={note}
              onChangeText={setNote}
              placeholder="Describe what needs attention"
              style={[styles.input, styles.multiline]}
            />
          </View>
        )}

        {captureMode === "type" ||
        (captureMode === "voice" && !!audio && operation.status === "idle") ? (
          <View style={styles.section}>
            <AppText weight="semibold">Process with</AppText>

            <InferenceSelector requiresAudio={captureMode === "voice"} />
          </View>
        ) : null}

        {error ? (
          <AppText accessibilityRole="alert" style={styles.error}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      {progress && operation.status === "downloading" ? (
        <View style={screenStyles.download}>
          <AppText weight="semibold">Downloading speech model</AppText>

          <AppText style={styles.subheading}>
            {mb(progress.bytes)} MB of {mb(progress.total)} MB ·{" "}
            {Math.min(100, Math.round((progress.bytes / progress.total) * 100))}
            %
          </AppText>

          <View style={screenStyles.progressTrack}>
            <View
              style={[
                screenStyles.progressFill,
                {
                  width: `${Math.min(100, (progress.bytes / progress.total) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      ) : null}

      {operation.status === "stopping" ? (
        <View style={screenStyles.finishing}>
          <ActivityIndicator color={colors.accent} />

          <AppText style={styles.subheading}>Finishing recording…</AppText>
        </View>
      ) : null}

      {captureMode === "voice" &&
      (operation.status === "recording" ||
        (audio && operation.status === "idle")) ? (
        <View style={screenStyles.recordBar}>
          {operation.status === "recording" ? (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  muted ? "Unmute microphone" : "Mute microphone"
                }
                onPress={toggleMute}
                style={screenStyles.iconButton}
              >
                {muted ? (
                  <SpeakerXMarkIcon size={22} color={colors.foreground} />
                ) : (
                  <SpeakerWaveIcon size={22} color={colors.foreground} />
                )}
              </Pressable>

              <AppText style={screenStyles.barText}>
                {muted ? "Microphone muted" : "Listening…"}
              </AppText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                onPress={stopRecording}
                style={screenStyles.stopButton}
              >
                <StopIcon size={20} color={colors.onAccent} />
              </Pressable>
            </>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Clear recording"
                disabled={busy}
                onPress={clearVoice}
                style={screenStyles.iconButton}
              >
                <TrashIcon size={22} color={colors.foreground} />
              </Pressable>

              <AppText style={screenStyles.barText}>Recording ready</AppText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Record again"
                disabled={busy}
                onPress={startRecording}
                style={screenStyles.stopButton}
              >
                <MicrophoneIcon size={20} color={colors.onAccent} />
              </Pressable>
            </>
          )}
        </View>
      ) : null}

      {captureMode === "type" ||
      (captureMode === "voice" &&
        !!audio &&
        (operation.status === "idle" || operation.status === "processing")) ? (
        <View style={styles.actions}>
          <View style={styles.action}>
            <AppButton
              title={
                operation.status === "processing"
                  ? "Creating items…"
                  : operation.status === "stopping"
                    ? "Finishing…"
                    : "Create items"
              }
              disabled={
                operation.status !== "idle" ||
                (captureMode === "voice" ? !audio : !note.trim())
              }
              onPress={complete}
            />
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const screenStyles = StyleSheet.create({
  content: { flexGrow: 1 },
  segments: {
    flexDirection: "row",
    borderRadius: 12,
    padding: 4,
    backgroundColor: colors.accentFaint,
  },
  segment: { flex: 1, alignItems: "center", padding: 10, borderRadius: 9 },
  selected: { backgroundColor: colors.background },
  voice: { flexGrow: 1, gap: 12 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  dividerText: { color: colors.muted, fontSize: 12 },
  finishing: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 10,
    padding: 16,
  },
  voiceIntro: {
    flex: 1,
    minHeight: 220,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  bigMic: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  download: { gap: 6, paddingHorizontal: 24, paddingVertical: 12 },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
    backgroundColor: colors.accentFaint,
  },
  progressFill: { height: 6, backgroundColor: colors.accent },
  recordBar: {
    marginHorizontal: 24,
    marginTop: 8,
    borderRadius: 26,
    backgroundColor: colors.accentFaint,
    flexDirection: "row",
    alignItems: "center",
    padding: 6,
    gap: 10,
  },
  iconButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  barText: { flex: 1, color: colors.muted },
  stopButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
