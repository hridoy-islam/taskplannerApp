import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
  accessibilityLabel?: string;
};

const BASE = 'rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5';

/** White rounded surface with a soft shadow. Becomes pressable when `onPress` is given. */
export function Card({ children, onPress, className = '', accessibilityLabel }: CardProps) {
  if (!onPress) {
    return <View className={`${BASE} ${className}`}>{children}</View>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      className={`${BASE} active:scale-[0.98] active:opacity-90 ${className}`}
    >
      {children}
    </Pressable>
  );
}
