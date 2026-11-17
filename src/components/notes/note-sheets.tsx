import { SymbolView } from 'expo-symbols';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SearchInput, Sheet } from '@/components/ui/sheet';
import { resolveImageUrl } from '@/lib/image-url';
import type { NoteTag } from '@/lib/notes';
import type { Colleague } from '@/redux/features/colleaguesSlice';

const ICONS = {
  close: { ios: 'xmark', android: 'close', web: 'close' },
  hash: { ios: 'number', android: 'tag', web: 'tag' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
} as const;

/* ------------------------------------------------------------------ */
/* Title prompt (create note / rename note)                            */
/* ------------------------------------------------------------------ */

type NoteTitleSheetProps = {
  visible: boolean;
  mode: 'create' | 'rename';
  initial?: string;
  onClose: () => void;
  /** Should resolve when done; the sheet closes itself on success. */
  onSubmit: (title: string) => Promise<boolean>;
};

/** Remounts each time it opens, so it always starts from `initial`. */
export function NoteTitleSheet(props: NoteTitleSheetProps) {
  return props.visible ? <NoteTitleSheetContent {...props} /> : null;
}

function NoteTitleSheetContent({ visible, mode, initial = '', onClose, onSubmit }: NoteTitleSheetProps) {
  const [title, setTitle] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    setSubmitting(true);
    const ok = await onSubmit(title.trim());
    setSubmitting(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      visible={visible}
      title={mode === 'create' ? 'Create New Note' : 'Rename Note'}
      subtitle={mode === 'create' ? 'Give your note a title to get started.' : 'Edit the note title.'}
      onClose={submitting ? () => {} : onClose}
      footer={
        <View className="flex-row gap-3">
          <Button title="Cancel" variant="dark" onPress={onClose} disabled={submitting} className="h-12 flex-1 rounded-xl py-0" />
          <Button
            title={mode === 'create' ? 'Create Note' : 'Save'}
            onPress={submit}
            loading={submitting}
            className="h-12 flex-1 rounded-xl py-0"
          />
        </View>
      }
    >
      <View className="gap-1.5 px-5">
        <TextInput
          value={title}
          onChangeText={(t) => {
            setTitle(t);
            setError(null);
          }}
          placeholder="Note title"
          placeholderTextColor="#64748b"
          autoFocus
          onSubmitEditing={submit}
          returnKeyType="done"
          className={`h-12 rounded-xl border bg-white px-3.5 text-[15px] text-black ${error ? 'border-red-500' : 'border-slate-300'}`}
        />
        {error ? <Text className="text-xs font-medium text-red-600">{error}</Text> : null}
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Add tag to a note                                                   */
/* ------------------------------------------------------------------ */

export function TagPickerSheet({
  visible,
  tags,
  selectedIds,
  onClose,
  onPick,
}: {
  visible: boolean;
  tags: NoteTag[];
  /** Tags already on the note. */
  selectedIds: string[];
  onClose: () => void;
  onPick: (tag: NoteTag) => void;
}) {
  const [search, setSearch] = useState('');
  const filtered = useMemo(
    () => tags.filter((t) => t.name?.toLowerCase().includes(search.trim().toLowerCase())),
    [tags, search]
  );

  return (
    <Sheet visible={visible} title="Add tag" subtitle="Tap a tag to add it to this note." onClose={onClose}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search tags..." />
      <ScrollView contentContainerClassName="px-3 pb-2" keyboardShouldPersistTaps="handled">
        {filtered.length === 0 ? (
          <Text className="px-2 py-6 text-center text-sm text-black">No tags found. Create one from Manage Tags.</Text>
        ) : (
          filtered.map((tag) => {
            const added = selectedIds.includes(tag._id);
            return (
              <Pressable
                key={tag._id}
                onPress={() => !added && onPick(tag)}
                disabled={added}
                accessibilityRole="button"
                className="flex-row items-center gap-3 rounded-xl px-3 py-3 active:bg-slate-100"
              >
                <SymbolView name={ICONS.hash} size={16} tintColor="#000000" />
                <Text className="flex-1 text-[15px] text-black">{tag.name}</Text>
                {added ? <SymbolView name={ICONS.check} size={16} tintColor="#16a34a" /> : null}
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Manage tags                                                         */
/* ------------------------------------------------------------------ */

export function ManageTagsSheet({
  visible,
  tags,
  onClose,
  onAdd,
  onRemove,
}: {
  visible: boolean;
  tags: NoteTag[];
  onClose: () => void;
  onAdd: (name: string) => Promise<void>;
  onRemove: (tag: NoteTag) => void;
}) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);

  const add = async () => {
    if (!name.trim() || adding) return;
    setAdding(true);
    await onAdd(name);
    setName('');
    setAdding(false);
  };

  return (
    <Sheet visible={visible} title="Manage Tags" subtitle="Create tags to organise your notes." onClose={onClose}>
      <View className="flex-row gap-2 px-5 pb-3">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="New tag name"
          placeholderTextColor="#64748b"
          onSubmitEditing={add}
          returnKeyType="done"
          className="h-12 flex-1 rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-black"
        />
        <Button title="Add" onPress={add} loading={adding} disabled={!name.trim()} className="h-12 rounded-xl px-5 py-0" />
      </View>
      <ScrollView contentContainerClassName="px-5 pb-2" keyboardShouldPersistTaps="handled">
        {tags.length === 0 ? (
          <Text className="py-6 text-center text-sm text-black">No tags yet.</Text>
        ) : (
          <View className="overflow-hidden rounded-xl border border-slate-200">
            {tags.map((tag, i) => (
              <View key={tag._id} className={`flex-row items-center gap-3 px-3.5 py-3 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                <SymbolView name={ICONS.hash} size={16} tintColor="#000000" />
                <Text className="flex-1 text-[15px] text-black">{tag.name}</Text>
                <Pressable
                  onPress={() => onRemove(tag)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Delete tag ${tag.name}`}
                  className="h-9 w-9 items-center justify-center rounded-full active:bg-red-50"
                >
                  <SymbolView name={ICONS.trash} size={17} tintColor="#dc2626" />
                </Pressable>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Share note                                                          */
/* ------------------------------------------------------------------ */

type ShareNoteSheetProps = {
  visible: boolean;
  colleagues: Colleague[];
  /** Ids the note is already shared with. */
  sharedWith: string[];
  me?: string;
  onClose: () => void;
  /** Adds these ids to the existing list (union, as on the web). */
  onShare: (ids: string[]) => Promise<void>;
  onRemove: (id: string) => void;
};

/** Remounts each time it opens, so the search and selection start empty. */
export function ShareNoteSheet(props: ShareNoteSheetProps) {
  return props.visible ? <ShareNoteSheetContent {...props} /> : null;
}

function ShareNoteSheetContent({ visible, colleagues, sharedWith, me, onClose, onShare, onRemove }: ShareNoteSheetProps) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  const byId = useMemo(() => new Map(colleagues.map((c) => [c._id, c])), [colleagues]);
  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return colleagues.filter(
      (c) =>
        c._id !== me &&
        !sharedWith.includes(c._id) &&
        (!q || c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q))
    );
  }, [colleagues, sharedWith, me, search]);

  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const share = async () => {
    if (!picked.length) return;
    setSharing(true);
    await onShare(picked);
    setSharing(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title="Share Note"
      subtitle="People you share with can read this note."
      onClose={onClose}
      footer={
        <Button
          title={picked.length ? `Share with ${picked.length}` : 'Select people to share'}
          onPress={share}
          loading={sharing}
          disabled={!picked.length}
          className="h-12 rounded-xl py-0"
        />
      }
    >
      {sharedWith.length > 0 ? (
        <View className="gap-2 px-5 pb-3">
          <Text className="text-[13px] font-semibold text-black">Shared with</Text>
          <View className="flex-row flex-wrap gap-2">
            {sharedWith.map((id) => {
              const person = byId.get(id);
              return (
                <View key={id} className="flex-row items-center gap-1.5 rounded-full bg-slate-100 py-1 pl-1 pr-2">
                  <Avatar name={person?.name} uri={resolveImageUrl(person?.image)} size={22} />
                  <Text className="text-[13px] text-black" numberOfLines={1}>
                    {person?.name ?? 'User'}
                  </Text>
                  <Pressable onPress={() => onRemove(id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${person?.name ?? 'user'}`}>
                    <SymbolView name={ICONS.close} size={12} tintColor="#000000" />
                  </Pressable>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}

      <SearchInput value={search} onChange={setSearch} placeholder="Search people..." />
      <ScrollView contentContainerClassName="px-3 pb-2" keyboardShouldPersistTaps="handled">
        {candidates.length === 0 ? (
          <Text className="px-2 py-6 text-center text-sm text-black">No people found.</Text>
        ) : (
          candidates.map((c) => {
            const on = picked.includes(c._id);
            return (
              <Pressable
                key={c._id}
                onPress={() => toggle(c._id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${on ? 'bg-blue-50' : 'active:bg-slate-100'}`}
              >
                <Avatar name={c.name} uri={resolveImageUrl(c.image)} size={36} />
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>
                    {c.name}
                  </Text>
                  {c.email ? (
                    <Text className="text-xs text-black" numberOfLines={1}>
                      {c.email}
                    </Text>
                  ) : null}
                </View>
                <View
                  className={`h-6 w-6 items-center justify-center rounded-md border ${on ? 'border-primary bg-primary' : 'border-slate-300 bg-white'}`}
                >
                  {on ? <SymbolView name={ICONS.check} size={14} tintColor="#ffffff" /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Insert link (rich editor)                                           */
/* ------------------------------------------------------------------ */

type LinkSheetProps = {
  visible: boolean;
  onClose: () => void;
  onInsert: (title: string, url: string) => void;
};

export function LinkSheet(props: LinkSheetProps) {
  return props.visible ? <LinkSheetContent {...props} /> : null;
}

function LinkSheetContent({ visible, onClose, onInsert }: LinkSheetProps) {
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const insert = () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setError('Enter a link');
      return;
    }
    const href = /^[a-z]+:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    onInsert(title.trim() || trimmed, href);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title="Insert link"
      onClose={onClose}
      footer={
        <View className="flex-row gap-3">
          <Button title="Cancel" variant="dark" onPress={onClose} className="h-12 flex-1 rounded-xl py-0" />
          <Button title="Insert" onPress={insert} className="h-12 flex-1 rounded-xl py-0" />
        </View>
      }
    >
      <View className="gap-3 px-5">
        <TextInput
          value={url}
          onChangeText={(t) => {
            setUrl(t);
            setError(null);
          }}
          placeholder="https://example.com"
          placeholderTextColor="#64748b"
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          className={`h-12 rounded-xl border bg-white px-3.5 text-[15px] text-black ${error ? 'border-red-500' : 'border-slate-300'}`}
        />
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Text to show (optional)"
          placeholderTextColor="#64748b"
          onSubmitEditing={insert}
          returnKeyType="done"
          className="h-12 rounded-xl border border-slate-300 bg-white px-3.5 text-[15px] text-black"
        />
        {error ? <Text className="text-xs font-medium text-red-600">{error}</Text> : null}
      </View>
    </Sheet>
  );
}
