import { type Href, Redirect, usePathname, useRouter } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { NotificationDialog } from '@/components/notifications/notification-dialog';
import { AddByEmailSheet } from '@/components/staff/staff-sheets';
import { ALL_NAV_ITEMS } from '@/constants/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { type AppNotification, notificationHref } from '@/lib/notifications';
import { isCompanyDirector } from '@/lib/staff';
import { NotificationsProvider, useNotifications } from '@/providers/notifications-provider';
import { logout } from '@/redux/features/authSlice';
import { fetchColleagues } from '@/redux/features/colleaguesSlice';
import { fetchUserProfile } from '@/redux/features/profileSlice';

/**
 * Full-height screens with no bottom navbar: task details/chat (e.g. /home/task/123/chat),
 * the note editor (/notes/123) and group chat / info (/groups/123, /groups/123/info).
 */
const HIDE_BOTTOM_NAV = /(\/task\/[^/]+(\/chat)?|^\/notes\/[^/]+|^\/groups\/[^/]+(\/info)?)\/?$/;

export default function PrivateLayout() {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const userId: string | undefined = user?._id;

  // Load the full profile (image, phone, ...) — the login token only carries basic fields.
  useEffect(() => {
    if (userId) dispatch(fetchUserProfile(userId));
  }, [dispatch, userId]);

  if (!user) {
    return <Redirect href="/(public)/login" />;
  }

  return (
    <NotificationsProvider>
      <PrivateShell />
    </NotificationsProvider>
  );
}

function PrivateShell() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [addColleagueOpen, setAddColleagueOpen] = useState(false);
  const { unreadCount, markRead } = useNotifications();
  const user = useAppSelector((state) => state.auth.user);
  // Web header: the "Add Colleague" button is for the company director only.
  const canAddColleague = isCompanyDirector(user?.role);

  const openNotification = (n: AppNotification) => {
    setNotificationsOpen(false);
    markRead(n);
    const href = notificationHref(n);
    if (href) router.push(href);
  };

  const viewAllNotifications = () => {
    setNotificationsOpen(false);
    router.navigate('/notifications' as Href);
  };

  const navigate = (href: Href) => {
    setSidebarOpen(false);
    router.navigate(href);
  };

  return (
    <Tabs style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TopBar
        notificationCount={unreadCount}
        onNotificationsPress={() => setNotificationsOpen(true)}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
        onAddUserPress={canAddColleague ? () => setAddColleagueOpen(true) : undefined}
      />

      <View className="flex-1">
        <TabSlot />
      </View>

      {HIDE_BOTTOM_NAV.test(pathname) ? null : <BottomNav onNavigate={navigate} onLogout={() => dispatch(logout())} />}

      {/* Registers every signed-in route with the tab navigator; the visible UI is custom. */}
      <TabList style={{ display: 'none' }}>
        {ALL_NAV_ITEMS.map((item) => (
          <TabTrigger key={item.name} name={item.name} href={item.href} />
        ))}
      </TabList>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} onNavigate={navigate} />

      <NotificationDialog
        visible={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
        onOpen={openNotification}
        onViewAll={viewAllNotifications}
      />

      {canAddColleague ? (
        <AddByEmailSheet
          visible={addColleagueOpen}
          ownerId={user?._id}
          onClose={() => setAddColleagueOpen(false)}
          // Refresh contacts so the new colleague shows up straight away.
          onAdded={() => user?._id && dispatch(fetchColleagues(user._id))}
        />
      ) : null}
    </Tabs>
  );
}
