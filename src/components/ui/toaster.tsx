import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { Easing, FadeInUp, FadeOutUp, LinearTransition } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { dismissToast, subscribeToasts, type ToastItem, type ToastType } from '@/lib/toast';

// Calm, short motion: a gentle fade + small slide, no spring bounce.
const ENTER = FadeInUp.duration(220).easing(Easing.out(Easing.cubic));
const EXIT = FadeOutUp.duration(160).easing(Easing.in(Easing.cubic));
const LAYOUT = LinearTransition.duration(180);

const TONES: Record<ToastType, { iconBg: string; icon: SymbolViewProps['name'] }> = {
  success: {
    iconBg: 'bg-emerald-500',
    icon: { ios: 'checkmark', android: 'check', web: 'check' },
  },
  error: {
    iconBg: 'bg-red-500',
    icon: { ios: 'exclamationmark', android: 'priority_high', web: 'priority_high' },
  },
  info: {
    iconBg: 'bg-primary',
    icon: { ios: 'info', android: 'info', web: 'info' },
  },
};

/** Renders toasts sliding down from the top. Mount once, in the root layout. */
export function Toaster() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (!items.length) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute inset-x-0 top-0 z-50 items-center gap-2 px-4"
      style={{ paddingTop: insets.top + 8 }}
    >
      {items.map((item) => (
        <ToastCard key={item.id} item={item} />
      ))}
    </View>
  );
}

function ToastCard({ item }: { item: ToastItem }) {
  const tone = TONES[item.type];

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(item.id), item.duration);
    return () => clearTimeout(timer);
  }, [item.id, item.duration]);

  return (
    <Animated.View
      entering={ENTER}
      exiting={EXIT}
      layout={LAYOUT}
      className="w-full max-w-md"
    >
      <Pressable
        onPress={() => dismissToast(item.id)}
        accessibilityRole="alert"
        accessibilityLabel={item.message ? `${item.title}. ${item.message}` : item.title}
        accessibilityHint="Tap to dismiss"
        className="flex-row items-center gap-3 rounded-2xl border border-slate-200 bg-white py-3 pl-3 pr-3.5 shadow-sm shadow-slate-900/10 active:opacity-90"
        style={{ elevation: 2 }}
      >
        <View className={`h-7 w-7 items-center justify-center rounded-full ${tone.iconBg}`}>
          <SymbolView name={tone.icon} size={14} tintColor="#ffffff" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-bold text-black" numberOfLines={1}>
            {item.title}
          </Text>
          {item.message ? (
            <Text className="text-[13px] leading-[18px] text-black" numberOfLines={3}>
              {item.message}
            </Text>
          ) : null}
        </View>
        <SymbolView name={{ ios: 'xmark', android: 'close', web: 'close' }} size={14} tintColor="#000000" />
      </Pressable>
    </Animated.View>
  );
}
