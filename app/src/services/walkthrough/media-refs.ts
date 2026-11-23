import * as FileSystem from "expo-file-system/legacy";

const directory = `${FileSystem.documentDirectory}walkthrough-photos/`;

export function localMediaId(uri?: string): string | undefined {
  if (!uri || !uri.startsWith("file://")) return undefined;

  const match = uri.match(/\/walkthrough-photos\/([a-zA-Z0-9-]+)\.jpg$/);

  return match?.[1];
}

export function localMediaUri(id: string): string {
  if (!/^[a-zA-Z0-9-]+$/.test(id)) throw new Error("Invalid image ID");

  return `${directory}${id}.jpg`;
}

export function isRemoteMedia(uri?: string): uri is string {
  return !!uri && /^https:\/\//i.test(uri);
}

export function mediaStoragePath(
  url: string,
  ownerId: string,
): string | undefined {
  try {
    const encoded = url.split("/o/")[1]?.split("?")[0];
    if (!encoded) return undefined;

    const path = decodeURIComponent(encoded);
    const prefix = `users/${ownerId}/media/`;

    return path.startsWith(prefix) &&
      /^[a-zA-Z0-9-]+\.jpg$/.test(path.slice(prefix.length))
      ? path
      : undefined;
  } catch {
    return undefined;
  }
}
