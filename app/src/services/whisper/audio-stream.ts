import type { AudioStream, AudioStreamBuffer } from "expo-audio";
import type {
  AudioStreamConfig,
  AudioStreamData,
  AudioStreamInterface,
} from "whisper.rn/realtime-transcription";

export class WhisperAudioStream implements AudioStreamInterface {
  private stream: AudioStream;

  private onDataCallback?: (data: AudioStreamData) => void;
  private onErrorCallback?: (error: string) => void;
  private onStatusCallback?: (recording: boolean) => void;

  constructor(stream: AudioStream) {
    this.stream = stream;
  }

  async initialize(config: AudioStreamConfig): Promise<void> {
    if (
      config.sampleRate !== 16000 ||
      config.channels !== 1 ||
      config.bitsPerSample !== 16
    )
      throw new Error("Unsupported recording format.");
  }

  async start(): Promise<void> {
    await this.stream.start();
    if (this.stream.sampleRate !== 16000 || this.stream.channels !== 1) {
      this.stream.stop();

      throw new Error(
        "This device couldn’t start the microphone in the required format.",
      );
    }

    this.onStatusCallback?.(true);
  }

  async stop(): Promise<void> {
    if (this.stream.isStreaming) this.stream.stop();
    this.onStatusCallback?.(false);
  }

  isRecording(): boolean {
    return this.stream.isStreaming;
  }

  onData(callback: (data: AudioStreamData) => void): void {
    this.onDataCallback = callback;
  }

  onError(callback: (error: string) => void): void {
    this.onErrorCallback = callback;
  }

  onStatusChange(callback: (recording: boolean) => void): void {
    this.onStatusCallback = callback;
  }

  handleBuffer(buffer: AudioStreamBuffer): void {
    if (buffer.sampleRate !== 16000 || buffer.channels !== 1) {
      this.onErrorCallback?.("Microphone audio format changed unexpectedly.");

      return;
    }
    this.onDataCallback?.({
      data: new Uint8Array(buffer.data),
      sampleRate: buffer.sampleRate,
      channels: buffer.channels,
      timestamp: buffer.timestamp,
    });
  }

  async release(): Promise<void> {
    await this.stop();

    this.onDataCallback = undefined;
    this.onErrorCallback = undefined;
    this.onStatusCallback = undefined;
  }
}
