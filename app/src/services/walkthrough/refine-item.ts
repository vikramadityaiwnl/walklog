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
  const prompt = `You refine a single property inspection punch item. Preserve the reported facts and do not invent damage, dimensions, materials, locations, or repairs. Produce a short checklist of concrete physical repair or corrective work that resolves the observed issue, not administrative steps such as contacting a contractor, obtaining quotes, or making a list. For example, a broken fence that needs repair could have the action "Repair the damaged fence"; do not assume which parts or materials need replacing. Use the photo only if one is supplied, and do not claim to have inspected a photo otherwise. If the issue or intended corrective work is too unclear to suggest a specific physical action without guessing, return status "needs_context", an empty actions array, and a brief message asking the user to add the missing context. Otherwise return status "ready" and at least one action. Return only JSON with status ("ready" or "needs_context"), message (string or null), issueSummary, location, trade, priority (High, Medium, Low or null), and actions (array of concise strings). Use null for unknown trade or priority. Item: ${JSON.stringify(details)}`;
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
    if (record.status === "needs_context")
      throw new Error(
        "There isn’t enough context to suggest a repair. Add more detail about the issue and what needs to be fixed, then try again.",
      );

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
      record.status !== "ready" ||
      typeof record.issueSummary !== "string" ||
      !record.issueSummary.trim() ||
      !actions.length
    )
      throw new Error(
        "Couldn’t suggest a clear repair. Add more detail about the issue and try again.",
      );

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
