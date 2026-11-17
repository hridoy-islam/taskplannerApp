import { SymbolView } from 'expo-symbols';
import { Pressable, Text } from 'react-native';

import { useAppDispatch } from '@/hooks/use-redux';
import { logout } from '@/redux/features/authSlice';

/** Black "Log out" pill for the onboarding screens (the user can't reach the app's menus yet). */
export function OnboardingLogoutButton() {
  const dispatch = useAppDispatch();
  return (
    <Pressable
      onPress={() => dispatch(logout())}
      accessibilityRole="button"
      accessibilityLabel="Log out"
      hitSlop={6}
      className="h-10 flex-row items-center gap-1.5 self-end rounded-full bg-black px-4 active:opacity-80"
    >
      <SymbolView name={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }} size={16} tintColor="#ffffff" />
      <Text className="text-sm font-bold text-white">Log out</Text>
    </Pressable>
  );
}
