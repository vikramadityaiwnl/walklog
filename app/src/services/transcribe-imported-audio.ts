import type { WhisperContext } from "whisper.rn";
import { cleanTranscript } from "./transcript";

export async function transcribeImportedAudio(
  context: WhisperContext,
  uri: string,
): Promise<string> {
  let audio;
  try {
    const { decodeAudioData } = await import("react-native-audio-api");
    audio = await decodeAudioData(uri, 16000);
  } catch {
    throw new Error("Couldn’t read this audio file. Try another recording.");
  }
  if (
    audio.sampleRate !== 16000 ||
    audio.numberOfChannels < 1 ||
    audio.length === 0
  )
    throw new Error("Couldn’t prepare this audio for transcription.");

  const channels = Array.from({ length: audio.numberOfChannels }, (_, index) =>
    audio.getChannelData(index),
  );
  const chunkSize = 16000 * 30;
  const parts: string[] = [];
  for (let start = 0; start < audio.length; start += chunkSize) {
    const length = Math.min(chunkSize, audio.length - start);
    const samples = new Float32Array(length);
    for (const channel of channels) {
      for (let index = 0; index < length; index++)
        samples[index] += channel[start + index] / channels.length;
    }
    const pcm = new Int16Array(length);
    for (let index = 0; index < length; index++) {
      const sample = Math.max(-1, Math.min(1, samples[index]));
      pcm[index] = Math.round(sample < 0 ? sample * 32768 : sample * 32767);
    }
    const result = await context.transcribeData(pcm.buffer, {
      language: "en",
      prompt: parts.join(" ").slice(-300),
    }).promise;
    if (result.isAborted)
      throw new Error("Transcription stopped. Please try again.");
    const text = cleanTranscript(result.result);
    if (text) parts.push(text);
  }

  return cleanTranscript(parts.join(" "));
}
