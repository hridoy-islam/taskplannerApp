import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { DotLoader } from '@/components/ui/dot-loader';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { resolveImageUrl } from '@/lib/image-url';
import { countUnseenByAuthor, fetchAllTasks } from '@/lib/tasks';
import { type Colleague, fetchColleagues } from '@/redux/features/colleaguesSlice';

/** Same refresh interval the web app's user list uses. */
const POLL_INTERVAL_MS = 100_000;
/** Unseen task counts refresh more often (the web app polls tasks every 10s). */
const TASK_POLL_INTERVAL_MS = 15_000;

function displayRole(role?: string) {
  if (!role) return 'Member';
  switch (role.toLowerCase()) {
    case 'user':
      return 'Staff';
    case 'creator':
      return 'Manager';
    case 'admin':
    case 'director':
      return 'Admin';
    case 'company':
      return 'Company';
    default:
      return role;
  }
}

/** Unseen tasks each colleague has assigned to me. */
function useUnseenCounts(userId?: string) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const refresh = useCallback(() => {
    if (!userId) return Promise.resolve();
    return fetchAllTasks(userId)
      .then((tasks) => setCounts(countUnseenByAuthor(tasks, userId)))
      .catch(() => {
        // Keep the last known counts; the next poll will retry.
      });
  }, [userId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, TASK_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  return { counts, refresh };
}

export default function ContactScreen() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const userId: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const { users, loading, error } = useAppSelector((state) => state.colleagues);

  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const { counts: unseenCounts, refresh: refreshCounts } = useUnseenCounts(userId);

  const load = useCallback(() => {
    if (userId) return dispatch(fetchColleagues(userId));
  }, [dispatch, userId]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshCounts()]);
    setRefreshing(false);
  };

  const colleagues = useMemo(() => {
    // De-duplicate by id and drop incomplete records.
    const unique = new Map<string, Colleague>();
    users.forEach((u) => {
      if (u?._id && u.name) unique.set(u._id, u);
    });
    let result = Array.from(unique.values());

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter(
        (u) => u.name.toLowerCase().includes(q) || u.role?.toLowerCase().includes(q)
      );
    }

    // Stable order: me first, then alphabetical, then id.
    return result.sort((a, b) => {
      if (a._id === userId) return -1;
      if (b._id === userId) return 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }) || a._id.localeCompare(b._id);
    });
  }, [users, query, userId]);

  const initialLoading = loading && users.length === 0 && !refreshing;

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="w-full max-w-3xl self-center gap-3 p-5 pb-10"
      data={initialLoading ? [] : colleagues}
      keyExtractor={(item) => item._id}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View className="gap-3">
          <Text className="text-2xl font-extrabold tracking-tight text-slate-900">My Colleagues</Text>
          <View className="flex-row items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
            <SymbolView
              name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
              size={18}
              tintColor="#64748b"
            />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search colleagues..."
              placeholderTextColor="#94a3b8"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              className="h-11 flex-1 text-[15px] text-slate-900"
              accessibilityLabel="Search colleagues"
            />
          </View>
        </View>
      }
      ListEmptyComponent={
        initialLoading ? (
          <View className="items-center gap-2 py-12">
            <DotLoader label="Loading team" />
            <Text className="text-sm text-slate-500">Loading team...</Text>
          </View>
        ) : (
          <EmptyState
            icon={{ ios: 'person.2', android: 'groups', web: 'groups' }}
            tint="green"
            title={query ? 'No matches' : error ? 'Could not load colleagues' : 'No colleagues yet'}
            description={
              query
                ? 'No colleagues match your search.'
                : error
                  ? 'Pull down to try again.'
                  : 'People in your company will appear here.'
            }
          />
        )
      }
      renderItem={({ item }) => (
        <ColleagueRow
          colleague={item}
          isMe={item._id === userId}
          unseen={item._id === userId ? 0 : (unseenCounts[item._id] ?? 0)}
          onPress={() => router.push(`/contact/${item._id}` as Href)}
        />
      )}
    />
  );
}

function ColleagueRow({
  colleague,
  isMe,
  unseen,
  onPress,
}: {
  colleague: Colleague;
  isMe: boolean;
  unseen: number;
  onPress: () => void;
}) {
  const role = isMe ? 'you' : displayRole(colleague.role);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${colleague.name}, ${role}${unseen ? `, ${unseen} new ${unseen === 1 ? 'task' : 'tasks'}` : ''}`}
      className="flex-row items-center gap-3 rounded-2xl border border-slate-200/70 bg-white px-4 py-3 shadow-sm shadow-slate-900/5 active:opacity-80"
    >
      <Avatar name={colleague.name} uri={resolveImageUrl(colleague.image)} size={44} />
      <View className="flex-1">
        <Text className={`text-[15px] text-slate-900 ${unseen > 0 ? 'font-bold' : 'font-semibold'}`} numberOfLines={1}>
          {colleague.name}
        </Text>
        <Text className="text-[13px] capitalize text-slate-500" numberOfLines={1}>
          {isMe ? 'Me' : displayRole(colleague.role)}
        </Text>
      </View>
      {unseen > 0 ? (
        <View className="rounded-full bg-blue-50 px-2.5 py-1">
          <Text className="text-xs font-semibold text-blue-600">
            {unseen > 99 ? '99+' : unseen} {unseen === 1 ? 'task' : 'tasks'}
          </Text>
        </View>
      ) : null}
      <SymbolView
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={16}
        tintColor="#94a3b8"
      />
    </Pressable>
  );
}
