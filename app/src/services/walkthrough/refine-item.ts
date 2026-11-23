import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import { Image } from "expo-image";
import { getStorage, ref, writeToFile } from "@react-native-firebase/storage";
import { generateText, generateTextWithImages } from "../firebase/ai";
import { localMediaUri, mediaStoragePath } from "./media-refs";
import type { PunchItem, Priority } from "../../models/walkthrough";

export interface ItemRefinement {
  issueSummary: string;
  location: string;
  trade?: string;
  priority?: Priority;
  actions: string[];
}

export function refinementUsesPhoto(mode: "device" | "cloud"): boolean {
  return mode === "cloud" || Platform.OS === "android";
}

export async function refineItem(
  item: PunchItem,
  mode: "device" | "cloud",
  ownerId: string,
): Promise<ItemRefinement> {
  const details = {
    issueSummary: item.issueSummary,
    location: item.location,
    trade: item.trade ?? null,
    priority: item.priority ?? null,
    notes: item.rawTranscript,
  };
  const prompt = `Refine this single property inspection item. Preserve the facts and do not invent details. Suggest a short checklist of distinct, practical next steps appropriate to the issue. If no photo is provided, keep advice generic and do not claim visual inspection. Return only JSON with issueSummary, location, trade, priority (High, Medium, Low or null), and actions (an array of concise strings). Use null for unknown trade or priority. Item: ${JSON.stringify(details)}`;
  const temporaryUris: string[] = [];
  try {
    const photos = !refinementUsesPhoto(mode)
      ? []
      : mode === "cloud"
        ? item.photos
        : item.photos.slice(0, 1);
    const photoUris: string[] = [];
    for (const photo of photos) {
      let uri = photo.localUri;
      if (uri.startsWith("https://")) {
        const path = mediaStoragePath(uri, ownerId);
        const id = path
          ?.split("/")
          .pop()
          ?.replace(/\.jpg$/, "");
        const localUri = id ? localMediaUri(id) : undefined;
        const cachedPath = await Image.getCachePathAsync(uri).catch(() => null);
        const cachedUri = cachedPath
          ? cachedPath.startsWith("file://")
            ? cachedPath
            : `file://${cachedPath}`
          : undefined;
        if (localUri && (await FileSystem.getInfoAsync(localUri)).exists) {
          uri = localUri;
        } else if (
          cachedUri &&
          (await FileSystem.getInfoAsync(cachedUri)).exists
        ) {
          uri = cachedUri;
        } else {
          const temporaryUri = `${FileSystem.cacheDirectory}refinement-${Date.now()}-${photoUris.length}.jpg`;
          temporaryUris.push(temporaryUri);
          try {
            if (path) {
              await writeToFile(ref(getStorage(), path), temporaryUri);
            } else {
              const download = await FileSystem.downloadAsync(
                uri,
                temporaryUri,
              );
              if (download.status < 200 || download.status >= 300)
                throw new Error("Photo download failed.");
            }
          } catch {
            throw new Error(
              "Couldn’t load an attached photo. Check your connection and try again.",
            );
          }
          uri = temporaryUri;
        }
      }
      photoUris.push(uri);
    }
    const result =
      mode === "cloud" && photoUris.length
        ? await generateTextWithImages(prompt, photoUris)
        : await generateText(
            prompt,
            mode,
            photoUris[0]
              ? { uri: photoUris[0], mimeType: "image/jpeg" }
              : undefined,
          );
    const value: unknown = JSON.parse(
      result.text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "")
        .trim(),
    );
    if (!value || typeof value !== "object")
      throw new Error("Invalid response");
    const record = value as Record<string, unknown>;
    const actions = Array.isArray(record.actions)
      ? record.actions
          .filter(
            (action): action is string =>
              typeof action === "string" && !!action.trim(),
          )
          .map((action) => action.trim())
      : typeof record.recommendedAction === "string" &&
          record.recommendedAction.trim()
        ? [record.recommendedAction.trim()]
        : [];
    if (
      typeof record.issueSummary !== "string" ||
      !record.issueSummary.trim() ||
      !actions.length
    )
      throw new Error("Invalid response");

    return {
      issueSummary: record.issueSummary.trim(),
      location:
        typeof record.location === "string"
          ? record.location.trim()
          : item.location,
      trade:
        typeof record.trade === "string" && record.trade.trim()
          ? record.trade.trim()
          : undefined,
      priority: (["High", "Medium", "Low"] as const).find(
        (value) => value === record.priority,
      ),
      actions,
    };
  } finally {
    await Promise.all(
      temporaryUris.map((uri) =>
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {}),
      ),
    );
  }
}
