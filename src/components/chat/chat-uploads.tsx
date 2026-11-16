import { Image } from 'expo-image';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatFileSize,
  isUploadCancelled,
  type PickedFile,
  pickDocuments,
  pickPhotos,
  type UploadOptions,
} from '@/lib/chat-uploads';
import { getErrorMessage, toastError } from '@/lib/toast';

type Status = 'queued' | 'uploading' | 'sending' | 'failed';
export type UploadItem = PickedFile & {
  progress: number;
  status: Status;
  /** Set once the file is uploaded, so a retry after a failed send doesn't upload it again. */
  url?: string;
  /** Why it failed (shown on the card). */
  error?: string;
};
type Job = PickedFile & { url?: string };

/* ------------------------------------------------------------------ */
/* Queue                                                               */
/* ------------------------------------------------------------------ */

/**
 * WhatsApp-style upload queue for a chat. Files upload one at a time, in the order picked, so
 * they arrive in that order; each one is sent as a file message as soon as it finishes.
 * Anything still queued or uploading can be cancelled.
 */
export function useChatUploads({
  upload,
  send,
}: {
  /** Uploads one file and resolves with its URL. */
  upload: (file: PickedFile, options: UploadOptions) => Promise<string>;
  /** Sends the uploaded file's URL as a chat message (shows its own error). */
  send: (url: string) => Promise<void>;
}) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  const queue = useRef<Job[]>([]);
  const controllers = useRef(new Map<string, AbortController>());
  const running = useRef(false);
  const alive = useRef(true);
  // Latest callbacks (send depends on the reply being composed, etc.).
  const uploadRef = useRef(upload);
  const sendRef = useRef(send);
  useEffect(() => {
    uploadRef.current = upload;
    sendRef.current = send;
  });

  const patch = useCallback((id: string, change: Partial<UploadItem>) => {
    if (alive.current) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...change } : i)));
  }, []);
  const drop = useCallback((id: string) => {
    if (alive.current) setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    while (queue.current.length && alive.current) {
      const job = queue.current.shift()!;
      const controller = new AbortController();
      controllers.current.set(job.id, controller);
      let url = job.url;
      try {
        if (!url) {
          patch(job.id, { status: 'uploading', progress: 0, error: undefined });
          url = await uploadRef.current(job, {
            signal: controller.signal,
            onProgress: (p) => patch(job.id, { progress: p }),
          });
        }
        if (controller.signal.aborted) {
          drop(job.id);
          continue;
        }
        patch(job.id, { status: 'sending', progress: 1, url, error: undefined });
        await sendRef.current(url);
        drop(job.id); // sent: it now shows as a normal message
      } catch (e) {
        if (controller.signal.aborted || isUploadCancelled(e)) {
          drop(job.id); // cancelled by the user
        } else {
          // Keep the card with Retry / Remove. `url` is set when only the send failed.
          patch(job.id, {
            status: 'failed',
            url,
            error: url ? 'Not sent' : getErrorMessage(e, 'Upload failed'),
          });
        }
      } finally {
        controllers.current.delete(job.id);
      }
    }
    running.current = false;
  }, [patch, drop]);

  const add = useCallback(
    (files: PickedFile[]) => {
      if (!files.length) return;
      setItems((prev) => [...prev, ...files.map((f) => ({ ...f, progress: 0, status: 'queued' as const }))]);
      queue.current.push(...files);
      pump();
    },
    [pump]
  );

  /** Removes a waiting or failed file, or stops one that is uploading. */
  const cancel = useCallback(
    (id: string) => {
      const queued = queue.current.findIndex((f) => f.id === id);
      if (queued >= 0) {
        queue.current.splice(queued, 1);
        drop(id);
        return;
      }
      const controller = controllers.current.get(id);
      if (controller) controller.abort();
      else drop(id); // failed
    },
    [drop]
  );

  /** Puts a failed file back in the queue (only re-sends if it was already uploaded). */
  const retry = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      // Ignore a double tap (already re-queued).
      if (!item || item.status !== 'failed' || queue.current.some((j) => j.id === id)) return;
      const { progress: _p, status: _s, error: _e, ...job } = item;
      queue.current.push(job);
      patch(id, { status: 'queued', error: undefined });
      pump();
    },
    [patch, pump]
  );

  // Leaving the chat stops everything.
  useEffect(() => {
    alive.current = true;
    const active = controllers.current;
    return () => {
      alive.current = false;
      queue.current = [];
      active.forEach((c) => c.abort());
    };
  }, []);

  return { items, add, cancel, retry, busy: items.some((i) => i.status !== 'failed') };
}

/* ------------------------------------------------------------------ */
/* Queue cards (outgoing side, just above the composer)                */
/* ------------------------------------------------------------------ */

const FILE_ICON: SymbolViewProps['name'] = { ios: 'doc.fill', android: 'description', web: 'description' };
const CLOSE_ICON: SymbolViewProps['name'] = { ios: 'xmark', android: 'close', web: 'close' };

function extensionOf(name: string) {
  const ext = name.split('.').pop();
  return ext && ext !== name && ext.length <= 5 ? ext.toUpperCase() : 'FILE';
}

