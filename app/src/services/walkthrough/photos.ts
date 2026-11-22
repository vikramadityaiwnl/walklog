import {
  collection,
  doc,
  getFirestore,
} from "@react-native-firebase/firestore";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import type { PunchItem } from "../../models/walkthrough";

const directory = `${FileSystem.documentDirectory}walkthrough-photos/`;

export async function selectItemPhoto(source: "camera" | "library") {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      `Allow ${source === "camera" ? "camera" : "photo library"} access in your device settings to add a photo.`,
    );

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    quality: 1,
  };
  const result =
    source === "camera"
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (result.canceled) return null;

  const asset = result.assets[0];
  const image = await ImageManipulator.manipulateAsync(
    asset.uri,
    Math.max(asset.width, asset.height) > 1600
      ? [
          {
            resize:
              asset.width >= asset.height ? { width: 1600 } : { height: 1600 },
          },
        ]
      : [],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );
  const info = await FileSystem.getInfoAsync(image.uri);
  if (!info.exists || info.size > 3 * 1024 * 1024)
    throw new Error(
      "This image is too large after compression. Choose a smaller image.",
    );
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  const uri = `${directory}${doc(collection(getFirestore(), "media-ids")).id}.jpg`;
  await FileSystem.copyAsync({ from: image.uri, to: uri });

  return { localUri: uri };
}

export async function deleteItemPhotos(photos: PunchItem["photos"]) {
  await Promise.all(
    photos
      .filter((photo) => photo.localUri.startsWith(directory))
      .map((photo) =>
        FileSystem.deleteAsync(photo.localUri, { idempotent: true }),
      ),
  );
}
