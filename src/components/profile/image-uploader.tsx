import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';

import { Button } from '@/components/ui/button';
import axiosInstance from '@/lib/axios';
import { getErrorMessage, toastError } from '@/lib/toast';

type ImageUploaderProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Id of the user the picture belongs to. */
  entityId?: string;
  /** Called with the API response after a successful upload. */
  onUploadComplete?: (data: unknown) => void;
  title?: string;
};

type PickedImage = { uri: string; name: string; type: string };

/**
 * "Upload Picture" dialog: pick an image, preview it, then upload it the same way the
 * web app does (POST /documents with entityId, file_type "profile" and the file).
 */
export function ImageUploader({
  open,
  onOpenChange,
  entityId,
  onUploadComplete,
  title = 'Upload Picture',
}: ImageUploaderProps) {
  const [image, setImage] = useState<PickedImage | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setImage(null);
    setProgress(0);
    setError(null);
  };

  const close = () => {
    if (uploading) return;
    reset();
    onOpenChange(false);
  };

  /** Gets an image from the photo library or the camera. */
  const pickImage = async (source: 'library' | 'camera' = 'library') => {
    setError(null);

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(
        source === 'camera' ? 'Allow camera access to take a picture.' : 'Allow photo access to choose a picture.'
      );
      return;
    }

    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    let result: ImagePicker.ImagePickerResult;
    try {
      result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(options)
          : await ImagePicker.launchImageLibraryAsync(options);
    } catch {
      // e.g. no camera available (simulator).
      setError(source === 'camera' ? 'The camera is not available on this device.' : 'Could not open your photos.');
      return;
    }
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const type = asset.mimeType ?? 'image/jpeg';
    setImage({
      uri: asset.uri,
      type,
      name: asset.fileName ?? `profile.${type.split('/')[1] ?? 'jpg'}`,
    });
  };

  const upload = async () => {
    if (!image || !entityId) return;

    setUploading(true);
    setError(null);
    setProgress(0);

    try {
      const formData = new FormData();
      formData.append('entityId', entityId);
      formData.append('file_type', 'profile');
      if (Platform.OS === 'web') {
        // On web the picker returns a blob/data URI, so send a real File.
        const blob = await (await fetch(image.uri)).blob();
        formData.append('file', new File([blob], image.name, { type: image.type }));
      } else {
        formData.append('file', { uri: image.uri, name: image.name, type: image.type } as any);
      }

      const response = await axiosInstance.post('/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (event.total) setProgress(Math.round((event.loaded * 100) / event.total));
        },
      });

      onUploadComplete?.(response.data);
      reset();
      onOpenChange(false);
    } catch (e) {
      // Keep the dialog open so it can be retried; show the backend's reason.
      setError(getErrorMessage(e, 'An error occurred while uploading the image. Please try again.'));
      toastError(e, 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close}>
      <View className="flex-1 items-center justify-center bg-black/60 px-5">
        <Pressable className="absolute inset-0" onPress={close} accessibilityLabel="Close" />

        <View className="w-full max-w-md gap-4 rounded-2xl bg-white p-5">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-slate-900">{title}</Text>
            <Pressable
              onPress={close}
              disabled={uploading}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={20} tintColor="#0f172a" />
            </Pressable>
          </View>

          {image ? (
            <View className="items-center">
              <View>
                <Image
                  source={{ uri: image.uri }}
                  style={{ width: 160, height: 160, borderRadius: 80 }}
                  contentFit="cover"
                  accessibilityLabel="Selected picture"
                />
                {!uploading ? (
                  <Pressable
                    onPress={reset}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Remove picture"
                    className="absolute right-1 top-1 h-8 w-8 items-center justify-center rounded-full bg-red-600"
                  >
                    <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor="#ffffff" />
                  </Pressable>
                ) : null}
              </View>
              {!uploading ? (
                <View className="mt-3 flex-row gap-5">
                  <Pressable onPress={() => pickImage('library')} accessibilityRole="button" hitSlop={6}>
                    <Text className="text-sm font-semibold text-blue-600">Choose another</Text>
                  </Pressable>
                  <Pressable onPress={() => pickImage('camera')} accessibilityRole="button" hitSlop={6}>
                    <Text className="text-sm font-semibold text-blue-600">Retake photo</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ) : (
            <View className="flex-row gap-3">
              <SourceButton
                label="Choose photo"
                hint="From your library"
                icon={{ ios: 'photo', android: 'image', web: 'image' }}
                onPress={() => pickImage('library')}
              />
              <SourceButton
                label="Take photo"
                hint="Use the camera"
                icon={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }}
                onPress={() => pickImage('camera')}
              />
            </View>
          )}

          {uploading ? (
            <View className="gap-1">
              <View className="h-2 overflow-hidden rounded-full bg-slate-100">
                <View className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
              </View>
              <Text className="text-center text-xs text-slate-500">Uploading… {progress}%</Text>
            </View>
          ) : null}

          {error ? <Text className="text-sm font-medium text-red-600">{error}</Text> : null}

          <View className="flex-row gap-3">
            <Button title="Cancel" variant="dark" onPress={close} disabled={uploading} className="flex-1" />
            <Button title="Upload" onPress={upload} loading={uploading} disabled={!image} className="flex-1" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

function SourceButton({
  label,
  hint,
  icon,
  onPress,
}: {
  label: string;
  hint: string;
  icon: SymbolViewProps['name'];
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="flex-1 items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-3 py-8 active:bg-slate-50"
    >
      <SymbolView name={icon} size={32} tintColor="#64748b" />
      <Text className="text-[15px] font-semibold text-slate-900">{label}</Text>
      <Text className="text-xs text-slate-500">{hint}</Text>
    </Pressable>
  );
}
