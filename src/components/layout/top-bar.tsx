import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IconButton } from '@/components/ui/icon-button';

type TopBarProps = {
  onToggleSidebar: () => void;
  /** Unread count shown on the bell. Hidden when 0. */
  notificationCount?: number;
  onNotificationsPress?: () => void;
  onAddUserPress?: () => void;
};

export function TopBar({ onToggleSidebar, notificationCount = 0, onNotificationsPress, onAddUserPress }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const badge = notificationCount > 99 ? '99+' : String(notificationCount);

  return (
    <View
      className="flex-row items-center justify-between border-b border-slate-200/70 bg-white px-4 pb-3"
      style={{ paddingTop: insets.top + 10 }}
    >
      <IconButton
        icon={{ ios: 'line.3.horizontal', android: 'menu', web: 'menu' }}
        label="Toggle sidebar"
        variant="ghost"
        onPress={onToggleSidebar}
      />

      <View className="flex-row items-center gap-2.5">
        <View>
          <IconButton
            icon={{ ios: 'bell', android: 'notifications', web: 'notifications' }}
            label={notificationCount > 0 ? `Notifications, ${notificationCount} unread` : 'Notifications'}
            shape="circle"
            onPress={onNotificationsPress}
          />
          {notificationCount > 0 ? (
            <View
              pointerEvents="none"
              className="absolute -right-1 -top-1 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-500 px-1"
            >
              <Text className="text-[10px] font-bold leading-3 text-white">{badge}</Text>
            </View>
          ) : null}
        </View>

        <IconButton
          icon={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }}
          label="Add user"
          variant="solid"
          shape="circle"
          onPress={onAddUserPress}
        />
      </View>
    </View>
  );
}
