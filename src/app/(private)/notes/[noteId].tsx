import { type Href, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import moment from 'moment';
import { useEffect, useRef, useState } from 'react';
import { actions, RichEditor, RichToolbar } from 'react-native-pell-rich-editor';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LinkSheet, NoteTitleSheet, ShareNoteSheet, TagPickerSheet } from '@/components/notes/note-sheets';
import { KeyboardPaddingView } from '@/components/ui/keyboard-avoiding-view';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { normaliseHtml, noteAuthorId, noteAuthorName, type NoteTag } from '@/lib/notes';
import { toast } from '@/lib/toast';
import { useNotes } from '@/providers/notes-provider';
import { fetchColleagues } from '@/redux/features/colleaguesSlice';

type Icon = SymbolViewProps['name'];

const ICONS = {
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  pen: { ios: 'pencil', android: 'edit', web: 'edit' },
  save: { ios: 'square.and.arrow.down', android: 'save', web: 'save' },
  tag: { ios: 'number', android: 'tag', web: 'tag' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  starOn: { ios: 'star.fill', android: 'star', web: 'star' },
  starOff: { ios: 'star', android: 'star_border', web: 'star_border' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
} satisfies Record<string, Icon>;

/** Same tools as the web Quill toolbar: headings, bold/italic/underline/strike, lists, link (+ undo/redo). */
const TOOLBAR_ACTIONS = [
  actions.undo,
  actions.redo,
  actions.heading1,
  actions.heading2,
  actions.heading3,
  actions.setBold,
  actions.setItalic,
  actions.setUnderline,
  actions.setStrikethrough,
  actions.insertBulletsList,
  actions.insertOrderedList,
  actions.insertLink,
];

const headingIcon = (label: string) =>
  function HeadingIcon({ tintColor }: { tintColor?: string }) {
    return <Text style={{ color: tintColor, fontSize: 15, fontWeight: '800' }}>{label}</Text>;
  };

const TOOLBAR_ICONS = {
  [actions.heading1]: headingIcon('H1'),
  [actions.heading2]: headingIcon('H2'),
  [actions.heading3]: headingIcon('H3'),
};

const EDITOR_STYLE = {
  backgroundColor: '#ffffff',
  color: '#000000',
  placeholderColor: '#64748b',
  contentCSSText: 'font-size: 16px; line-height: 24px; padding: 14px 16px; min-height: 290px;',
};

/**
 * Note editor (web NotesContent): rename, Save Note, Add tag, Share, Favorite, Delete.
 * My notes are editable (unless archived); shared notes are read-only.
 * Rich text (headings, bold, italic, underline, strike, lists, links) saved as HTML, like the web's Quill editor.
 */
export default function NoteEditorScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const insets = useSafeAreaInsets();
  const { noteId } = useLocalSearchParams<{ noteId: string }>();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const colleagues = useAppSelector((state) => state.colleagues.users);
  const { notes, tags, loading, updateNoteApi, removeNote } = useNotes();

  const note = notes.find((n) => n._id === noteId);
  const isMine = !!note && noteAuthorId(note) === me;
  const readOnly = !isMine || !!note?.isArchive;

  // Local HTML; re-synced only when a different note opens (as on the web).
  const editorRef = useRef<RichEditor>(null);
  const [html, setHtml] = useState(() => note?.content ?? '');
  const [savedHtml, setSavedHtml] = useState(html);
  const [linkOpen, setLinkOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const loadedFor = useRef<string | null>(note ? note._id : null);

  useEffect(() => {
    if (note && loadedFor.current !== note._id) {
      loadedFor.current = note._id;
      setHtml(note.content ?? '');
      setSavedHtml(note.content ?? '');
    }
  }, [note]);

  // People to share with (company users, like the web's users list).
  useEffect(() => {
    if (me && colleagues.length === 0) dispatch(fetchColleagues(me));
  }, [me, colleagues.length, dispatch]);

  const dirty = !readOnly && normaliseHtml(html) !== normaliseHtml(savedHtml);

  const save = async () => {
    if (!note || !dirty) return true;
    setSaving(true);
    const ok = await updateNoteApi(note._id, { content: html, updatedAt: new Date().toISOString() });
    setSaving(false);
    if (ok) {
      setSavedHtml(html);
      toast.success('Note saved');
    }
    return ok;
  };

  // Ask before leaving with unsaved changes (back button, gesture or hardware back).
  const navigation = useNavigation();
  const dirtyRef = useRef(dirty);
  const saveRef = useRef(save);
  useEffect(() => {
    dirtyRef.current = dirty;
    saveRef.current = save;
  });
  useEffect(
    () =>
      navigation.addListener('beforeRemove', (e) => {
        if (!dirtyRef.current) return;
        e.preventDefault();
        Alert.alert('Unsaved changes', 'Save your changes before leaving?', [
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
          { text: 'Keep editing', style: 'cancel' },
          {
            text: 'Save',
            onPress: async () => {
              if (await saveRef.current()) navigation.dispatch(e.data.action);
            },
          },
        ]);
      }),
    [navigation]
  );

  const goBack = () => (router.canGoBack() ? router.back() : router.navigate('/notes' as Href));

  const toggleFavorite = async () => {
    if (!note) return;
    const favorite = !note.favorite;
    if (await updateNoteApi(note._id, { favorite })) {
      toast.success(favorite ? 'Added to favorites' : 'Removed from favorites');
    }
  };

  const addTag = async (tag: NoteTag) => {
    if (!note || note.tags.some((t) => t._id === tag._id)) return;
    setTagOpen(false);
    if (await updateNoteApi(note._id, { tags: [...note.tags, tag] })) toast.success('Tag added');
  };

  const removeTag = async (tagId: string) => {
    if (!note) return;
    if (await updateNoteApi(note._id, { tags: note.tags.filter((t) => t._id !== tagId) })) toast.success('Tag removed');
  };

  const share = async (ids: string[]) => {
    if (!note) return;
    const sharedWith = Array.from(new Set([...(note.sharedWith ?? []), ...ids]));
    if (await updateNoteApi(note._id, { sharedWith })) toast.success('Note shared');
  };

  const unshare = async (id: string) => {
    if (!note) return;
    if (await updateNoteApi(note._id, { sharedWith: note.sharedWith.filter((x) => x !== id) })) toast.success('User removed');
  };

  const rename = async (title: string) => {
    if (!note) return false;
    const ok = await updateNoteApi(note._id, { title });
    if (ok) toast.success('Note updated');
    return ok;
  };

  const confirmDelete = () => {
    if (!note) return;
    Alert.alert('Delete note?', `"${note.title}" will be permanently deleted.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          dirtyRef.current = false;
          await removeNote(note._id);
          goBack();
        },
      },
    ]);
  };

  /* ---------------- states ---------------- */

  if (!note) {
    return (
      <View className="flex-1 bg-white" style={{ paddingTop: 16 }}>
        <TopBar onBack={goBack} />
        {loading ? (
          <View className="gap-3 p-5">
            <Skeleton width="60%" height={22} />
            <Skeleton width="35%" height={13} />
            <Skeleton width="100%" height={180} radius={16} />
          </View>
        ) : (
          <View className="flex-1 items-center justify-center gap-2 px-8">
            <Text className="text-base font-bold text-black">Note not found</Text>
            <Text className="text-center text-sm text-black">It may have been deleted or is no longer shared with you.</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <KeyboardPaddingView className="flex-1 bg-white" bottomInset={insets.bottom}>
      <TopBar
        onBack={goBack}
        right={
          isMine ? (
            <Pressable
              onPress={save}
              disabled={!dirty || saving}
              accessibilityRole="button"
              accessibilityLabel="Save note"
              className={`h-11 flex-row items-center gap-1.5 rounded-xl px-4 ${dirty ? 'bg-primary active:opacity-80' : 'bg-slate-200'}`}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                <SymbolView name={ICONS.save} size={16} tintColor={dirty ? '#ffffff' : '#64748b'} />
              )}
              <Text className={`text-[15px] font-bold ${dirty ? 'text-white' : 'text-slate-500'}`}>
                {saving ? 'Saving…' : dirty ? 'Save Note' : 'Saved'}
              </Text>
            </Pressable>
          ) : null
        }
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="w-full max-w-3xl grow self-center gap-4 px-5 pb-6 pt-2"
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      >
        {/* Title */}
        <View className="gap-1">
          <Pressable
            onPress={() => isMine && setRenameOpen(true)}
            disabled={!isMine}
            accessibilityRole={isMine ? 'button' : undefined}
            accessibilityHint={isMine ? 'Rename note' : undefined}
            className="flex-row items-start gap-2"
          >
            <Text className="flex-1 text-2xl font-extrabold tracking-tight text-black">{note.title}</Text>
            {isMine ? <SymbolView name={ICONS.pen} size={18} tintColor="#000000" style={{ marginTop: 6 }} /> : null}
          </Pressable>
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-[13px] text-black">Last updated {moment(note.updatedAt).fromNow()}</Text>
            {note.favorite ? <SymbolView name={ICONS.starOn} size={14} tintColor="#f59e0b" /> : null}
            {!isMine ? (
              <Text className="text-[13px] text-black">
                · Shared by <Text className="font-semibold">{noteAuthorName(note) ?? 'Unknown'}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* Actions (my notes only, as on the web) */}
        {isMine ? (
          <View className="flex-row gap-2">
            <ActionButton icon={ICONS.tag} label="Tag" onPress={() => setTagOpen(true)} />
            <ActionButton icon={ICONS.share} label="Share" onPress={() => setShareOpen(true)} />
            <ActionButton
              icon={note.favorite ? ICONS.starOn : ICONS.starOff}
              label="Favorite"
              onPress={toggleFavorite}
              active={note.favorite}
            />
            <ActionButton icon={ICONS.trash} label="Delete" onPress={confirmDelete} danger />
          </View>
        ) : null}

        {/* Tags */}
        {isMine && note.tags?.length ? (
          <View className="flex-row flex-wrap gap-2">
            {note.tags.map((tag) => (
              <View key={tag._id} className="flex-row items-center gap-1.5 rounded-full bg-primary py-1.5 pl-3 pr-2">
                <Text className="text-[13px] font-semibold text-white">#{tag.name}</Text>
                <Pressable onPress={() => removeTag(tag._id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove tag ${tag.name}`}>
                  <SymbolView name={ICONS.close} size={12} tintColor="#ffffff" />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}

        {readOnly ? (
          <View className="flex-row items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
            <SymbolView name={ICONS.lock} size={14} tintColor="#000000" />
            <Text className="flex-1 text-[13px] text-black">
              {note.isArchive ? 'This note is archived and read-only.' : 'Shared with you — read only.'}
            </Text>
          </View>
        ) : null}

        {/* Content (rich text), with the formatting buttons (same tools as the web editor) on top */}
        <View className="min-h-[320px] overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {!readOnly ? (
            <View className="border-b border-slate-200 bg-white">
              <RichToolbar
                editor={editorRef}
                actions={TOOLBAR_ACTIONS}
                iconMap={TOOLBAR_ICONS}
                iconTint="#000000"
                selectedIconTint="#2563eb"
                onInsertLink={() => setLinkOpen(true)}
                style={{ backgroundColor: '#ffffff', height: 48 }}
              />
            </View>
          ) : null}
          <RichEditor
            key={note._id}
            ref={editorRef}
            initialContentHTML={note.content ?? ''}
            onChange={setHtml}
            disabled={readOnly}
            useContainer
            initialHeight={320}
            placeholder={readOnly ? 'This note is empty.' : 'Start writing...'}
            editorStyle={EDITOR_STYLE}
            pasteAsPlainText
          />
        </View>
      </ScrollView>

      <LinkSheet
        visible={linkOpen}
        onClose={() => setLinkOpen(false)}
        onInsert={(title, url) => editorRef.current?.insertLink(title, url)}
      />
      <NoteTitleSheet visible={renameOpen} mode="rename" initial={note.title} onClose={() => setRenameOpen(false)} onSubmit={rename} />
      <TagPickerSheet
        visible={tagOpen}
        tags={tags}
        selectedIds={note.tags.map((t) => t._id)}
        onClose={() => setTagOpen(false)}
        onPick={addTag}
      />
      <ShareNoteSheet
        visible={shareOpen}
        colleagues={colleagues}
        sharedWith={note.sharedWith ?? []}
        me={me}
        onClose={() => setShareOpen(false)}
        onShare={share}
        onRemove={unshare}
      />
    </KeyboardPaddingView>
  );
}

