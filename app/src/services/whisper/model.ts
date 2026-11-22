import { File, Paths } from "expo-file-system";

const modelUrl =
  "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin";
const modelSize = 77691713;
const model = new File(Paths.document, "whisper-tiny-multilingual.bin");
const partial = new File(Paths.cache, "whisper-tiny-download.bin");

export function getWhisperModel(): string | null {
  return model.exists && model.size === modelSize ? model.uri : null;
}

export async function downloadWhisperModel(
  onProgress: (bytes: number, total: number) => void,
): Promise<string> {
  if (partial.exists) partial.delete();
  const task = File.createDownloadTask(modelUrl, partial, {
    onProgress: (progress) =>
      onProgress(
        progress.bytesWritten,
        progress.totalBytes > 0 ? progress.totalBytes : modelSize,
      ),
  });
  try {
    const downloaded = await task.downloadAsync();
    if (!downloaded || downloaded.size !== modelSize)
      throw new Error("The model download was incomplete. Please try again.");
    if (model.exists) model.delete();
    downloaded.move(model);

    return model.uri;
  } catch (error) {
    if (partial.exists) partial.delete();
    throw error;
  }
}
