import type { SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Text, View } from 'react-native';

import { IconTile } from '@/components/ui/icon-tile';
import type { TintName } from '@/constants/theme';

type EmptyStateProps = {
  icon: SymbolViewProps['name'];
  tint?: TintName;
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ icon, tint = 'blue', title, description, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-2 px-6 py-10">
      <IconTile icon={icon} tint={tint} size={64} />
      <Text className="mt-2 text-center text-lg font-bold text-slate-900">{title}</Text>
      {description ? (
        <Text className="max-w-[300px] text-center text-sm leading-5 text-slate-500">{description}</Text>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}
