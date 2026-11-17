import { Redirect, Stack } from 'expo-router';

import { useAppSelector } from '@/hooks/use-redux';

/**
 * Signed-in but not finished setting up (same gates as the website's ProtectedRoute):
 * email not verified → verify-email, profile not completed → personal-details.
 * Logging out from either screen clears the user and lands back on login.
 */
export default function OnboardingLayout() {
  const user = useAppSelector((state) => state.auth.user);
  if (!user) return <Redirect href="/(public)/login" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
