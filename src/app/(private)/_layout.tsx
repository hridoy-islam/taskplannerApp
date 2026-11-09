import { type Href, Redirect, usePathname, useRouter } from 'expo-router';
import { TabList, TabSlot, TabTrigger, Tabs } from 'expo-router/ui';
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { BottomNav } from '@/components/layout/bottom-nav';
import { Sidebar } from '@/components/layout/sidebar';
import { TopBar } from '@/components/layout/top-bar';
import { ALL_NAV_ITEMS } from '@/constants/navigation';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import { logout } from '@/redux/features/authSlice';
import { fetchUserProfile } from '@/redux/features/profileSlice';

const PLACEHOLDER_NOTIFICATION_COUNT = 3;

/** Task details and task chat (e.g. /home/task/123, /contact/task/123/chat) are full-height: no bottom navbar. */
const HIDE_BOTTOM_NAV = /\/task\/[^/]+(\/chat)?\/?$/;

export default function PrivateLayout() {
  const dispatch = useAppDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const user = useAppSelector((state) => state.auth.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const userId: string | undefined = user?._id;

  // Load the full profile (image, phone, ...) — the login token only carries basic fields.
  useEffect(() => {
    if (userId) dispatch(fetchUserProfile(userId));
  }, [dispatch, userId]);

  if (!user) {
    return <Redirect href="/(public)/login" />;
  }

  const navigate = (href: Href) => {
    setSidebarOpen(false);
    router.navigate(href);
  };

  return (
    <Tabs style={{ flex: 1, backgroundColor: '#f8fafc' }}>
      <TopBar
        // TODO: replace with the real unread count from the API.
        notificationCount={PLACEHOLDER_NOTIFICATION_COUNT}
        onToggleSidebar={() => setSidebarOpen((open) => !open)}
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
    </Tabs>
  );
}
