import { useEffect } from 'react';
import type { DimensionValue } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Palette } from '@/constants/theme';

type SkeletonProps = {
  width: DimensionValue;
  height: DimensionValue;
  /** Corner radius in px. */
  radius?: number;
  /** Block colour; defaults to the app's primary colour. */
  color?: string;
  /** Accessible description of what is loading. */
  label?: string;
};

const DURATION = 750;

/** Placeholder block that pulses gently while its content loads. */
export function Skeleton({ width, height, radius = 8, color = Palette.primary, label = 'Loading' }: SkeletonProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(withTiming(1, { duration: DURATION, easing: Easing.inOut(Easing.ease) }), -1, true);
    return () => cancelAnimation(progress);
  }, [progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: 0.25 + progress.value * 0.3 }));

  return (
    <Animated.View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[{ width, height, borderRadius: radius, backgroundColor: color }, style]}
    />
  );
}
