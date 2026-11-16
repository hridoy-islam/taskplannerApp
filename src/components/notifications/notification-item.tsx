import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { formatDisplayDate, ukMoment } from '@/lib/date';
import type { AppNotification } from '@/lib/notifications';

type Kind = { icon: SymbolViewProps['name'] };

/** Icon per notification type (same grouping as the web dropdown). */
function kindOf(type?: string): Kind {
  switch (type) {
    case 'task':
    case 'invoice':
      return { icon: { ios: 'briefcase', android: 'work', web: 'work' } };
    case 'comment':
      return { icon: { ios: 'text.bubble', android: 'chat_bubble_outline', web: 'chat_bubble_outline' } };
    case 'note':
      return { icon: { ios: 'doc.text', android: 'description', web: 'description' } };
    case 'group':
    case 'message':
      return { icon: { ios: 'person.3', android: 'groups', web: 'groups' } };
    default:
      return { icon: { ios: 'bell', android: 'notifications_none', web: 'notifications_none' } };
  }
}

/** "Just now", "5m ago", "3h ago", "Yesterday", then the date. */
export function timeAgo(value?: string) {
  const m = ukMoment(value);
  if (!m) return 'Just now';
  const minutes = Math.floor((Date.now() - m.valueOf()) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  if (minutes < 2880) return 'Yesterday';
  return formatDisplayDate(value);
}

type NotificationItemProps = {
  notification: AppNotification;
  onPress: (n: AppNotification) => void;
  /** Limit the message to two lines (bell dialog). */
  compact?: boolean;
};

/** Plain notification row: type icon, message, time, and a dot when unread. */
function NotificationItemBase({ notification: n, onPress, compact = false }: NotificationItemProps) {
  const unread = !n.isRead;

  return (
    <Pressable
      onPress={() => onPress(n)}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? 'Unread. ' : ''}${n.message}`}
      className={`flex-row items-start gap-3 px-4 py-3.5 ${unread ? 'bg-blue-50 active:bg-blue-100' : 'bg-white active:bg-slate-100'}`}
    >
      <View className={`h-9 w-9 items-center justify-center rounded-full ${unread ? 'bg-white' : 'bg-slate-100'}`}>
        <SymbolView name={kindOf(n.type).icon} size={17} tintColor="#000000" />
      </View>

      <View className="flex-1 gap-1">
        <Text
          className={`text-[14px] leading-5 text-black ${unread ? 'font-semibold' : ''}`}
          numberOfLines={compact ? 2 : undefined}
        >
          {n.message}
        </Text>
        <Text className="text-xs text-black">{timeAgo(n.createdAt)}</Text>
      </View>

      {unread ? <View className="mt-2 h-2 w-2 rounded-full bg-blue-600" /> : null}
    </Pressable>
  );
}

export const NotificationItem = memo(NotificationItemBase);
