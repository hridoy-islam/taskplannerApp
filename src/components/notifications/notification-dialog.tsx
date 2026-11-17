import { Modal, Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { NotificationItem } from "@/components/notifications/notification-item";
import { Skeleton } from "@/components/ui/skeleton";
import type { AppNotification } from "@/lib/notifications";
import {
  PREVIEW_COUNT,
  useNotifications,
} from "@/providers/notifications-provider";

type NotificationDialogProps = {
  visible: boolean;
  onClose: () => void;
  /** Opens a notification's target (task, group, notes). */
  onOpen: (n: AppNotification) => void;
  onViewAll: () => void;
};

/** Top bar layout (see TopBar): 16px padding, 40px add-user button, 10px gap, then the 40px bell. */
const BELL_CENTER_FROM_RIGHT = 16 + 40 + 10 + 20;
const SIDE_MARGIN = 12;
const POINTER = 14;

/** Bell dropdown: the latest 3 notifications, "Mark all as read" and a "View all notifications" link. */
export function NotificationDialog({
  visible,
  onClose,
  onOpen,
  onViewAll,
}: NotificationDialogProps) {
  const insets = useSafeAreaInsets();
  const { latest, unreadCount, loading, markAllRead } = useNotifications();
  const items = latest.slice(0, PREVIEW_COUNT);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {visible ? (
        <View className="flex-1">
          <Animated.View
            entering={FadeIn.duration(150)}
            className="absolute inset-0 bg-black/30"
          >
            <Pressable
              className="flex-1"
              onPress={onClose}
              accessibilityLabel="Close notifications"
            />
          </Animated.View>

          {/* Drops down from the bell */}
          <Animated.View
            entering={FadeInUp.duration(220)}
            style={{
              marginTop: insets.top + 62,
              marginHorizontal: SIDE_MARGIN,
            }}
          >
            {/* Shadow on iOS only: Android draws `elevation` shadows as boxes, which made the pointer
                below show up as a grey rectangle. The dimmed backdrop separates the card on Android. */}
            <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white ios:shadow-lg ios:shadow-black/15">
              {/* Header */}
              <View className="flex-row items-center justify-between border-b border-slate-200 px-4 py-3">
                <Text className="text-base font-semibold text-black">
                  Notifications
                </Text>
                {unreadCount > 0 ? (
                  <Pressable
                    onPress={markAllRead}
                    hitSlop={8}
                    accessibilityRole="button"
                  >
                    <Text className="text-[13px] font-medium text-blue-600">
                      Mark all as read
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              {/* List */}
              {loading && items.length === 0 ? (
                Array.from({ length: PREVIEW_COUNT }, (_, i) => (
                  <View
                    key={i}
                    className={`flex-row items-center gap-3 px-4 py-3.5 ${i > 0 ? "border-t border-slate-100" : ""}`}
                  >
                    <Skeleton width={36} height={36} radius={18} />
                    <View className="flex-1 gap-2">
                      <Skeleton width="90%" height={13} />
                      <Skeleton width="30%" height={11} />
                    </View>
                  </View>
                ))
              ) : items.length === 0 ? (
                <Text className="px-4 py-8 text-center text-sm text-black">
                  No notifications yet
                </Text>
              ) : (
                items.map((n, i) => (
                  <View
                    key={n._id}
                    className={i > 0 ? "border-t border-slate-100" : ""}
                  >
                    <NotificationItem
                      notification={n}
                      onPress={onOpen}
                      compact
                    />
                  </View>
                ))
              )}

              {/* Footer link */}
              <Pressable
                onPress={onViewAll}
                accessibilityRole="link"
                className="items-center border-t border-slate-200 py-3 active:bg-slate-50"
              >
                <Text className="text-sm font-medium text-blue-600">
                  View all notifications
                </Text>
              </Pressable>
            </View>

            {/* Pointer towards the bell. Drawn after (and above) the card so its lower half
                hides the card's top border, making the two read as one shape. */}
            <View
              className="absolute rotate-45 rounded-[2px] border-l border-t border-slate-200 bg-white"
              style={{
                width: POINTER,
                height: POINTER,
                top: -POINTER / 2 + 1,
                right: BELL_CENTER_FROM_RIGHT - SIDE_MARGIN - POINTER / 2,
                zIndex: 10,
              }}
            />
          </Animated.View>
        </View>
      ) : null}
    </Modal>
  );
}
