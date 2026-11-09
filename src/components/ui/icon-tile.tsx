import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { View } from 'react-native';

import { type TintName, Tints } from '@/constants/theme';

type IconTileProps = {
  icon: SymbolViewProps['name'];
  tint?: TintName;
  size?: number;
  /** `circle` for a round tile. */
  shape?: 'rounded' | 'circle';
};

/** Icon on a soft coloured square — used in cards, menus and empty states. */
export function IconTile({ icon, tint = 'slate', size = 40, shape = 'rounded' }: IconTileProps) {
  const t = Tints[tint];

  return (
    <View
      className={`items-center justify-center ${shape === 'circle' ? 'rounded-full' : size >= 56 ? 'rounded-2xl' : 'rounded-xl'} ${t.bg}`}
      style={{ width: size, height: size }}
    >
      <SymbolView name={icon} size={size * 0.5} tintColor={t.fg} />
    </View>
  );
}
