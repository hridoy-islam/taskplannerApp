import { isCancel } from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import axiosInstance from './axios';
import { toast } from './toast';

/** Most files a user can pick at once (like WhatsApp's limit per send). */
export const MAX_FILES_PER_PICK = 10;

/** A file picked for a chat, ready to upload. */
export type PickedFile = {
  id: string;
  uri: string;
  name: string;
  mime: string;
  size?: number;
  isImage: boolean;
  /** The browser File (web only). */
  webFile?: File;
};

export type UploadOptions = {
  signal?: AbortSignal;
  /** 0–1. */
  onProgress?: (fraction: number) => void;
};

let seq = 0;
const newId = () => `upload-${Date.now()}-${seq++}`;

/** Any document (PDF, Word, Excel, …), several at once. */
export async function pickDocuments(): Promise<PickedFile[]> {
  const result = await DocumentPicker.getDocumentAsync({ multiple: true, copyToCacheDirectory: true, type: '*/*' });
  if (result.canceled) return [];
  return limit(
    result.assets.map((a) => {
      const mime = a.mimeType || 'application/octet-stream';
      return { id: newId(), uri: a.uri, name: a.name || 'file', mime, size: a.size, isImage: mime.startsWith('image/'), webFile: a.file };
    })
  );
}

/** Pictures from the library, several at once. */
export async function pickPhotos(): Promise<PickedFile[]> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    toast.error('Photo access needed', 'Allow photo access to send pictures.');
    return [];
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.8,
    allowsMultipleSelection: true,
    selectionLimit: MAX_FILES_PER_PICK,
    orderedSelection: true,
  });
  if (result.canceled) return [];
  return limit(
    result.assets.map((a) => {
      const mime = a.mimeType ?? 'image/jpeg';
      return {
        id: newId(),
        uri: a.uri,
        name: a.fileName ?? `photo.${mime.split('/')[1] ?? 'jpg'}`,
        mime,
        size: a.fileSize,
        isImage: true,
        webFile: a.file ?? undefined,
      };
    })
  );
}

function limit(files: PickedFile[]) {
  if (files.length > MAX_FILES_PER_PICK) {
    toast.info(`Only ${MAX_FILES_PER_PICK} files at a time`, `The first ${MAX_FILES_PER_PICK} will be sent.`);
    return files.slice(0, MAX_FILES_PER_PICK);
  }
  return files;
}

/** The form-data value for a picked file (a `{ uri, name, type }` on native, a real File on web). */
async function formFile(file: PickedFile): Promise<any> {
  if (Platform.OS !== 'web') return { uri: file.uri, name: file.name, type: file.mime };
  if (file.webFile) return file.webFile;
  const blob = await (await fetch(file.uri)).blob();
  return new File([blob], file.name, { type: file.mime });
}

/**
 * Uploads a chat file to `/documents` (same as the web) and returns its URL.
 * `fileType` is 'taskDoc' for task chats and 'groupDoc' for group chats.
 */
export async function uploadChatFile(
  entityId: string,
  fileType: 'taskDoc' | 'groupDoc',
  file: PickedFile,
  { signal, onProgress }: UploadOptions = {}
): Promise<string> {
  const form = new FormData();
  form.append('entityId', entityId);
  form.append('file_type', fileType);
  form.append('file', await formFile(file));
  const res = await axiosInstance.post('/documents', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    signal,
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(Math.min(1, e.loaded / e.total));
    },
  });
  const url = res.data?.data?.fileUrl || res.data?.url || res.data?.data?.url;
  if (!url) throw new Error('Upload failed');
  return url as string;
}

export const isUploadCancelled = (e: unknown) => isCancel(e) || (e as any)?.name === 'CanceledError' || (e as any)?.name === 'AbortError';

/** "2.4 MB", "820 KB". */
export function formatFileSize(bytes?: number) {
  if (!bytes || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
