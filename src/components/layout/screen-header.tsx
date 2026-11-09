import { type Href, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

type ScreenHeaderProps = {
  title: string;
  /** Where to go when there's no screen to go back to. */
  fallbackHref: Href;
  right?: ReactNode;
};

/** Back arrow + centred title, as used on the inner screens in the design. */
export function ScreenHeader({ title, fallbackHref, right }: ScreenHeaderProps) {
  const router = useRouter();

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.navigate(fallbackHref);
  };

  return (
    <View className="flex-row items-center gap-3">
      <Pressable
        onPress={goBack}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white active:opacity-70"
      >
        <SymbolView name={{ ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor="#0f172a" />
      </Pressable>
      <Text className="flex-1 text-center text-xl font-extrabold tracking-tight text-slate-900" numberOfLines={1}>
        {title}
      </Text>
      {/* Keeps the title centred when there's no right-hand action. */}
      <View className="min-w-10 items-end">{right}</View>
    </View>
  );
}
