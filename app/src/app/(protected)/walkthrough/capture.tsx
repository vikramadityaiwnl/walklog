import { useEffect, useRef, useState, type ComponentRef } from "react";
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
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  PencilSquareIcon,
  ExclamationTriangleIcon,
} from "react-native-heroicons/outline";
import Svg, { Circle } from "react-native-svg";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  ReduceMotion,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated";
import { AppButton } from "../../../components/app-button";
import { AppText } from "../../../components/app-text";
import { EmptyState } from "../../../components/empty-state";
import { InferenceSelector } from "../../../components/inference-selector";
import { LoadingState } from "../../../components/loading-state";
import { SegmentedControl } from "../../../components/segmented-control";
import { extractItems } from "../../../services/walkthrough/extract-items";
import { randomBannerColor } from "../../../utils/banner-colors";
import { cleanTranscript } from "../../../services/transcription/transcript";
import { transcribeImportedAudio } from "../../../services/transcription/imported-audio";
import {
  downloadWhisperModel,
  getWhisperModel,
  whisperModelSize,
} from "../../../services/whisper/model";
import {
  createFirestoreId,
  createWalkthroughStorage,
} from "../../../services/walkthrough/storage";
import { WhisperAudioStream } from "../../../services/whisper/audio-stream";
import { useAuthStore } from "../../../store/auth-store";
import { useInferenceStore } from "../../../store/inference-store";
import { colors } from "../../../theme";

type CaptureMode = "voice" | "type";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const fadeIn = FadeIn.duration(180).reduceMotion(ReduceMotion.System);
const fadeOut = FadeOut.duration(140).reduceMotion(ReduceMotion.System);
const layoutTransition = LinearTransition.duration(180).reduceMotion(
  ReduceMotion.System,
);
const ringCircumference = 2 * Math.PI * 51;

interface AudioFile {
  uri: string;
  mimeType: string;
  source: "recording" | "import";
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
  | {
      status: "idle" | "preparing" | "stopping" | "transcribing";
    }
  | { status: "processing"; phase: "identifying" | "saving" }
  | { status: "failed"; message: string }
  | { status: "downloading"; progress: DownloadProgress }
  | { status: "recording"; muted: boolean };

interface RecordingSession {
  context: WhisperContext | null;
  stream: WhisperAudioStream | null;
  transcriber: RealtimeTranscriber | null;
  slices: Record<number, string>;
  prefix: string;
  previous: VoiceDraft | null;
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
  const [modelAvailable, setModelAvailable] = useState(
    () => !!getWhisperModel(),
  );
  const [voice, setVoice] = useState<VoiceDraft>({
    transcript: "",
    finalized: false,
  });
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [actionsWidth, setActionsWidth] = useState(0);

  const recording = useRef<RecordingSession>({
    context: null,
    stream: null,
    transcriber: null,
    slices: {},
    prefix: "",
    previous: null,
    sliceTimer: null,
    starting: false,
    stopping: false,
  });
  const mounted = useRef(true);
  const transcriptInput = useRef<ComponentRef<typeof TextInput>>(null);

  const ownerId = auth.status === "ready" ? auth.user?.uid : undefined;
  const { audio, transcript, finalized: transcriptFinalized } = voice;
  const muted = operation.status === "recording" && operation.muted;
  const progress =
    operation.status === "downloading" ? operation.progress : undefined;
  const downloadPercentage =
    progress && progress.total > 0
      ? Math.min(
          100,
          Math.max(0, Math.round((progress.bytes / progress.total) * 100)),
        )
      : 0;
  const downloadRingProps = useAnimatedProps(
    () => ({
      strokeDashoffset: withTiming(
        ringCircumference * (1 - downloadPercentage / 100),
        { duration: 180, reduceMotion: ReduceMotion.System },
      ),
    }),
    [downloadPercentage],
  );

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
        setModelAvailable(false);
        throw new Error("Download the transcription model before recording.");
      }

      setModelAvailable(true);
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
      recording.current.prefix = voice.transcript;
      recording.current.previous = voice;

