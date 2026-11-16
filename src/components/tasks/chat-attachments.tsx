import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import Animated, { SlideInRight } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFileViewer } from '@/components/files/file-viewer';
import { formatDisplayDate, ukMoment, ukNow } from '@/lib/date';
import { type Comment, parseFileComment, refName } from '@/lib/tasks';

const ICONS = {
  file: { ios: 'doc.fill', android: 'description', web: 'description' },
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  photo: { ios: 'photo.on.rectangle', android: 'photo_library', web: 'photo_library' },
  open: { ios: 'arrow.up.right', android: 'open_in_new', web: 'open_in_new' },
} as const;

/* ------------------------------------------------------------------ */
/* Attachments screen (WhatsApp-style "Media and docs")                */
/* ------------------------------------------------------------------ */

type AttachmentsSheetProps = {
  visible: boolean;
  /** File messages, newest first. */
  files: Comment[];
  /** Shown under the title, e.g. the task name. */
  subtitle?: string;
  onClose: () => void;
};

type Tab = 'media' | 'docs';
type ParsedFile = ReturnType<typeof parseFileComment> & { comment: Comment };

const GRID_GAP = 2;

/** "This month", "Last month", otherwise "October 2026" (UK time). */
function monthLabel(value?: string) {
  const m = ukMoment(value);
  if (!m) return 'Earlier';
  const now = ukNow();
  if (m.isSame(now, 'month')) return 'This month';
  if (m.isSame(now.clone().subtract(1, 'month'), 'month')) return 'Last month';
  return m.format('MMMM YYYY');
}

/** Groups items (already newest first) into consecutive month sections. */
function byMonth(items: ParsedFile[]) {
  const sections: { title: string; items: ParsedFile[] }[] = [];
  for (const item of items) {
    const title = monthLabel(item.comment.createdAt);
    const last = sections[sections.length - 1];
    if (last?.title === title) last.items.push(item);
    else sections.push({ title, items: [item] });
  }
  return sections;
}

/** "PDF", "DOCX" ... from a file name. */
function fileExtension(name: string) {
  const ext = name.split('.').pop();
  return ext && ext !== name && ext.length <= 5 ? ext.toUpperCase() : undefined;
}

/**
 * Full-screen list of everything shared in the chat, like WhatsApp's media screen:
 * slides in from the right, back arrow returns to the chat, Media / Docs tabs, grouped by month.
 */
export function AttachmentsSheet({ visible, files, subtitle, onClose }: AttachmentsSheetProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('media');
  // Rendered inside this modal so the viewer opens above it.
  const { openFile, viewer } = useFileViewer();

  const parsed: ParsedFile[] = useMemo(() => files.map((c) => ({ comment: c, ...parseFileComment(c.content) })), [files]);
  const media = useMemo(() => byMonth(parsed.filter((f) => f.isImage)), [parsed]);
  const docs = useMemo(() => byMonth(parsed.filter((f) => !f.isImage)), [parsed]);
  const sections = tab === 'media' ? media : docs;
  const tileSize = Math.floor((width - GRID_GAP * 2) / 3);

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      {visible ? (
        <Animated.View entering={SlideInRight.duration(240)} className="flex-1 bg-white">
          {/* Header */}
          <View className="border-b border-slate-200 bg-white" style={{ paddingTop: insets.top }}>
            <View className="flex-row items-center gap-2 px-2 py-2">
              <Pressable
                onPress={onClose}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Back to chat"
                className="h-11 w-11 items-center justify-center rounded-full active:bg-slate-100"
              >
                <SymbolView name={ICONS.back} size={22} tintColor="#000000" />
              </Pressable>
              <View className="flex-1">
                <Text className="text-lg font-bold text-black">Media and docs</Text>
                {subtitle ? (
                  <Text className="text-xs text-black" numberOfLines={1}>
                    {subtitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Tabs */}
            <View className="flex-row">
              {(['media', 'docs'] as const).map((t) => {
                const on = t === tab;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setTab(t)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    className="flex-1 items-center pt-2"
                  >
                    <Text className={`pb-2.5 text-[15px] ${on ? 'font-bold text-primary' : 'font-medium text-black'}`}>
                      {t === 'media' ? 'Media' : 'Docs'}
                    </Text>
                    <View className={`h-[3px] w-full ${on ? 'bg-primary' : 'bg-transparent'}`} />
                  </Pressable>
                );
              })}
            </View>
          </View>

          {sections.length === 0 ? (
            <View className="flex-1 items-center justify-center gap-2 px-8">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <SymbolView name={tab === 'media' ? ICONS.photo : ICONS.file} size={28} tintColor="#000000" />
              </View>
              <Text className="mt-1 text-base font-semibold text-black">{tab === 'media' ? 'No media' : 'No documents'}</Text>
              <Text className="text-center text-sm text-black">
                {tab === 'media' ? 'Images shared in this chat will appear here.' : 'Files shared in this chat will appear here.'}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}>
              {sections.map((section) => (
                <View key={section.title}>
                  <Text className="bg-slate-50 px-4 py-2.5 text-[13px] font-semibold text-black">{section.title}</Text>

                  {tab === 'media' ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GRID_GAP }}>
                      {section.items.map((f) => (
                        <Pressable
                          key={f.comment._id}
                          onPress={() => openFile(f)}
                          accessibilityRole="imagebutton"
                          accessibilityLabel={f.name}
                          style={{ width: tileSize, height: tileSize }}
                        >
                          <Image source={{ uri: f.url }} style={{ width: tileSize, height: tileSize }} contentFit="cover" />
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    section.items.map((f, i) => (
                      <Pressable
                        key={f.comment._id}
                        onPress={() => openFile(f)}
                        accessibilityRole="button"
                        accessibilityLabel={`Open ${f.name}`}
                        className={`flex-row items-center gap-3 px-4 py-3 active:bg-slate-50 ${i > 0 ? 'border-t border-slate-100' : ''}`}
                      >
                        <View className="h-11 w-11 items-center justify-center rounded-xl bg-blue-50">
                          <SymbolView name={ICONS.file} size={20} tintColor="#00214c" />
                        </View>
                        <View className="flex-1">
                          <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>
                            {f.name}
                          </Text>
                          <Text className="text-xs text-black" numberOfLines={1}>
                            {[fileExtension(f.name), refName(f.comment.authorId), formatDisplayDate(f.comment.createdAt, '')]
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        </View>
                        <SymbolView name={ICONS.open} size={15} tintColor="#000000" />
                      </Pressable>
                    ))
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      ) : null}
      {viewer}
    </Modal>
  );
}
