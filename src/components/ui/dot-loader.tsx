import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

type DotLoaderProps = {
  /** Diameter of each dot in px. */
  size?: number;
  /** Dot colour; defaults to the app's primary colour. */
  color?: string;
  /** Number of dots. */
  count?: number;
  /** Accessible description of what is loading. */
  label?: string;
};

const DURATION = 380;
const STAGGER = 140;

/** Three (by default) primary-coloured dots that bounce and fade in sequence. */
export function DotLoader({ size = 10, color = Palette.primary, count = 3, label = 'Loading' }: DotLoaderProps) {
  return (
    <View
      className="flex-row items-center justify-center"
      style={{ gap: size * 0.6, height: size * 2 }}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
    >
      {Array.from({ length: count }, (_, i) => (
        <Dot key={i} index={i} size={size} color={color} />
      ))}
    </View>
  );
}

function Dot({ index, size, color }: { index: number; size: number; color: string }) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5;
      return;
    }
    const ease = Easing.inOut(Easing.ease);
    progress.value = withDelay(
      index * STAGGER,
      withRepeat(
        withSequence(
          withTiming(1, { duration: DURATION, easing: ease }),
          withTiming(0, { duration: DURATION, easing: ease }),
          // Rest so the wave reads as a sequence rather than constant motion.
          withTiming(0, { duration: STAGGER })
        ),
        -1
      )
    );
    return () => cancelAnimation(progress);
  }, [index, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + progress.value * 0.65,
    transform: [{ translateY: -progress.value * size * 0.6 }, { scale: 0.85 + progress.value * 0.25 }],
  }));

  return (
    <Animated.View
      style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]}
    />
  );
}
