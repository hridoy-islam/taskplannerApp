import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { Pressable } from 'react-native';

import { Palette } from '@/constants/theme';

type IconButtonProps = {
  icon: SymbolViewProps['name'];
  label: string;
  onPress?: () => void;
  variant?: 'soft' | 'solid' | 'ghost';
  size?: number;
  /** `circle` for fully round buttons. */
  shape?: 'rounded' | 'circle';
  className?: string;
};

const VARIANTS = {
  soft: { container: 'bg-slate-100 active:bg-slate-200', icon: Palette.text },
  solid: { container: 'bg-primary active:opacity-80', icon: Palette.onPrimary },
  ghost: { container: 'bg-transparent active:opacity-60', icon: Palette.text },
} as const;

/** Rounded icon-only button with an accessible label. */
export function IconButton({
  icon,
  label,
  onPress,
  variant = 'soft',
  size = 40,
  shape = 'rounded',
  className = '',
}: IconButtonProps) {
  const v = VARIANTS[variant];

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`items-center justify-center ${shape === 'circle' ? 'rounded-full' : 'rounded-xl'} ${v.container} ${className}`}
      style={{ width: size, height: size }}
    >
      <SymbolView name={icon} size={size * 0.5} tintColor={v.icon} />
    </Pressable>
  );
}
