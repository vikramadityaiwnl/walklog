import { Directory, File, Paths } from "expo-file-system";

function directorySize(directory: Directory): number {
  if (!directory.exists) return 0;

  return directory
    .list()
    .reduce(
      (size, entry) =>
        size +
        (entry instanceof File
          ? Number(entry.size ?? 0)
          : directorySize(entry)),
      0,
    );
}

export function getTemporaryCacheSize(): number {
  return directorySize(new Directory(Paths.cache));
}

export function clearTemporaryCache(): void {
  const cache = new Directory(Paths.cache);
  if (cache.exists) for (const entry of cache.list()) entry.delete();
}