const RETRY_ICON: SymbolViewProps['name'] = { ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' };
const ALERT_ICON: SymbolViewProps['name'] = { ios: 'exclamationmark.circle.fill', android: 'error', web: 'error' };

export function UploadQueue({
  items,
  onCancel,
  onRetry,
}: {
  items: UploadItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
}) {
  if (!items.length) return null;
  return (
    <View className="gap-1.5 px-3 pb-2 pt-1">
      {items.map((item) => (
        <UploadCard key={item.id} item={item} onCancel={() => onCancel(item.id)} onRetry={() => onRetry(item.id)} />
      ))}
    </View>
  );
}

function UploadCard({ item, onCancel, onRetry }: { item: UploadItem; onCancel: () => void; onRetry: () => void }) {
  const pct = Math.round(item.progress * 100);
  const size = formatFileSize(item.size);

  if (item.status === 'failed') {
    return (
      <View className="w-[82%] flex-row items-center gap-3 self-end rounded-2xl rounded-br-md border border-red-200 bg-red-50 p-2.5">
        <Thumb item={item} failed />
        <View className="min-w-0 flex-1 gap-0.5">
          <Text className="text-[13px] font-semibold text-black" numberOfLines={1}>
            {item.name}
          </Text>
          <View className="flex-row items-center gap-1">
            <SymbolView name={ALERT_ICON} size={12} tintColor="#dc2626" />
            <Text className="flex-shrink text-[11px] font-medium text-red-700" numberOfLines={1}>
              {item.error ?? 'Upload failed'}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={onRetry}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Retry ${item.name}`}
          className="h-9 flex-row items-center gap-1 rounded-full bg-primary px-3 active:opacity-80"
        >
          <SymbolView name={RETRY_ICON} size={14} tintColor="#ffffff" />
          <Text className="text-xs font-bold text-white">Retry</Text>
        </Pressable>
        <Pressable
          onPress={onCancel}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${item.name}`}
          className="h-9 w-9 items-center justify-center rounded-full bg-white active:bg-slate-100"
        >
          <SymbolView name={CLOSE_ICON} size={14} tintColor="#000000" />
        </Pressable>
      </View>
    );
  }

  const label =
    item.status === 'queued' ? 'Waiting…' : item.status === 'sending' ? 'Sending…' : `Uploading ${pct}%`;

  return (
    <View className="w-[82%] flex-row items-center gap-3 self-end rounded-2xl rounded-br-md bg-primary p-2.5">
      <Thumb item={item} />

      <View className="min-w-0 flex-1 gap-1">
        <Text className="text-[13px] font-semibold text-white" numberOfLines={1}>
          {item.name}
        </Text>
        <View className="h-1 overflow-hidden rounded-full bg-white/20">
          <View
            className="h-full rounded-full bg-sky-300"
            style={{ width: `${item.status === 'queued' ? 0 : Math.max(4, pct)}%` }}
          />
        </View>
        <Text className="text-[11px] text-white/80" numberOfLines={1}>
          {[label, size].filter(Boolean).join(' · ')}
        </Text>
      </View>

      {item.status === 'sending' ? (
        <View className="h-9 w-9 items-center justify-center">
          <ActivityIndicator size="small" color="#ffffff" />
        </View>
      ) : (
        <Pressable
          onPress={onCancel}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Cancel ${item.name}`}
          className="h-9 w-9 items-center justify-center rounded-full bg-white/20 active:bg-white/30"
        >
          <SymbolView name={CLOSE_ICON} size={15} tintColor="#ffffff" />
        </Pressable>
      )}
    </View>
  );
}

/** Picture preview, or a file icon with its extension (PDF, DOCX…). */
function Thumb({ item, failed }: { item: UploadItem; failed?: boolean }) {
  if (item.isImage) {
    return <Image source={{ uri: item.uri }} style={{ width: 44, height: 44, borderRadius: 10, opacity: failed ? 0.6 : 1 }} contentFit="cover" />;
  }
  return (
    <View className={`h-11 w-11 items-center justify-center rounded-[10px] ${failed ? 'bg-red-100' : 'bg-white/15'}`}>
      <SymbolView name={FILE_ICON} size={18} tintColor={failed ? '#dc2626' : '#ffffff'} />
      <Text className={`mt-0.5 text-[8px] font-bold ${failed ? 'text-red-700' : 'text-white'}`}>{extensionOf(item.name)}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Attach menu (paperclip)                                             */
/* ------------------------------------------------------------------ */

const OPTIONS: { key: 'document' | 'photos'; label: string; icon: SymbolViewProps['name']; color: string }[] = [
  { key: 'document', label: 'Document', icon: { ios: 'doc.text.fill', android: 'description', web: 'description' }, color: 'bg-violet-600' },
  { key: 'photos', label: 'Photos', icon: { ios: 'photo.fill.on.rectangle.fill', android: 'photo_library', web: 'photo_library' }, color: 'bg-blue-600' },
];

/** Paperclip menu: Document (any file) or Photos, both multi-select; picked files go to `onPicked`. */
export function AttachMenu({ visible, onClose, onPicked }: { visible: boolean; onClose: () => void; onPicked: (files: PickedFile[]) => void }) {
  const insets = useSafeAreaInsets();

  const choose = (key: 'document' | 'photos') => {
    onClose();
    // Let the menu close first: iOS can't present the system picker over a closing modal.
    setTimeout(async () => {
      try {
        onPicked(key === 'document' ? await pickDocuments() : await pickPhotos());
      } catch (e) {
        toastError(e, 'Could not open picker');
      }
    }, 350);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/30" onPress={onClose} accessibilityLabel="Close">
        <View
          className="mx-3 flex-row justify-around rounded-3xl bg-white px-4 py-5"
          style={{ marginBottom: Math.max(insets.bottom, 12) + 64 }}
        >
          {OPTIONS.map((o) => (
            <Pressable key={o.key} onPress={() => choose(o.key)} accessibilityRole="button" className="items-center gap-2 active:opacity-70">
              <View className={`h-14 w-14 items-center justify-center rounded-full ${o.color}`}>
                <SymbolView name={o.icon} size={24} tintColor="#ffffff" />
              </View>
              <Text className="text-[13px] font-medium text-black">{o.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}
