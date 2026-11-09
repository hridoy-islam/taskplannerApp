import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ActivityIndicator, Pressable, type PressableProps, Text } from 'react-native';

const colorMap = {
  light: {
    default: '#ffffff',
    outline: '#000000',
    destructive: '#ffffff',
    dark: '#ffffff',
    warning: '#ffffff',
  },
  dark: {
    default: '#ffffff',
    outline: '#ffffff',
    destructive: '#ffffff',
    dark: '#ffffff',
    warning: '#ffffff',
  },
} as const;

const variants = {
  default: {
    container: 'bg-primary active:opacity-90 disabled:opacity-50',
    text: 'text-primary-foreground',
  },
  outline: {
    container: 'border border-foreground active:bg-accent disabled:opacity-50',
    text: 'text-foreground',
  },
  destructive: {
    container: 'bg-destructive active:opacity-90 disabled:opacity-50',
    text: 'text-destructive-foreground',
  },
  dark: {
    container: 'bg-black active:opacity-90 disabled:opacity-50',
    text: 'text-white',
  },
  warning: {
    container: 'bg-orange-500 active:opacity-90 disabled:opacity-50',
    text: 'text-white',
  },
} as const;

export type ButtonProps = Omit<PressableProps, 'children'> & {
  children?: ReactNode;
  variant?: keyof typeof variants;
  loading?: boolean;
  title?: string;
  size?: 'default' | 'lg';
};

const sizes = {
  default: { container: 'rounded-lg px-4 py-3.5', text: 'text-base' },
  lg: { container: 'rounded px-4 py-4', text: 'text-lg' },
} as const;

export function Button({
  variant = 'default',
  loading,
  disabled,
  title,
  size = 'default',
  children,
  className = '',
  ...props
}: ButtonProps) {
  const scheme = useColorScheme();
  const v = variants[variant];
  const sz = sizes[size];
  const indicatorColor = colorMap[scheme === 'dark' ? 'dark' : 'light'][variant];

  return (
    <Pressable
      disabled={disabled || loading}
      className={`${sz.container} flex-row items-center justify-center gap-2 ${v.container} ${className}`}
      {...props}
    >
      {loading ? <ActivityIndicator size="small" color={indicatorColor} /> : null}
      {title ? <Text className={`font-bold ${sz.text} ${v.text}`}>{title}</Text> : null}
      {children}
    </Pressable>
  );
}
