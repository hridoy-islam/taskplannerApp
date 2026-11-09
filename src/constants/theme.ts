/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    tint: '#00214c',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
  },
  dark: {
    text: '#ffffff',
    tint: '#6fa8ff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
  },
} as const;

/** Task Planner brand palette (from the Figma auth designs). */
export const Brand = {
  primary: '#00214c',
  primaryForeground: '#ffffff',
  link: '#1673ff',
  text: '#000000',
  textMuted: '#344054',
  label: '#1d2939',
  border: '#d0d5dd',
  borderFocused: '#00214c',
  placeholder: '#98a2b3',
  error: '#d92d20',
  surface: '#ffffff',
} as const;

export type ThemeColor =keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

/**
 * Raw colour values for props that can't take a Tailwind class (e.g. SymbolView tintColor).
 * Keep these in sync with tailwind.config.js / global.css.
 */
export const Palette = {
  text: '#0f172a', // slate-900
  textSecondary: '#475569', // slate-600
  textTertiary: '#94a3b8', // slate-400
  primary: '#00214c',
  onPrimary: '#ffffff',
  danger: '#dc2626', // red-600
} as const;

/**
 * Colour sets per tint: `bg` for soft icon tiles, `card` for tinted card surfaces,
 * `solid` for bold coloured cards (use white text on these),
 * `fg` as the raw icon colour (SymbolView can't take a class).
 */
export const Tints = {
  blue: { bg: 'bg-blue-50', card: 'bg-blue-50 border-blue-100', solid: 'bg-blue-600', fg: '#2563eb' },
  amber: { bg: 'bg-amber-50', card: 'bg-amber-50 border-amber-100', solid: 'bg-amber-600', fg: '#d97706' },
  green: { bg: 'bg-emerald-50', card: 'bg-emerald-50 border-emerald-100', solid: 'bg-emerald-600', fg: '#059669' },
  purple: { bg: 'bg-violet-50', card: 'bg-violet-50 border-violet-100', solid: 'bg-violet-600', fg: '#7c3aed' },
  pink: { bg: 'bg-pink-50', card: 'bg-pink-50 border-pink-100', solid: 'bg-pink-600', fg: '#db2777' },
  red: { bg: 'bg-red-50', card: 'bg-red-50 border-red-100', solid: 'bg-red-600', fg: '#dc2626' },
  slate: { bg: 'bg-slate-100', card: 'bg-slate-100 border-slate-200', solid: 'bg-slate-700', fg: '#334155' },
} as const;

export type TintName = keyof typeof Tints;
