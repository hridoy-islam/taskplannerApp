import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { formatDisplayDate } from '@/lib/date';
import { createGroup, fetchGroups, type GroupSummary, updateGroup } from '@/lib/groups';
import { resolveImageUrl } from '@/lib/image-url';
import { connectSocket } from '@/lib/socket';
import { toast, toastError } from '@/lib/toast';
import { type Colleague, fetchColleagues } from '@/redux/features/colleaguesSlice';

const POLL_MS = 20_000;

type View_ = 'active' | 'archived';

const ICONS = {
  plus: { ios: 'plus', android: 'add', web: 'add' },
  archive: { ios: 'archivebox', android: 'archive', web: 'archive' },
  restore: { ios: 'arrow.uturn.backward', android: 'unarchive', web: 'unarchive' },
  groups: { ios: 'person.3', android: 'groups', web: 'groups' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
} as const;

/**
 * Groups (web CompanyGroupPage): Active / Archived tabs, newest activity first, unread counts,
 * member avatars, creator, Create Group, and archive / restore for the group's creator.
 * Refreshes every 20s like the web, and immediately when a group message arrives over the socket.
 */
export default function GroupsScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const me: string | undefined = user?._id;
  const colleagues = useAppSelector((state) => state.colleagues.users);

  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [view, setView] = useState<View_>('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(
    (): Promise<void> =>
      fetchGroups()
        .then(setGroups)
        .catch(() => {})
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  // Coming back from a chat: refresh the unread counts.
  const returning = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (returning.current) load();
      returning.current = true;
    }, [load])
  );

  // A new group message anywhere → refresh counts/order straight away.
  useEffect(() => {
    if (!me) return;
    const socket = connectSocket({ _id: me, name: user?.name });
    const onMessage = () => load();
    socket.on('message received', onMessage);
    return () => {
      socket.off('message received', onMessage);
      socket.disconnect();
    };
  }, [me, user?.name, load]);

  // Company people (names/photos for member avatars, and for creating groups).
  useEffect(() => {
    if (me && colleagues.length === 0) dispatch(fetchColleagues(me));
  }, [me, colleagues.length, dispatch]);

  const people = useMemo(() => new Map(colleagues.map((c) => [c._id, c])), [colleagues]);

  const shown = useMemo(
    () =>
      [...groups]
        .sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime())
        .filter((g) => (view === 'archived' ? g.status === 'archived' : g.status !== 'archived')),
    [groups, view]
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggleArchive = useCallback(
    (group: GroupSummary) => {
      const archiving = group.status !== 'archived';
      Alert.alert(
        archiving ? 'Archive group?' : 'Restore group?',
        archiving
          ? 'This will archive the group. It will move to the archived tab.'
          : 'This will restore the group. It will move back to the active tab.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: archiving ? 'Archive' : 'Restore',
            style: archiving ? 'destructive' : 'default',
            onPress: async () => {
              const status = archiving ? 'archived' : 'active';
              setGroups((prev) => prev.map((g) => (g._id === group._id ? { ...g, status } : g)));
              try {
                await updateGroup(group._id, { status });
                toast.success(archiving ? 'Group archived' : 'Group restored');
              } catch (e) {
                toastError(e, 'Failed to update group');
                load();
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const open = useCallback((g: GroupSummary) => router.push(`/groups/${g._id}` as Href), [router]);

  const onCreate = async (name: string, memberIds: string[]) => {
    if (!me) return false;
    try {
      await createGroup({ groupName: name, me: { _id: me, name: user?.name }, memberIds });
      toast.success('Group created');
      setView('active');
      load();
      return true;
    } catch (e) {
      toastError(e, 'Error creating group');
      return false;
    }
  };

  return (
    <>
      <FlatList
        className="flex-1 bg-slate-50"
        contentContainerClassName="w-full max-w-3xl grow self-center gap-3 px-5 pb-10 pt-5"
        data={loading ? [] : shown}
        keyExtractor={(g) => g._id}
        renderItem={({ item }) => (
          <GroupCard group={item} me={me} people={people} onPress={open} onToggleArchive={toggleArchive} />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View className="gap-4 pb-1">
            <View className="flex-row items-center justify-between">
              <Text className="text-2xl font-extrabold tracking-tight text-black">Groups</Text>
              <Pressable
                onPress={() => setCreateOpen(true)}
                accessibilityRole="button"
                className="h-11 flex-row items-center gap-1.5 rounded-xl bg-primary px-4 active:opacity-80"
              >
                <SymbolView name={ICONS.plus} size={16} tintColor="#ffffff" />
                <Text className="text-[15px] font-bold text-white">Create Group</Text>
              </Pressable>
            </View>

            <View className="flex-row rounded-xl bg-primary p-1">
              {(['active', 'archived'] as const).map((v) => {
                const on = v === view;
                return (
                  <Pressable
                    key={v}
                    onPress={() => setView(v)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    className={`h-10 flex-1 items-center justify-center rounded-lg ${on ? 'bg-white' : ''}`}
                  >
                    <Text className={`text-sm font-bold ${on ? 'text-primary' : 'text-white'}`}>
                      {v === 'active' ? 'Active Groups' : 'Archived Groups'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View className="gap-3" accessible accessibilityRole="progressbar" accessibilityLabel="Loading groups">
              {Array.from({ length: 4 }, (_, i) => (
                <View key={i} className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <Skeleton width={52} height={52} radius={26} />
                  <View className="flex-1 gap-2">
                    <Skeleton width="55%" height={16} />
                    <Skeleton width="35%" height={12} />
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View className="flex-1 items-center justify-center gap-2 px-6 py-12">
              <View className="h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <SymbolView name={ICONS.groups} size={28} tintColor="#000000" />
              </View>
              <Text className="mt-1 text-base font-bold text-black">
                {view === 'active' ? 'No groups yet' : 'No archived groups'}
              </Text>
              <Text className="text-center text-sm text-black">
                {view === 'active' ? 'Create a group to work together on tasks.' : 'Archived groups will appear here.'}
              </Text>
            </View>
          )
        }
      />

      <CreateGroupSheet
        visible={createOpen}
        people={colleagues.filter((c) => c._id !== me)}
        onClose={() => setCreateOpen(false)}
        onCreate={onCreate}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

const GroupCard = memo(function GroupCard({
  group,
  me,
  people,
  onPress,
  onToggleArchive,
}: {
  group: GroupSummary;
  me?: string;
  people: Map<string, Colleague>;
  onPress: (g: GroupSummary) => void;
  onToggleArchive: (g: GroupSummary) => void;
}) {
  const unread = group.unreadMessageCount ?? 0;
  const isCreator = !!me && group.creator?._id === me;
  const archived = group.status === 'archived';

  return (
    <Pressable
      onPress={() => onPress(group)}
      accessibilityRole="button"
      accessibilityLabel={`${group.groupName}${unread ? `, ${unread} new messages` : ''}`}
      className="gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5 active:bg-slate-50"
    >
      <View className="flex-row items-center gap-3">
        <Avatar name={group.groupName} uri={resolveImageUrl(group.image)} size={52} />
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-bold text-black" numberOfLines={1}>
            {group.groupName}
          </Text>
          {unread > 0 ? (
            <Text className="text-[13px] font-semibold text-red-600">
              {unread} new {unread === 1 ? 'message' : 'messages'}
            </Text>
          ) : (
            <Text className="text-[13px] text-black" numberOfLines={1}>
              Created {formatDisplayDate(group.createdAt)}
            </Text>
          )}
        </View>
        {unread > 0 ? (
          <View className="h-6 min-w-6 items-center justify-center rounded-full bg-red-600 px-1.5">
            <Text className="text-xs font-bold text-white">{unread > 99 ? '99+' : unread}</Text>
          </View>
        ) : null}
        {isCreator ? (
          <Pressable
            onPress={() => onToggleArchive(group)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={archived ? 'Restore group' : 'Archive group'}
            className={`h-10 w-10 items-center justify-center rounded-full ${archived ? 'bg-emerald-50' : 'bg-red-50'}`}
          >
            <SymbolView name={archived ? ICONS.restore : ICONS.archive} size={18} tintColor={archived ? '#059669' : '#dc2626'} />
          </Pressable>
        ) : null}
      </View>

      <View className="flex-row items-center justify-between border-t border-slate-100 pt-3">
        <View className="flex-row items-center gap-2">
          <View className="flex-row">
            {group.members.slice(0, 4).map((m, i) => {
              const person = m._id === me ? undefined : people.get(m._id);
              return (
                <View key={m._id} className="rounded-full border-2 border-white" style={{ marginLeft: i ? -10 : 0 }}>
                  <Avatar name={person?.name ?? (m._id === me ? 'Me' : undefined)} uri={resolveImageUrl(person?.image)} size={26} />
                </View>
              );
            })}
          </View>
          <Text className="text-xs font-semibold text-black">
            {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
          </Text>
        </View>
        {group.creator?.name ? (
          <Text className="text-xs text-black" numberOfLines={1}>
            By <Text className="font-semibold">{group.creator._id === me ? 'You' : group.creator.name}</Text>
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
});

/* ------------------------------------------------------------------ */
/* Create group                                                        */
/* ------------------------------------------------------------------ */

type CreateProps = {
  visible: boolean;
  people: Colleague[];
  onClose: () => void;
  onCreate: (name: string, memberIds: string[]) => Promise<boolean>;
};

function CreateGroupSheet(props: CreateProps) {
  return props.visible ? <CreateGroupContent {...props} /> : null;
}

function CreateGroupContent({ visible, people, onClose, onCreate }: CreateProps) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(
    () => people.filter((p) => p.name?.toLowerCase().includes(search.trim().toLowerCase())),
    [people, search]
  );
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const submit = async () => {
    const trimmed = name.trim();
    // Same validation as the web form.
    if (trimmed.length < 3) return setError('Group name must be at least 3 characters.');
    if (trimmed.length > 50) return setError('Group name must not exceed 50 characters.');
    setSaving(true);
    const ok = await onCreate(trimmed, picked);
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 justify-end bg-black/40">
        <Pressable className="absolute inset-0" onPress={saving ? undefined : onClose} accessibilityLabel="Close" />
        <View className="max-h-[88%] rounded-t-3xl bg-white" style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
          <View className="items-center pt-2.5">
            <View className="h-1 w-10 rounded-full bg-slate-300" />
          </View>
          <View className="flex-row items-center justify-between px-5 pb-3 pt-3">
            <View>
              <Text className="text-lg font-bold text-black">Create New Group</Text>
              <Text className="text-[13px] text-black">Name your group and add members.</Text>
            </View>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
              className="h-8 w-8 items-center justify-center rounded-full bg-slate-100"
            >
              <SymbolView name={ICONS.close} size={14} tintColor="#000000" />
            </Pressable>
          </View>

          <View className="gap-1.5 px-5 pb-3">
            <TextInput
              value={name}
              onChangeText={(t) => {
                setName(t);
                setError(null);
              }}
              placeholder="Group name"
              placeholderTextColor="#64748b"
              maxLength={50}
              className={`h-12 rounded-xl border bg-white px-3.5 text-[15px] text-black ${error ? 'border-red-500' : 'border-slate-300'}`}
            />
            {error ? <Text className="text-xs font-medium text-red-600">{error}</Text> : null}
          </View>

          <View className="mx-5 mb-2 h-11 flex-row items-center gap-2 rounded-xl bg-slate-100 px-3">
            <SymbolView name={ICONS.search} size={16} tintColor="#000000" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search members..."
              placeholderTextColor="#64748b"
              className="flex-1 text-[15px] text-black"
            />
          </View>

          <ScrollView contentContainerClassName="px-3 pb-2" keyboardShouldPersistTaps="handled">
            {filtered.map((p) => {
              const on = picked.includes(p._id);
              return (
                <Pressable
                  key={p._id}
                  onPress={() => toggle(p._id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${on ? 'bg-blue-50' : 'active:bg-slate-100'}`}
                >
                  <Avatar name={p.name} uri={resolveImageUrl(p.image)} size={38} />
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>
                      {p.name}
                    </Text>
                    {p.email ? (
                      <Text className="text-xs text-black" numberOfLines={1}>
                        {p.email}
                      </Text>
                    ) : null}
                  </View>
                  <View className={`h-6 w-6 items-center justify-center rounded-md border ${on ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                    {on ? <SymbolView name={ICONS.check} size={14} tintColor="#ffffff" /> : null}
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>

          <View className="px-5 pt-3">
            <Button
              title={picked.length ? `Create Group · ${picked.length + 1} members` : 'Create Group'}
              onPress={submit}
              loading={saving}
              className="h-12 rounded-xl py-0"
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
