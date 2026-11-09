import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Brand } from '@/constants/theme';

const SIZE = 42;
const REST_BG = '#f2f4f7';
const PRESSED_BG = '#e4e7ec';

/** Soft filled circular back button with a press-scale animation. */
export function BackButton() {
  const router = useRouter();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.08 }],
    backgroundColor: interpolateColor(pressed.value, [0, 1], [REST_BG, PRESSED_BG]),
  }));

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        if (router.canGoBack()) router.back();
        else router.replace('/(public)/login');
      }}
      onPressIn={() => {
        pressed.value = withTiming(1, { duration: 90 });
      }}
      onPressOut={() => {
        pressed.value = withSpring(0, { damping: 12, stiffness: 220 });
      }}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={10}
    >
      <Animated.View style={[styles.circle, animatedStyle]}>
        <SymbolView
          name={{ ios: 'chevron.left', android: 'arrow_back_ios_new', web: 'arrow_back_ios_new' }}
          size={20}
          tintColor={Brand.primary}
          fallback={<Text style={styles.fallback}>‹</Text>}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: { fontSize: 26, lineHeight: 28, fontWeight: '600', color: Brand.primary },
});
