import {
  collection,
  doc,
  getFirestore,
} from "@react-native-firebase/firestore";
import { requireOptionalNativeModule } from "expo";
import { File } from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import type { ImagePickerAsset } from "expo-image-picker";
import { createVideoPlayer } from "expo-video";
import { generateText } from "../firebase/ai";
import { parseItems, type ExtractedItem } from "./extract-items";
import { frameDirectory } from "./media-refs";

interface VideoItem extends ExtractedItem {
  photos: { localUri: string }[];
}

const prompt = `Analyze this walkthrough video and its audio for distinct, actionable property or site issues. Do not invent defects or details. Return only a JSON array. Each object must contain issueSummary, location, trade, priority, missingInfoHint, and timestamps. Use null for unknown fields. Priority must be High, Medium, Low, or null. timestamps must be an array of up to two numbers in seconds from the start of the video provided, showing the issue clearly. If the issue is not visibly shown, return an empty timestamps array. If there are no actionable issues, return [].`;

interface VideoNativeModule {
  isVideoCameraAvailable(): Promise<boolean>;
  videoDuration(uri: string): Promise<number>;
  exportVideoChunk(uri: string, start: number, end: number): Promise<string>;
}

const native =
  requireOptionalNativeModule<VideoNativeModule>("FirebaseAiHybrid");

function videoNative(): VideoNativeModule {
  if (
    !native ||
    typeof native.exportVideoChunk !== "function" ||
    typeof native.isVideoCameraAvailable !== "function"
  )
    throw new Error("Install a new development build to use video capture.");

  return native;
}

export function isVideoCameraAvailable(): Promise<boolean> {
  return videoNative().isVideoCameraAvailable();
}

interface VideoResult {
  value: unknown;
  offset: number;
  duration: number;
}

async function analyzeVideo(video: ImagePickerAsset): Promise<VideoResult[]> {
  const bridge = videoNative();
  const duration = await bridge.videoDuration(video.uri);

  const file = new File(video.uri);
  const size = video.fileSize || file.size || 0;
  const mimeType =
    video.mimeType ||
    (video.uri.toLowerCase().includes(".mov")
      ? "video/quicktime"
      : "video/mp4");

  if (!mimeType.startsWith("video/"))
    throw new Error("This file is not a supported video.");

  const results: VideoResult[] = [];

  async function analyze(
    uri: string,
    type: string,
    start: number,
    end: number,
  ) {
    const response = await generateText(prompt, "cloud", {
      uri,
      mimeType: type,
    });

    let values: unknown;
    try {
      values = JSON.parse(
        response.text
          .replace(/^```(?:json)?\s*/i, "")
          .replace(/\s*```$/, "")
          .trim(),
      );
    } catch {
      throw new Error("The video could not be organized. Please try again.");
    }

    if (!Array.isArray(values))
      throw new Error("The video could not be organized. Please try again.");

    results.push(
      ...values.map((value) => ({
        value,
        offset: start,
        duration: end - start,
      })),
    );
  }

  async function processChunk(start: number, end: number): Promise<void> {
    const uri = await bridge.exportVideoChunk(video.uri, start, end);

    try {
      const chunk = new File(uri);
      if (!chunk.exists || !chunk.size)
        throw new Error("Couldn’t prepare this part of the video.");

      if (chunk.size > 14_000_000) {
        if (end - start <= 2)
          throw new Error("Couldn’t prepare this video for processing.");

        const midpoint = start + (end - start) / 2;
        await FileSystem.deleteAsync(uri, { idempotent: true });
        await processChunk(start, midpoint);
        await processChunk(midpoint, end);
      } else {
        await analyze(uri, "video/mp4", start, end);
      }
    } finally {
      await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
    }
  }

  if (size > 0 && size <= 14_000_000)
    await analyze(video.uri, mimeType, 0, duration);
  else
    for (let start = 0; start < duration; start += 60)
      await processChunk(start, Math.min(start + 60, duration));

  return results;
}

export async function extractVideoItems(
  video: ImagePickerAsset,
  staged: { localUri: string }[],
  frameFailures: { count: number },
): Promise<VideoItem[]> {
  const values = await analyzeVideo(video);
  const player = createVideoPlayer(null);
  const items: VideoItem[] = [];

  try {
    await player.replaceAsync(video.uri);
    await FileSystem.makeDirectoryAsync(frameDirectory, {
      intermediates: true,
    });

    for (const result of values) {
      const { value, offset, duration } = result;
      if (!value || typeof value !== "object") continue;

      const item = parseItems(JSON.stringify([value]))[0];
      if (!item) continue;

      const record = value as Record<string, unknown>;
      const times = Array.isArray(record.timestamps) ? record.timestamps : [];
      const photos: { localUri: string }[] = [];

      for (const time of times.slice(0, 2)) {
        if (
          typeof time !== "number" ||
          !Number.isFinite(time) ||
          time < 0 ||
          time > duration
        )
          continue;

        try {
          const [thumbnail] = await player.generateThumbnailsAsync(
            Math.min(time, Math.max(0, duration - 0.05)) + offset,
            {
              maxWidth: 1600,
              maxHeight: 1600,
            },
          );

          if (!thumbnail) throw new Error("Frame unavailable.");

          const context =
            ImageManipulator.ImageManipulator.manipulate(thumbnail);
          const image = await context.renderAsync();
          const saved = await image.saveAsync({
            compress: 0.85,
            format: ImageManipulator.SaveFormat.JPEG,
          });

          const info = await FileSystem.getInfoAsync(saved.uri);
          if (!info.exists || info.size > 3 * 1024 * 1024)
            throw new Error("Frame too large.");

          const id = `frame-${doc(collection(getFirestore(), "media-ids")).id}`;
          const localUri = `${frameDirectory}${id}.jpg`;

          await FileSystem.copyAsync({ from: saved.uri, to: localUri });

          const photo = { localUri };

          staged.push(photo);
          photos.push(photo);
        } catch {}
      }

      if (times.length && !photos.length) frameFailures.count += 1;

      items.push({ ...item, photos });
    }
  } finally {
    player.release();
  }

  if (!items.length)
    throw new Error("No issues were identified. Try another video.");

  return items;
}
