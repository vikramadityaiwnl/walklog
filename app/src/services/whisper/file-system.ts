import { File } from "expo-file-system";

function getFile(path: string) {
  return new File(path.startsWith("file://") ? path : `file://${path}`);
}

export const whisperFileSystem = {
  async writeFile(path: string, data: string) {
    await getFile(path).write(data, { encoding: "base64" });
  },
  async appendFile(path: string, data: string) {
    await getFile(path).write(data, { encoding: "base64", append: true });
  },
  async readFile(path: string) {
    return getFile(path).base64();
  },
  async exists(path: string) {
    return getFile(path).exists;
  },
  async unlink(path: string) {
    getFile(path).delete();
  },
};
