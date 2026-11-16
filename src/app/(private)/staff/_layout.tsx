import { Redirect, Stack } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';
import { canManageStaff } from '@/lib/staff';

/** Staff management: company director and managers only. */
export default function Layout() {
  const role = useAppSelector((state) => state.auth.user?.role);
  if (!canManageStaff(role)) return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
