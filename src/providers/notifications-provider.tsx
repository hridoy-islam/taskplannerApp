import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';

import { useAppSelector } from '@/hooks/use-redux';
import {
  type AppNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';
import { connectSocket } from '@/lib/socket';
import { toastError } from '@/lib/toast';

/** How many notifications the bell dialog shows. */
export const PREVIEW_COUNT = 3;

type NotificationsContextValue = {
  /** Latest few notifications, for the bell dialog. */
  latest: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (n: AppNotification) => void;
  markAllRead: () => void;
  /** Bumped whenever something changes, so the full page can merge read state / new items. */
  version: number;
  /** Notifications received live over the socket since the provider mounted (newest first). */
  incoming: AppNotification[];
};

const NotificationsContext = createContext<NotificationsContextValue | null>(null);

/**
 * Shared notification state for the signed-in area: unread badge, the bell dialog's latest items,
 * live updates over the socket ("notification" event, as on the web) and read/read-all actions.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const user = useAppSelector((state) => state.auth.user);
  const userId: string | undefined = user?._id;
  const userName: string | undefined = user?.name;

  const [latest, setLatest] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  const [incoming, setIncoming] = useState<AppNotification[]>([]);

  const refresh = useCallback(
    (): Promise<void> =>
      userId
        ? Promise.all([fetchNotifications(userId, PREVIEW_COUNT), fetchUnreadCount(userId)])
            .then(([items, unread]) => {
              setLatest(items);
              setUnreadCount(unread);
            })
            // Keep whatever is showing; the badge isn't worth an error toast.
            .catch(() => {})
            .finally(() => setLoading(false))
        : Promise.resolve(),
    [userId]
  );

  // Initial load, and again whenever the app comes back to the foreground.
  useEffect(() => {
    refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  // Live notifications.
  useEffect(() => {
    if (!userId) return;
    const socket = connectSocket({ _id: userId, name: userName });
    const onNotification = (n: AppNotification) => {
      if (!n?._id) return;
      const item = { ...n, isRead: !!n.isRead, createdAt: n.createdAt ?? new Date().toISOString() };
      setLatest((prev) => [item, ...prev.filter((p) => p._id !== item._id)].slice(0, PREVIEW_COUNT));
      setIncoming((prev) => [item, ...prev.filter((p) => p._id !== item._id)]);
      if (!item.isRead) setUnreadCount((c) => c + 1);
      setVersion((v) => v + 1);
    };
    socket.on('notification', onNotification);
    return () => {
      socket.off('notification', onNotification);
      socket.disconnect();
    };
  }, [userId, userName]);

  const markRead = useCallback((n: AppNotification) => {
    if (n.isRead) return;
    setLatest((prev) => prev.map((p) => (p._id === n._id ? { ...p, isRead: true } : p)));
    setIncoming((prev) => prev.map((p) => (p._id === n._id ? { ...p, isRead: true } : p)));
    setUnreadCount((c) => Math.max(0, c - 1));
    setVersion((v) => v + 1);
    markNotificationRead(n._id).catch(() => {
      // Rolled forward optimistically; a later refresh corrects the badge if this failed.
    });
  }, []);

  const markAllRead = useCallback(() => {
    setLatest((prev) => prev.map((p) => ({ ...p, isRead: true })));
    setIncoming((prev) => prev.map((p) => ({ ...p, isRead: true })));
    setUnreadCount(0);
    setVersion((v) => v + 1);
    markAllNotificationsRead().catch((e) => {
      toastError(e, 'Could not mark all as read');
      refresh();
    });
  }, [refresh]);

  const value = useMemo(
    () => ({ latest, unreadCount, loading, refresh, markRead, markAllRead, version, incoming }),
    [latest, unreadCount, loading, refresh, markRead, markAllRead, version, incoming]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
