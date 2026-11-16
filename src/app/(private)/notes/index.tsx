import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import moment from 'moment';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';

import { ManageTagsSheet, NoteTitleSheet } from '@/components/notes/note-sheets';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/hooks/use-redux';
import { type Note, noteAuthorId, noteAuthorName, notePreview, type NotesTab } from '@/lib/notes';
import { useNotes } from '@/providers/notes-provider';

const ICONS = {
  plus: { ios: 'plus', android: 'add', web: 'add' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  clear: { ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' },
  hash: { ios: 'number', android: 'tag', web: 'tag' },
  star: { ios: 'star.fill', android: 'star', web: 'star' },
  note: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
  shared: { ios: 'person.2', android: 'group', web: 'group' },
} as const;

const TABS: { key: NotesTab; label: string }[] = [
  { key: 'my-notes', label: 'My Notes' },
  { key: 'shared-notes', label: 'Shared Notes' },
];

const byUpdated = (a: Note, b: Note) => moment(b.updatedAt).diff(moment(a.updatedAt));

/**
 * Notes (web CompanyNotesPage sidebar): My Notes / Shared Notes tabs, search,
 * All / Favorites / tag filters, Manage Tags and Add Note. Tapping a note opens the editor.
 */
export default function NotesScreen() {
  const router = useRouter();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const { notes, tags, loading, refresh, addNote, addTag, removeTag } = useNotes();

  const [tab, setTab] = useState<NotesTab>('my-notes');
  const [searchTerm, setSearchTerm] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [showFavorites, setShowFavorites] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Same filters as the web page.
  const myNotes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return notes
      .filter((note) => {
        if (noteAuthorId(note) !== me) return false;
        if (showFavorites && !note.favorite) return false;
        if (tagFilter) return note.tags?.some((t) => t.name?.toLowerCase().includes(tagFilter.toLowerCase()));
        return note.title?.toLowerCase().includes(q) || note.content?.toLowerCase().includes(q);
      })
      .sort(byUpdated);
  }, [notes, me, showFavorites, tagFilter, searchTerm]);

  const sharedNotes = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return notes
      .filter((note) => {
        if (!note.sharedWith?.some((id) => id === me)) return false;
        return (
          note.title?.toLowerCase().includes(q) ||
          note.content?.toLowerCase().includes(q) ||
          note.tags?.some((t) => t.name?.toLowerCase().includes(q))
        );
      })
      .sort(byUpdated);
  }, [notes, me, searchTerm]);

  const filteredTags = useMemo(
    () => (searchTerm ? tags.filter((t) => t.name?.toLowerCase().includes(searchTerm.toLowerCase())) : tags),
    [tags, searchTerm]
  );

  // web handleTagClick: picking a filter clears the search.
  const pickFilter = (filter: 'All' | 'Favorites' | string) => {
    if (filter === 'All') {
      setTagFilter('');
      setShowFavorites(false);
    } else if (filter === 'Favorites') {
      setTagFilter('');
      setShowFavorites(true);
    } else {
      setTagFilter(filter);
      setShowFavorites(false);
    }
    setSearchTerm('');
  };

  const open = useCallback((note: Note) => router.push(`/notes/${note._id}` as Href), [router]);

  const onCreate = async (title: string) => {
    const note = await addNote(title);
    if (note) open(note);
    return !!note;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const data = tab === 'my-notes' ? myNotes : sharedNotes;
  const shared = tab === 'shared-notes';

  return (
    <>
      <FlatList
        className="flex-1 bg-slate-50"
        contentContainerClassName="w-full max-w-3xl grow self-center gap-3 px-5 pb-10 pt-5"
        data={loading ? [] : data}
        keyExtractor={(n) => n._id}
        renderItem={({ item }) => <NoteCard note={item} shared={shared} onPress={open} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View className="gap-4 pb-1">
            {/* Title + Add */}
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-extrabold tracking-tight text-black">Notes</Text>
              <Pressable
                onPress={() => setCreateOpen(true)}
                accessibilityRole="button"
                className="h-11 flex-row items-center gap-1.5 rounded-xl bg-primary px-4 active:opacity-80"
              >
                <SymbolView name={ICONS.plus} size={16} tintColor="#ffffff" />
                <Text className="text-[15px] font-bold text-white">Add Note</Text>
              </Pressable>
            </View>

            {/* Search */}
            <View className="h-12 flex-row items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5">
              <SymbolView name={ICONS.search} size={18} tintColor="#000000" />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Search notes..."
                placeholderTextColor="#64748b"
                className="flex-1 text-[15px] text-black"
                autoCorrect={false}
                returnKeyType="search"
              />
              {searchTerm ? (
                <Pressable onPress={() => setSearchTerm('')} hitSlop={8} accessibilityLabel="Clear search">
                  <SymbolView name={ICONS.clear} size={18} tintColor="#94a3b8" />
                </Pressable>
              ) : null}
            </View>

            {/* Tabs */}
            <View className="flex-row rounded-xl bg-primary p-1">
              {TABS.map((t) => {
                const on = t.key === tab;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => setTab(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    className={`h-10 flex-1 items-center justify-center rounded-lg ${on ? 'bg-white' : ''}`}
                  >
                    <Text className={`text-sm font-bold ${on ? 'text-black' : 'text-white'}`}>{t.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Filters (My Notes only, as on the web) */}
            {tab === 'my-notes' ? (
              <View className="gap-2.5">
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2">
                  <FilterChip label="All" active={!tagFilter && !showFavorites} onPress={() => pickFilter('All')} />
                  <FilterChip label="Favorites" icon={ICONS.star} active={showFavorites} onPress={() => pickFilter('Favorites')} />
                  {filteredTags.map((t) => (
                    <FilterChip key={t._id} label={t.name} icon={ICONS.hash} active={tagFilter === t.name} onPress={() => pickFilter(t.name)} />
                  ))}
                </ScrollView>
                <Pressable onPress={() => setTagsOpen(true)} hitSlop={6} accessibilityRole="button" className="flex-row items-center gap-1.5 self-start">
                  <SymbolView name={ICONS.hash} size={14} tintColor="#2563eb" />
                  <Text className="text-[13px] font-semibold text-blue-600">Manage Tags</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View className="gap-3" accessible accessibilityRole="progressbar" accessibilityLabel="Loading notes">
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} className="gap-2.5 rounded-2xl border border-slate-200 bg-white p-4">
                  <Skeleton width="60%" height={17} />
                  <Skeleton width="90%" height={13} />
                  <Skeleton width="30%" height={11} />
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center gap-2 px-6 py-12">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <SymbolView name={shared ? ICONS.shared : ICONS.note} size={28} tintColor="#000000" />
              </View>
              <Text className="mt-1 text-base font-bold text-black">
                {searchTerm || tagFilter || showFavorites ? 'No matching notes' : shared ? 'No shared notes' : 'Write down your ideas'}
              </Text>
              <Text className="text-center text-sm text-black">
                {shared ? 'Notes others share with you will appear here.' : 'Tap Add Note to create your first note.'}
              </Text>
            </View>
          )
        }
      />

      <NoteTitleSheet visible={createOpen} mode="create" onClose={() => setCreateOpen(false)} onSubmit={onCreate} />
      <ManageTagsSheet visible={tagsOpen} tags={tags} onClose={() => setTagsOpen(false)} onAdd={addTag} onRemove={removeTag} />
    </>
  );
}

function FilterChip({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon?: (typeof ICONS)['hash'] | (typeof ICONS)['star'];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`h-9 flex-row items-center gap-1.5 rounded-full border px-3.5 ${
        active ? 'border-primary bg-primary' : 'border-slate-200 bg-white active:bg-slate-100'
      }`}
    >
      {icon ? <SymbolView name={icon} size={12} tintColor={active ? '#ffffff' : '#000000'} /> : null}
      <Text className={`text-[13px] font-semibold ${active ? 'text-white' : 'text-black'}`}>{label}</Text>
    </Pressable>
  );
}

const NoteCard = memo(function NoteCard({ note, shared, onPress }: { note: Note; shared: boolean; onPress: (n: Note) => void }) {
  const preview = notePreview(note);

  return (
    <Pressable
      onPress={() => onPress(note)}
      accessibilityRole="button"
      accessibilityLabel={note.title}
      className="gap-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 active:bg-slate-50"
    >
      <View className="flex-row items-start gap-2">
        <Text className="flex-1 text-[17px] font-bold text-black" numberOfLines={1}>
          {note.title}
        </Text>
        {note.favorite ? <SymbolView name={ICONS.star} size={17} tintColor="#f59e0b" /> : null}
      </View>

      {preview ? (
        <Text className="text-sm leading-5 text-black" numberOfLines={2}>
          {preview}
        </Text>
      ) : null}

      {!shared && note.tags?.length ? (
        <View className="flex-row flex-wrap gap-x-2.5 gap-y-1">
          {note.tags.map((t) => (
            <Text key={t._id} className="text-xs font-bold text-blue-700">
              #{t.name}
            </Text>
          ))}
        </View>
      ) : null}

      <View className="flex-row items-center justify-between">
        {shared ? (
          <Text className="text-xs text-black">
            Shared by <Text className="font-semibold">{noteAuthorName(note) ?? 'Unknown'}</Text>
          </Text>
        ) : (
          <View />
        )}
        <Text className="text-xs text-black">{moment(note.updatedAt).fromNow()}</Text>
      </View>
    </Pressable>
  );
});