      const transcriber = new RealtimeTranscriber(
        { whisperContext: context, audioStream: stream, fs: RNFS },
        {
          audioOutputPath: path,
          audioSliceSec: 25,
          realtimeProcessingPauseMs: 1500,
          initRealtimeAfterMs: 1500,
          transcribeOptions: { language: "en" },
        },
        {
          onTranscribe: (event) => {
            if (event.type !== "transcribe" || !event.data || !mounted.current)
              return;

            recording.current.slices[event.sliceIndex] = cleanTranscript(
              event.data.result,
            );

            const transcript = cleanTranscript(
              Object.entries(recording.current.slices)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([, text]) => text)
                .filter(Boolean)
                .join(" "),
            );

            setVoice((current) => ({
              ...current,
              transcript: cleanTranscript(
                `${recording.current.prefix} ${transcript}`,
              ),
              finalized: false,
            }));
          },
          onError: (message) => {
            if (mounted.current) setError(`Transcription issue: ${message}`);
          },
        },
      );
      recording.current.transcriber = transcriber;
      await transcriber.start();
      setVoice((current) => ({ ...current, finalized: false }));

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

  async function downloadModel() {
    if (operation.status !== "idle") return;

    setError("");
    setOperation({
      status: "downloading",
      progress: { bytes: 0, total: whisperModelSize },
    });

    try {
      await downloadWhisperModel((bytes, total) => {
        if (mounted.current)
          setOperation({ status: "downloading", progress: { bytes, total } });
      });
      if (mounted.current) {
        setModelAvailable(true);
        setOperation({ status: "idle" });
      }
    } catch (cause) {
      if (mounted.current) {
        setOperation({ status: "idle" });
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t download the transcription model.",
        );
      }
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
          setVoice(
            recording.current.previous ?? { transcript: "", finalized: false },
          );
          setError("");

          return;
        }

        setVoice((current) => ({
          ...current,
          audio: {
            uri: `file://${recording.current.outputPath}`,
            mimeType: "audio/wav",
            source: "recording",
          },
        }));

        const context = recording.current.context;
        if (context) {
          const result = await context.transcribe(
            recording.current.outputPath,
            {
              language: "en",
            },
          ).promise;
          const text = cleanTranscript(result.result);
          if (!result.isAborted && text) {
            setVoice((current) => ({
              ...current,
              transcript: cleanTranscript(
                `${recording.current.prefix} ${text}`,
              ),
              finalized: true,
            }));
          } else if (!result.isAborted) {
            setVoice(
              recording.current.previous ?? {
                transcript: "",
                finalized: false,
              },
            );
            setError("");
          }
        }
      }
    } catch (cause) {
      const path = recording.current.outputPath;
      const info = path ? await RNFS.stat(path).catch(() => null) : null;
      if (!info || Number(info.size) <= 44) {
        setVoice(
          recording.current.previous ?? { transcript: "", finalized: false },
        );
        setError("");
      } else {
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t finish the recording.",
        );
      }
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

  async function transcribeAudio(file: AudioFile) {
    setError("");

    try {
      let modelPath = getWhisperModel();
      if (!modelPath) {
        setOperation({
          status: "downloading",
          progress: { bytes: 0, total: whisperModelSize },
        });
        modelPath = await downloadWhisperModel((bytes, total) => {
          if (mounted.current)
            setOperation({ status: "downloading", progress: { bytes, total } });
        });
        if (mounted.current) setModelAvailable(true);
      }

      setOperation({ status: "transcribing" });
      const context = await initWhisper({ filePath: modelPath });
      let text: string;
      try {
        text = await transcribeImportedAudio(context, file.uri);
      } finally {
        await context.release();
      }
      if (!text) {
        if (mounted.current) {
          setVoice(
            file.source === "recording"
              ? (recording.current.previous ?? {
                  transcript: "",
                  finalized: false,
                })
              : { transcript: "", finalized: false },
          );
          setError("");
        }

        return;
      }
      if (mounted.current)
        setVoice((current) => ({
          ...current,
          transcript:
            file.source === "recording"
              ? cleanTranscript(`${recording.current.prefix} ${text}`)
              : text,
          finalized: true,
        }));
    } catch (cause) {
      if (mounted.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn’t transcribe this audio.",
        );
    } finally {
      if (mounted.current) setOperation({ status: "idle" });
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

      const file: AudioFile = {
        uri: destination.uri,
        mimeType:
          source.mimeType === "audio/x-m4a" || suffix.toLowerCase() === ".m4a"
            ? "audio/mp4"
            : source.mimeType || "audio/mp4",
        source: "import",
      };
      setVoice({ transcript: "", finalized: false, audio: file });
      await transcribeAudio(file);
    } catch {
      setError("Couldn’t import this audio. Please try again.");
    }
  }

  function clearCapture() {
    setVoice({ transcript: "", finalized: false });
    recording.current.prefix = "";
    setNote("");
    setCaptureMode("voice");
    setError("");
  }

  async function complete() {
    if (!ownerId || !walkthroughId || operation.status !== "idle") return;

    setError("");
    setOperation({ status: "processing", phase: "identifying" });

    try {
      if (mode === "cloud") {
        const network = await Network.getNetworkStateAsync();
        if (!network.isConnected || network.isInternetReachable === false)
          throw new Error("Connect to the internet to use cloud processing.");
      }

      const rawTranscript = captureMode === "type" ? note : transcript;
      if (!rawTranscript.trim())
        throw new Error("No speech was detected. Try recording again.");

      const results = await extractItems(rawTranscript, mode);

      const now = Date.now();
      const items = results.map((item) => ({
        ...item,
        id: createFirestoreId(ownerId, "items"),
        walkthroughId,
        bannerColor: randomBannerColor(),
        rawTranscript,
        processingMode: mode,
        status: "Open" as const,
        photos: [],
        createdAt: now,
        updatedAt: now,
      }));
      setOperation({ status: "processing", phase: "saving" });
      await createWalkthroughStorage(ownerId).createItems(items);

      if (items.length === 1)
        router.replace({
          pathname: "/walkthrough/item-view",
          params: { walkthroughId, id: items[0].id },
        });
      else router.back();
    } catch (cause) {
      setOperation({
        status: "failed",
        message:
          cause instanceof Error
            ? cause.message
            : "Couldn’t create items. Please try again.",
      });
    }
  }

  const busy = operation.status !== "idle" && operation.status !== "recording";
  const hasDraft = captureMode === "type" ? !!note : !!audio || !!transcript;
  const createButtonStyle = useAnimatedStyle(() => {
    const availableWidth = Math.max(0, actionsWidth - 48);

    return {
      width: withTiming(
        hasDraft ? Math.max(0, (availableWidth - 10) / 2) : availableWidth,
        {
          duration: 180,
          reduceMotion: ReduceMotion.System,
        },
      ),
    };
  }, [actionsWidth, hasDraft]);
  const initialVoice =
    captureMode === "voice" &&
    !hasDraft &&
    (operation.status === "idle" ||
      operation.status === "preparing" ||
      operation.status === "downloading");
  const showModeSelector =
    operation.status === "idle" &&
    (captureMode === "type" || audio?.source !== "recording");
  const mb = (bytes: number) => (bytes / 1000000).toFixed(1);

  if (operation.status === "processing") {
    const saving = operation.phase === "saving";

    return (
      <SafeAreaView style={styles.container}>
        <LoadingState
          description={
            saving
              ? "Adding the items to your walkthrough."
              : "Reading your notes and identifying what needs attention."
          }
        />
      </SafeAreaView>
    );
  }

  if (operation.status === "failed") {
    return (
      <SafeAreaView style={styles.container}>
        <EmptyState
          icon={<ExclamationTriangleIcon size={40} color={colors.accent} />}
          title="Couldn’t create items"
          description={operation.message}
        />

        <View style={styles.actions}>
          <View style={styles.action}>
            <AppButton
              title="Go home"
              variant="secondary"
              onPress={() => router.replace("/(protected)/(tabs)")}
            />
          </View>

          <View style={styles.action}>
            <AppButton
              title="Try again"
              onPress={() => {
                clearCapture();
                setOperation({ status: "idle" });
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.content, styles.content]}
      >
        <View style={styles.section}>
          <AppText variant="title" style={styles.heading}>
            Add items
          </AppText>

          <AppText style={styles.subheading}>
            Describe your walkthrough and let walklog find the items.
          </AppText>
        </View>

        {showModeSelector ? (
          <SegmentedControl
            label="Capture mode"
            value={captureMode}
            onChange={setCaptureMode}
            disabled={operation.status !== "idle"}
            fullWidth
            options={[
              { value: "voice", label: "Voice" },
              { value: "type", label: "Type" },
            ]}
          />
        ) : null}

        {captureMode === "voice" ? (
          <Animated.View
            key="voice"
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={[
              styles.voice,
              (initialVoice || operation.status === "transcribing") &&
                styles.initialVoice,
            ]}
          >
            {!audio &&
            !transcript &&
            (operation.status === "idle" ||
              operation.status === "preparing" ||
              operation.status === "downloading") ? (
              <View style={styles.voiceIntro}>
                <View style={styles.recordControl}>
                  {progress ? (
                    <Svg
                      pointerEvents="none"
                      style={styles.downloadRing}
                      width={112}
                      height={112}
                      viewBox="0 0 112 112"
                    >
                      <Circle
                        cx={56}
                        cy={56}
                        r={51}
                        fill="none"
                        stroke={colors.neutralSoft}
                        strokeWidth={3}
                      />
                      <AnimatedCircle
                        cx={56}
                        cy={56}
                        r={51}
                        fill="none"
                        stroke={colors.accent}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                        animatedProps={downloadRingProps}
                        transform="rotate(-90 56 56)"
                      />
                    </Svg>
                  ) : null}

                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      operation.status === "downloading"
                        ? `Downloading transcription model, ${downloadPercentage}%`
                        : modelAvailable
                          ? "Start recording"
                          : "Download transcription model"
                    }
                    accessibilityState={{ disabled: busy }}
                    disabled={busy}
                    onPress={() =>
                      modelAvailable
                        ? void startRecording()
                        : void downloadModel()
                    }
                    style={styles.bigMic}
                  >
                    {operation.status === "preparing" ? (
                      <ActivityIndicator
                        size="small"
                        color={colors.onAccent}
                        accessibilityLabel="Preparing recording"
                      />
                    ) : operation.status === "downloading" && progress ? (
                      <View style={styles.downloadButtonContent}>
                        <AppText style={styles.downloadButtonSize}>
                          {mb(progress.bytes)} / {mb(progress.total)} MB
                        </AppText>
                      </View>
                    ) : modelAvailable ? (
                      <MicrophoneIcon size={38} color={colors.onAccent} />
                    ) : (
                      <ArrowDownTrayIcon size={34} color={colors.onAccent} />
                    )}
                  </Pressable>
                </View>

                <Animated.View
                  key={
                    operation.status === "preparing" ||
                    operation.status === "downloading"
                      ? operation.status
                      : modelAvailable
                        ? "record"
                        : "download"
                  }
                  entering={fadeIn}
                  layout={layoutTransition}
                  style={styles.voiceStatus}
                >
                  {operation.status === "preparing" ? (
                    <AppText weight="semibold">Preparing</AppText>
                  ) : operation.status === "downloading" && progress ? (
                    <View style={styles.modelDownloadCopy}>
                      <AppText weight="semibold">Downloading model</AppText>
                      <AppText style={styles.modelDownloadDescription}>
                        The transcription model is being downloaded for
                        long-running sessions.
                      </AppText>
                    </View>
                  ) : modelAvailable ? (
                    <AppText weight="semibold">Record</AppText>
                  ) : (
                    <View style={styles.modelDownloadCopy}>
                      <AppText weight="semibold">
                        Download transcription model
                      </AppText>
                      <AppText style={styles.modelDownloadDescription}>
                        Needed for transcription during long-running sessions.
                      </AppText>
                    </View>
                  )}
                </Animated.View>
              </View>
            ) : null}

            {operation.status !== "transcribing" &&
            (operation.status === "recording" || !!transcript) ? (
              <Animated.View
                entering={fadeIn}
                layout={layoutTransition}
                style={styles.section}
              >
                <View style={styles.between}>
                  <AppText weight="semibold">Transcript</AppText>

                  {operation.status === "idle" && transcript ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Edit transcript"
                      onPress={() => transcriptInput.current?.focus()}
                      style={styles.editTranscript}
                    >
                      <PencilSquareIcon size={16} color={colors.muted} />

                      <AppText style={styles.editLabel}>Edit</AppText>
                    </Pressable>
                  ) : null}
                </View>

                <TextInput
                  ref={transcriptInput}
                  accessibilityLabel="Transcript"
                  multiline
                  editable={operation.status === "idle"}
                  value={transcript}
                  onChangeText={(transcript) =>
                    setVoice((current) => ({ ...current, transcript }))
                  }
                  placeholder={
                    muted ? "Microphone muted" : "Your words will appear here"
                  }
                  style={[
                    styles.transcript,
                    operation.status === "idle" && styles.completedTranscript,
                  ]}
                />
              </Animated.View>
            ) : null}

            {operation.status === "downloading" && progress && !!audio ? (
              <Animated.View
                entering={fadeIn}
                layout={layoutTransition}
                style={styles.downloadStatus}
              >
                <ActivityIndicator color={colors.accent} />

                <AppText style={styles.subheading}>
                  {progress.total > 0
                    ? `Downloading model · ${downloadPercentage}%`
                    : "Downloading model"}
                </AppText>
              </Animated.View>
            ) : null}

            {operation.status === "transcribing" ? (
              <LoadingState description="Transcribing audio" />
            ) : null}

            {audio && !transcriptFinalized && operation.status === "idle" ? (
              <AppButton
                title="Retry transcription"
                variant="secondary"
                onPress={() => transcribeAudio(audio)}
              />
            ) : null}

            {!audio && operation.status === "idle" ? (
              <View style={styles.importSection}>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />

                  <AppText style={styles.dividerText}>OR</AppText>

                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={importAudio}
                  style={styles.importButton}
                >
                  <ArrowUpTrayIcon size={20} color={colors.foreground} />

                  <AppText weight="semibold">Import audio</AppText>
                </Pressable>
              </View>
            ) : null}
          </Animated.View>
        ) : (
          <Animated.View
            key="type"
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={styles.section}
          >
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
          </Animated.View>
        )}

        {captureMode === "type" ||
        (captureMode === "voice" && !!audio && operation.status === "idle") ? (
          <Animated.View
            entering={fadeIn}
            exiting={fadeOut}
            layout={layoutTransition}
            style={styles.section}
          >
            <AppText weight="semibold">Process with</AppText>

            <InferenceSelector requiresAudio={captureMode === "voice"} />
          </Animated.View>
        ) : null}

        {error ? (
          <Animated.View entering={fadeIn} layout={layoutTransition}>
            <AppText accessibilityRole="alert" style={styles.error}>
              {error}
            </AppText>
          </Animated.View>
        ) : null}
      </ScrollView>

      {operation.status === "stopping" ? (
        <Animated.View
          entering={fadeIn}
          exiting={fadeOut}
          layout={layoutTransition}
          style={styles.finishing}
        >
          <ActivityIndicator color={colors.accent} />

          <AppText style={styles.subheading}>Finishing recording</AppText>
        </Animated.View>
      ) : null}

      {captureMode === "voice" &&
      (operation.status === "recording" ||
        (audio?.source === "recording" && operation.status === "idle")) ? (
        <Animated.View
          entering={fadeIn}
          exiting={fadeOut}
          layout={layoutTransition}
          style={styles.recordBar}
        >
          {operation.status === "recording" ? (
            <>
              <View style={styles.recordLabel}>
                {!muted ? (
                  <View accessible={false} style={styles.recordDot} />
                ) : null}

                <AppText style={styles.barText}>
                  {muted ? "Microphone muted" : "Listening"}
                </AppText>
              </View>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  muted ? "Unmute microphone" : "Mute microphone"
                }
                onPress={toggleMute}
                style={styles.iconButton}
              >
                {muted ? (
                  <SpeakerXMarkIcon size={22} color={colors.foreground} />
                ) : (
                  <SpeakerWaveIcon size={22} color={colors.foreground} />
                )}
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Stop recording"
                onPress={stopRecording}
                style={styles.stopButton}
              >
                <StopIcon size={20} color={colors.onAccent} />
              </Pressable>
            </>
          ) : (
            <>
              <AppText style={[styles.barText, styles.continueLabel]}>
                Continue recording
              </AppText>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Continue recording"
                disabled={busy}
                onPress={startRecording}
                style={styles.stopButton}
              >
                <MicrophoneIcon size={20} color={colors.onAccent} />
              </Pressable>
            </>
          )}
        </Animated.View>
      ) : null}

      {captureMode === "type" ||
      (captureMode === "voice" && !!audio && operation.status === "idle") ? (
        <Animated.View
          entering={fadeIn}
          exiting={fadeOut}
          layout={layoutTransition}
          style={styles.actions}
          onLayout={(event) => setActionsWidth(event.nativeEvent.layout.width)}
        >
          {hasDraft ? (
            <View style={styles.action}>
              <AppButton
                title="Clear"
                variant="secondary"
                disabled={busy}
                onPress={clearCapture}
              />
            </View>
          ) : null}

          <Animated.View
            style={[
              styles.createAction,
              actionsWidth > 0 ? createButtonStyle : styles.action,
            ]}
          >
            <AppButton
              title="Create items"
              disabled={
                operation.status !== "idle" ||
                (captureMode === "voice"
                  ? !audio || !transcript.trim() || !transcriptFinalized
                  : !note.trim())
              }
              onPress={complete}
            />
          </Animated.View>
        </Animated.View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: colors.background, flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 40,
    gap: 18,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  action: { flex: 1 },
  createAction: { marginLeft: "auto" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  heading: { fontSize: 30, lineHeight: 38, letterSpacing: -0.8 },
  subheading: { color: colors.muted, lineHeight: 22 },
  section: { gap: 8 },
  label: { fontSize: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.foreground,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
  },
  multiline: { minHeight: 100, textAlignVertical: "top" },
  card: {
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 8,
  },
  cardTitle: { fontSize: 18 },
  link: { color: colors.accent },
  danger: { color: colors.danger },
  photo: { width: 96, height: 96, borderRadius: 10 },
  error: { color: colors.danger },
  back: { paddingVertical: 10, alignSelf: "flex-start" },
  editTranscript: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    padding: 4,
  },
  editLabel: { color: colors.muted, fontSize: 13 },
  transcript: {
    color: colors.muted,
    fontFamily: "DMSans_400Regular",
    fontSize: 16,
    lineHeight: 24,
    minHeight: 100,
    padding: 0,
    textAlignVertical: "top",
  },
  completedTranscript: { color: colors.foreground },
  voice: { gap: 12 },
  initialVoice: { flexGrow: 1 },
  importSection: { gap: 20 },
  importButton: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
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
  },
  recordControl: {
    alignItems: "center",
    height: 112,
    justifyContent: "center",
    width: 112,
  },
  downloadRing: { left: 0, position: "absolute", top: 0 },
  downloadButtonContent: { alignItems: "center" },
  downloadButtonSize: {
    color: colors.onAccent,
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
  modelDownloadCopy: { alignItems: "center", gap: 4, maxWidth: 320 },
  voiceStatus: { alignItems: "center" },
  downloadStatus: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 24,
  },
  modelDownloadDescription: {
    color: colors.muted,
    lineHeight: 22,
    textAlign: "center",
  },
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
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 21,
    backgroundColor: colors.background,
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  recordLabel: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingLeft: 12,
  },
  recordDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.danger,
  },
  barText: { color: colors.muted },
  continueLabel: { flex: 1, paddingLeft: 12 },
  stopButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
