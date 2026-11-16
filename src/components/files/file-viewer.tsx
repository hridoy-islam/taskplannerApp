import { Image } from 'expo-image';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { toast } from '@/lib/toast';

export type ViewableFile = { url: string; name: string; isImage?: boolean; mime?: string };

type FileKind = 'image' | 'pdf' | 'word' | 'other';

const ICONS = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  download: { ios: 'arrow.down.circle', android: 'download', web: 'download' },
  file: { ios: 'doc.fill', android: 'description', web: 'description' },
} as const;

/** What we can show in the app: pictures, PDFs and Word documents. Anything else is downloaded. */
export function fileKind(file: ViewableFile): FileKind {
  const path = `${file.name} ${file.url.split('?')[0]}`.toLowerCase();
  const mime = file.mime?.toLowerCase() ?? '';
  if (file.isImage || mime.startsWith('image/')) return 'image';
  if (mime === 'application/pdf' || /\.pdf\b/.test(path)) return 'pdf';
  if (mime.includes('msword') || mime.includes('wordprocessingml') || /\.docx?\b/.test(path)) return 'word';
  return 'other';
}

/**
 * Page the WebView loads for a document:
 * - PDF: iOS renders it natively; Android's WebView can't, so it goes through Google's viewer.
 * - Word: Microsoft's Office viewer (works on both).
 * Both viewers fetch the file by its URL, so it has to be publicly reachable (chat uploads are).
 */
function documentUri(kind: FileKind, url: string) {
  const encoded = encodeURIComponent(url);
  if (kind === 'word') return `https://view.officeapps.live.com/op/embed.aspx?src=${encoded}`;
  if (Platform.OS === 'ios') return url;
  return `https://docs.google.com/gview?embedded=true&url=${encoded}`;
}

const openInBrowser = (url: string) => Linking.openURL(url).catch(() => toast.error('Could not open file'));

/**
 * Opens chat attachments: images, PDFs and Word files in an in-app viewer, everything else in the
 * browser (which downloads it). Render `viewer` inside the screen (or modal) that uses `openFile`,
 * so it stacks above it.
 */
export function useFileViewer() {
  const [file, setFile] = useState<(ViewableFile & { kind: FileKind }) | null>(null);

  const openFile = useCallback((f: ViewableFile) => {
    const kind = fileKind(f);
    // Documents need the native WebView, which the web build doesn't have: a new tab does the same job.
    if (kind === 'other' || (Platform.OS === 'web' && kind !== 'image')) {
      openInBrowser(f.url);
      return;
    }
    setFile({ ...f, kind });
  }, []);

  const viewer = <FileViewerModal file={file} onClose={() => setFile(null)} />;
  return { openFile, viewer };
}

function FileViewerModal({ file, onClose }: { file: (ViewableFile & { kind: FileKind }) | null; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  if (!file) return null;
  const dark = file.kind === 'image';

  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose} presentationStyle="fullScreen">
      <View className={`flex-1 ${dark ? 'bg-black' : 'bg-white'}`}>
        {/* Header */}
        <View
          className={`flex-row items-center gap-3 px-3 pb-3 ${dark ? 'bg-black' : 'border-b border-slate-200 bg-white'}`}
          style={{ paddingTop: insets.top + 8 }}
        >
          <HeaderButton icon={ICONS.close} label="Close" dark={dark} onPress={onClose} />
          <Text className={`flex-1 text-[15px] font-semibold ${dark ? 'text-white' : 'text-black'}`} numberOfLines={1}>
            {file.name}
          </Text>
          <HeaderButton icon={ICONS.download} label="Open in browser" dark={dark} onPress={() => openInBrowser(file.url)} />
        </View>

        <View className="flex-1" style={{ paddingBottom: dark ? insets.bottom : 0 }}>
          {file.kind === 'image' ? <ImageView url={file.url} /> : <DocumentView file={file} />}
        </View>
      </View>
    </Modal>
  );
}

function HeaderButton({
  icon,
  label,
  dark,
  onPress,
}: {
  icon: (typeof ICONS)[keyof typeof ICONS];
  label: string;
  dark: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`h-10 w-10 items-center justify-center rounded-full ${dark ? 'bg-white/15 active:bg-white/25' : 'bg-slate-100 active:bg-slate-200'}`}
    >
      <SymbolView name={icon} size={20} tintColor={dark ? '#ffffff' : '#000000'} />
    </Pressable>
  );
}

/** Full-screen picture; pinch to zoom on iOS. */
function ImageView({ url }: { url: string }) {
  const { width, height } = useWindowDimensions();
  const [loading, setLoading] = useState(true);
  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
      maximumZoomScale={4}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}
    >
      <Image
        source={{ uri: url }}
        style={{ width, height: height * 0.8 }}
        contentFit="contain"
        onLoadEnd={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          toast.error('Could not load image');
        }}
        accessibilityIgnoresInvertColors
      />
      {loading ? <ActivityIndicator className="absolute" color="#ffffff" size="large" /> : null}
    </ScrollView>
  );
}

function DocumentView({ file }: { file: ViewableFile & { kind: FileKind } }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View className="flex-1 items-center justify-center gap-3 px-8">
        <SymbolView name={ICONS.file} size={44} tintColor="#00214c" />
        <Text className="text-center text-base font-bold text-black">Can&apos;t preview this file</Text>
        <Text className="text-center text-sm text-slate-500">Open it in your browser to view or download it.</Text>
        <Pressable onPress={() => openInBrowser(file.url)} accessibilityRole="button" className="mt-2 rounded-xl bg-primary px-5 py-3 active:opacity-90">
          <Text className="text-[15px] font-bold text-white">Open in browser</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <WebView
      source={{ uri: documentUri(file.kind, file.url) }}
      style={{ flex: 1 }}
      startInLoadingState
      renderLoading={() => (
        <View className="absolute inset-0 items-center justify-center bg-white">
          <ActivityIndicator color="#00214c" size="large" />
          <Text className="mt-3 text-sm text-slate-500">Loading {file.kind === 'pdf' ? 'PDF' : 'document'}…</Text>
        </View>
      )}
      onError={() => setFailed(true)}
      onHttpError={(e) => e.nativeEvent.statusCode >= 400 && setFailed(true)}
      allowsInlineMediaPlayback
      setSupportMultipleWindows={false}
    />
  );
}
