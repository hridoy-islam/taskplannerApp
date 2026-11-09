import { type ViewProps } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';

export type ContainerProps = ViewProps & {
  noPadding?: boolean;
};

export function Container({
  style,
  noPadding = false,
  children,
  ...props
}: ContainerProps) {
  return (
    <ThemedView
      {...props}
      style={[
        {
          width: '100%',
          maxWidth: MaxContentWidth,
          alignSelf: 'center',
          paddingHorizontal: noPadding ? 0 : Spacing.four,
        },
        style,
      ]}
    >
      {children}
    </ThemedView>
  );
}