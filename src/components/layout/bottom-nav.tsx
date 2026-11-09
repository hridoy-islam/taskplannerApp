import { type Href, usePathname } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProfileMenu } from '@/components/layout/profile-menu';
import { Avatar } from '@/components/ui/avatar';
import { BOTTOM_NAV_ITEMS, PROFILE_NAV_ITEM } from '@/constants/navigation';
import { Palette } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';

type BottomNavProps = {
  onNavigate: (href: Href) => void;
  onLogout: () => void;
};

/** Height of the bar above the safe area, used to place the profile menu just above it. */
const BAR_HEIGHT = 64;

export function BottomNav({ onNavigate, onLogout }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const user = useCurrentUser();
  const [menuOpen, setMenuOpen] = useState(false);
  const profileActive = pathname === PROFILE_NAV_ITEM.href || menuOpen;

  return (
    <View className="border-t border-slate-200/70 bg-white" style={{ paddingBottom: insets.bottom }}>
      {/* Full-width bar */}
      <View className="flex-row items-center px-2" style={{ height: BAR_HEIGHT }} accessibilityRole="tablist">
        {BOTTOM_NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <TabButton key={item.name} label={item.label} active={active} onPress={() => onNavigate(item.href)}>
              <SymbolView
                name={active ? (item.activeIcon ?? item.icon) : item.icon}
                size={24}
                tintColor={active ? Palette.primary : Palette.textTertiary}
              />
            </TabButton>
          );
        })}

        <TabButton label={PROFILE_NAV_ITEM.label} active={profileActive} expanded={menuOpen} onPress={() => setMenuOpen(true)}>
          <Avatar name={user?.name} uri={user?.image} size={24} ring={profileActive} />
        </TabButton>
      </View>

      <ProfileMenu
        visible={menuOpen}
        bottomOffset={insets.bottom + BAR_HEIGHT + 8}
        onClose={() => setMenuOpen(false)}
        onProfile={() => {
          setMenuOpen(false);
          onNavigate(PROFILE_NAV_ITEM.href);
        }}
        onLogout={() => {
          setMenuOpen(false);
          onLogout();
        }}
      />
    </View>
  );
}

function TabButton({
  label,
  active,
  expanded,
  onPress,
  children,
}: {
  label: string;
  active: boolean;
  expanded?: boolean;
  onPress: () => void;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: active, expanded }}
      accessibilityLabel={label}
      className="h-full flex-1 items-center justify-center gap-1 active:scale-95 active:opacity-70"
    >
      <View className="h-7 items-center justify-center">{children}</View>
      <Text className={`text-[11px] ${active ? 'font-bold text-primary' : 'font-medium text-slate-400'}`}>{label}</Text>
      {/* Active indicator: a short dash instead of a background */}
      <View className={`h-[3px] w-5 rounded-full ${active ? 'bg-primary' : 'bg-transparent'}`} />
    </Pressable>
  );
}
