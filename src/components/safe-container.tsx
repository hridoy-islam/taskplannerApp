import { type ViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SafeContainerProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
};

export function SafeContainer({
  style,
  lightColor,
  darkColor,
  type,
  edges,
  ...otherProps
}: SafeContainerProps) {
  const theme = useTheme();

  return (
    <SafeAreaView
      edges={edges}
      style={[{ flex: 1, backgroundColor: theme[type ?? 'background'] }, style]}
      {...otherProps}
    />
  );
}
