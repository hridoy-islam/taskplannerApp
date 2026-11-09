import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { Modal, Pressable, Text, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Palette } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';

type ProfileMenuProps = {
  visible: boolean;
  /** Distance from the bottom of the screen to the menu (sits above the navbar). */
  bottomOffset: number;
  onClose: () => void;
  onProfile: () => void;
  onLogout: () => void;
};

export function ProfileMenu({ visible, bottomOffset, onClose, onProfile, onLogout }: ProfileMenuProps) {
  const user = useCurrentUser();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable className="flex-1 bg-slate-900/25" onPress={onClose} accessibilityLabel="Close menu">
        {/* Swallow presses inside the card so they don't close the menu. */}
        <Pressable
          onPress={() => {}}
          accessibilityRole="menu"
          className="absolute right-3 w-[264px] rounded-2xl bg-white p-2 shadow-xl shadow-slate-900/20"
          style={{ bottom: bottomOffset }}
        >
          <View className="flex-row items-center gap-3 p-2">
            <Avatar name={user?.name} uri={user?.image} size={44} />
            <View className="flex-1">
              <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>
                {user?.name ?? 'User'}
              </Text>
              {user?.email ? (
                <Text className="mt-0.5 text-[13px] text-slate-500" numberOfLines={1}>
                  {user.email}
                </Text>
              ) : null}
            </View>
          </View>

          <View className="my-1.5 h-px bg-slate-100" />

          <MenuItem label="Profile" icon={{ ios: 'person', android: 'person', web: 'person' }} onPress={onProfile} />
          <MenuItem
            label="Logout"
            destructive
            icon={{ ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' }}
            onPress={onLogout}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuItem({
  label,
  icon,
  destructive,
  onPress,
}: {
  label: string;
  icon: SymbolViewProps['name'];
  destructive?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="menuitem"
      className={`flex-row items-center gap-3 rounded-xl p-2 ${destructive ? 'active:bg-red-50' : 'active:bg-slate-100'}`}
    >
      <View
        className={`h-[34px] w-[34px] items-center justify-center rounded-lg ${destructive ? 'bg-red-50' : 'bg-slate-100'}`}
      >
        <SymbolView name={icon} size={18} tintColor={destructive ? Palette.danger : Palette.text} />
      </View>
      <Text className={`text-[15px] font-semibold ${destructive ? 'text-red-600' : 'text-slate-900'}`}>{label}</Text>
    </Pressable>
  );
}