function TopBar({ onBack, right }: { onBack: () => void; right?: React.ReactNode }) {
  return (
    <View className="flex-row items-center justify-between px-5 pb-2 pt-4">
      <Pressable
        onPress={onBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white active:opacity-70"
      >
        <SymbolView name={ICONS.back} size={20} tintColor="#000000" />
      </Pressable>
      {right}
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  active,
  danger,
}: {
  icon: Icon;
  label: string;
  onPress: () => void;
  active?: boolean;
  danger?: boolean;
}) {
  const tone = danger
    ? { box: 'border-red-200 bg-red-50 active:bg-red-100', text: 'text-red-700', icon: '#dc2626' }
    : active
      ? { box: 'border-amber-200 bg-amber-50 active:bg-amber-100', text: 'text-amber-700', icon: '#f59e0b' }
      : { box: 'border-slate-200 bg-white active:bg-slate-100', text: 'text-black', icon: '#000000' };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active !== undefined ? { selected: active } : undefined}
      className={`h-16 flex-1 items-center justify-center gap-1 rounded-xl border ${tone.box}`}
    >
      <SymbolView name={icon} size={20} tintColor={tone.icon} />
      <Text className={`text-xs font-semibold ${tone.text}`}>{label}</Text>
    </Pressable>
  );
}
