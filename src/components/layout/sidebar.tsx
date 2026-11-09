import { Image } from 'expo-image';
import { type Href, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Avatar } from '@/components/ui/avatar';
import { IconButton } from '@/components/ui/icon-button';
import { IconTile } from '@/components/ui/icon-tile';
import { SIDEBAR_ITEMS } from '@/constants/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';

const SIDEBAR_WIDTH = 296;
const DURATION = 240;

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: Href) => void;
};

export function Sidebar({ open, onClose, onNavigate }: SidebarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useCurrentUser();
  const progress = useSharedValue(open ? 1 : 0);
  // Keep the overlay mounted until the close animation finishes.
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) setVisible(true);
    progress.value = withTiming(open ? 1 : 0, { duration: DURATION }, (finished) => {
      if (finished && !open) scheduleOnRN(setVisible, false);
    });
  }, [open, progress]);

  // Animated styles stay on the Animated.Views; static styling lives in className on inner Views.
  const panelStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * (SIDEBAR_WIDTH + 24) }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <Pressable className="flex-1 bg-slate-900/40" onPress={onClose} accessibilityLabel="Close sidebar" />
      </Animated.View>

      <Animated.View style={[styles.panel, panelStyle]}>
        <View
          className="flex-1 rounded-r-3xl bg-white px-4 shadow-2xl shadow-slate-900/30"
          style={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }}
        >
          <View className="mb-7 flex-row items-center gap-2.5">
            <Image source={require('@/assets/images/logo.png')} style={styles.logo} contentFit="contain" />
            <IconButton
              icon={{ ios: 'xmark', android: 'close', web: 'close' }}
              label="Close sidebar"
              variant="ghost"
              size={36}
              onPress={onClose}
            />
          </View>

          <Text className="mb-2 px-2 text-[11px] font-bold tracking-widest text-slate-900">TASKS</Text>

          <View className="gap-1">
            {SIDEBAR_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Pressable
                  key={item.name}
                  onPress={() => onNavigate(item.href)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  className={`flex-row items-center gap-3 rounded-xl p-2 ${
                    active ? 'bg-brand-soft' : 'active:bg-slate-100'
                  }`}
                >
                  <IconTile icon={item.icon} tint={item.tint} size={36} />
                  <Text
                    className={`flex-1 text-[15px] ${active ? 'font-bold text-primary' : 'font-medium text-slate-600'}`}
                  >
                    {item.label}
                  </Text>
                  {active ? <View className="mr-1 h-1.5 w-1.5 rounded-full bg-primary" /> : null}
                </Pressable>
              );
            })}
          </View>

          <View className="mt-auto flex-row items-center gap-3 rounded-2xl bg-slate-100 p-3">
            <Avatar name={user?.name} uri={user?.image} size={40} />
            <View className="flex-1">
              <Text className="text-sm font-bold text-slate-900" numberOfLines={1}>
                {user?.name ?? 'User'}
              </Text>
              {user?.email ? (
                <Text className="mt-0.5 text-xs text-slate-500" numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { position: 'absolute', top: 0, bottom: 0, left: 0, width: SIDEBAR_WIDTH },
  logo: { width: 230, height: 56 },
});
