import { type Href, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { NotificationItem } from '@/components/notifications/notification-item';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/hooks/use-redux';
import { type AppNotification, fetchNotificationsPage, NOTIFICATION_PAGE_SIZE, notificationHref } from '@/lib/notifications';
import { toastError } from '@/lib/toast';
import { useNotifications } from '@/providers/notifications-provider';

const BELL_OFF = { ios: 'bell.slash', android: 'notifications_off', web: 'notifications_off' } as const;

/**
 * All notifications (web CompanyNotificationsPage): newest first, 15 at a time with
 * "Load older notifications", tap to mark read and open, and "Mark all as read".
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const userId: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const { unreadCount, markRead, markAllRead, incoming, refresh: refreshBadge } = useNotifications();

  const [items, setItems] = useState<AppNotification[]>([]);
  const [limit, setLimit] = useState(NOTIFICATION_PAGE_SIZE);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    (count: number) =>
      userId
        ? fetchNotificationsPage(userId, count)
            .then(({ items: result, total }) => {
              setItems(result);
              setHasMore(result.length < total);
            })
            .catch((e) => toastError(e, 'Could not load notifications'))
        : Promise.resolve(),
    [userId]
  );

  useEffect(() => {
    load(NOTIFICATION_PAGE_SIZE).finally(() => setLoading(false));
  }, [load]);

  // Live items from the socket go on top; read state stays in sync with the bell dialog.
  const list = useMemo(() => {
    const ids = new Set(items.map((i) => i._id));
    const readIds = new Set(incoming.filter((n) => n.isRead).map((n) => n._id));
    const merged = [...incoming.filter((n) => !ids.has(n._id)), ...items];
    if (unreadCount === 0) return merged.map((n) => (n.isRead ? n : { ...n, isRead: true }));
    return merged.map((n) => (!n.isRead && readIds.has(n._id) ? { ...n, isRead: true } : n));
  }, [items, incoming, unreadCount]);

  const onOpen = useCallback(
    (n: AppNotification) => {
      if (!n.isRead) {
        setItems((prev) => prev.map((p) => (p._id === n._id ? { ...p, isRead: true } : p)));
        markRead(n);
      }
      const href = notificationHref(n);
      if (href) router.push(href as Href);
    },
    [markRead, router]
  );

  const onMarkAll = () => {
    setItems((prev) => prev.map((p) => ({ ...p, isRead: true })));
    markAllRead();
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([load(limit), refreshBadge()]);
    setRefreshing(false);
  };

  const onLoadMore = async () => {
    const next = limit + NOTIFICATION_PAGE_SIZE;
    setLoadingMore(true);
    setLimit(next);
    await load(next);
    setLoadingMore(false);
  };

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      contentContainerClassName="w-full max-w-3xl grow self-center pb-10"
      data={loading ? [] : list}
      keyExtractor={(n) => n._id}
      renderItem={({ item }) => <NotificationItem notification={item} onPress={onOpen} />}
      ItemSeparatorComponent={Divider}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View className="gap-3 px-5 pb-4 pt-5">
          <ScreenHeader title="Notifications" fallbackHref="/home" />
          <View className="flex-row items-center justify-between gap-3">
            <Text className="flex-1 text-sm text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread` : 'Stay updated on your latest activity.'}
            </Text>
            {unreadCount > 0 ? (
              <Pressable onPress={onMarkAll} hitSlop={8} accessibilityRole="button">
                <Text className="text-[13px] font-medium text-blue-600">Mark all as read</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Loading notifications"
          >
            {Array.from({ length: 6 }, (_, i) => (
              <View key={i} className={`flex-row items-center gap-3 bg-white px-4 py-3.5 ${i > 0 ? 'border-t border-slate-200' : ''}`}>
                <Skeleton width={36} height={36} radius={18} />
                <View className="flex-1 gap-2">
                  <Skeleton width="85%" height={14} />
                  <Skeleton width="30%" height={11} />
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View className="flex-1 justify-center">
            <EmptyState
              icon={BELL_OFF}
              tint="blue"
              title="You're all caught up!"
              description="You don't have any notifications at the moment. Check back later for updates."
            />
          </View>
        )
      }
      ListFooterComponent={
        loading || list.length === 0 ? undefined : hasMore ? (
          <View className="px-5 pt-5">
            <Button title="Load more" onPress={onLoadMore} loading={loadingMore} className="rounded-xl" />
          </View>
        ) : (
          <Text className="pt-5 text-center text-xs text-black">No more notifications</Text>
        )
      }
    />
  );
}

function Divider() {
  return <View className="h-px bg-slate-200" />;
}
