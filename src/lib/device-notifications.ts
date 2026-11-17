import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';

import { type AppNotification, senderName } from './notifications';

// Android fixes a channel's sound when the channel is first created, so a new sound needs a new
// channel id (the old "default" channel had the system sound).
const CHANNEL_ID = 'alerts';
/** assets/sounds/notification.mp3, bundled by the expo-notifications plugin (see app.json). */
const SOUND = 'notification.mp3';

// Show notifications in the phone's tray / as a banner even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Android 8+ needs a channel before anything can be shown; high importance = heads-up banner. */
async function ensureChannel() {
  if (Platform.OS !== 'android') return;
  // Remove the earlier channel (system sound) so only the current one shows in the phone's settings.
  await Notifications.deleteNotificationChannelAsync('default').catch(() => {});
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Notifications',
    importance: Notifications.AndroidImportance.HIGH,
    sound: SOUND,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#00214c',
  });
}

/**
 * Asks for notification permission the first time the app runs. Later launches don't ask again:
 * once the user has answered, the system remembers it (they can change it in the phone's settings).
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    await ensureChannel();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}

/* ------------------------------------------------------------------ */
/* Which chat is on screen                                             */
/* ------------------------------------------------------------------ */

/** Task id (task chat) or group id (group chat) currently open, if any. */
let activeChatId: string | null = null;

/** Notifications that belong to a chat: task chat comments and group messages/mentions. */
const chatIdOf = (n: AppNotification) => ((n.type === 'comment' || n.type === 'group') && n.docId ? n.docId : null);

/**
 * Chat screens call this while focused (and with null when they lose focus). Opening a chat also
 * clears that chat's notification from the tray, like Messenger / WhatsApp.
 */
export function setActiveChat(chatId: string | null) {
  activeChatId = chatId;
  if (chatId) clearChatNotification(chatId);
  activeChatListeners.forEach((fn) => fn());
}

/** The open chat, or null when none is open or the app isn't in the foreground. */
export function getVisibleChat() {
  return AppState.currentState === 'active' ? activeChatId : null;
}

const activeChatListeners = new Set<() => void>();

/** Runs `fn` whenever the open chat changes (used to tell the server, see NotificationsProvider). */
export function subscribeActiveChat(fn: () => void) {
  activeChatListeners.add(fn);
  return () => {
    activeChatListeners.delete(fn);
  };
}

/** True when the user is looking at the chat this notification is about (app in the foreground). */
export function isViewingChatOf(n: AppNotification) {
  const chatId = chatIdOf(n);
  return !!chatId && chatId === activeChatId && AppState.currentState === 'active';
}

/* ------------------------------------------------------------------ */
/* Tray notifications                                                  */
/* ------------------------------------------------------------------ */

/** Lines waiting in each chat's tray notification, oldest first. */
const pendingByChat = new Map<string, string[]>();
/** How many lines one grouped notification shows. */
const MAX_LINES = 5;

const chatTrayId = (chatId: string) => `chat-${chatId}`;

function clearChatNotification(chatId: string) {
  pendingByChat.delete(chatId);
  Notifications.dismissNotificationAsync(chatTrayId(chatId)).catch(() => {});
}

/**
 * Posts an app notification to the phone's notification tray.
 * Everything from the same task chat / group goes into ONE notification that is updated in place
 * ("3 new messages" + the latest lines) instead of stacking a new one per message.
 */
export async function showDeviceNotification(n: AppNotification) {
  try {
    if (isViewingChatOf(n)) return;
    const { granted } = await Notifications.getPermissionsAsync();
    if (!granted) return;

    const chatId = chatIdOf(n);
    let title = senderName(n) ?? 'Task Planner';
    let body = n.message;
    let identifier: string | undefined;

    if (chatId) {
      const lines = [...(pendingByChat.get(chatId) ?? []), n.message];
      pendingByChat.set(chatId, lines);
      identifier = chatTrayId(chatId);
      if (lines.length > 1) {
        title = `${lines.length} new messages`;
        body = lines.slice(-MAX_LINES).join('\n');
      }
    }

    await Notifications.scheduleNotificationAsync({
      // Same identifier = the existing notification for this chat is replaced, not duplicated.
      identifier,
      content: {
        title,
        body,
        data: { notification: n },
        sound: SOUND,
      },
      // null = show now.
      trigger: Platform.OS === 'android' ? { channelId: CHANNEL_ID } : null,
    });
  } catch {
    // A missed tray notification isn't worth an error; the in-app bell still has it.
  }
}

/**
 * Calls `onOpen` when the user taps one of our notifications in the tray —
 * including a tap that launched the app from closed.
 */
export function useDeviceNotificationTaps(onOpen: (n: AppNotification) => void) {
  const onOpenRef = useRef(onOpen);
  useEffect(() => {
    onOpenRef.current = onOpen;
  });

  useEffect(() => {
    const handled = new Set<string>();
    const handle = (response: Notifications.NotificationResponse | null) => {
      if (!response) return;
      const id = response.notification.request.identifier;
      const n = response.notification.request.content.data?.notification as AppNotification | undefined;
      if (!n?._id || handled.has(id)) return;
      handled.add(id);
      // Start the chat's grouped notification afresh once the user has opened it.
      const chatId = chatIdOf(n);
      if (chatId) pendingByChat.delete(chatId);
      onOpenRef.current(n);
      Notifications.clearLastNotificationResponseAsync?.().catch(() => {});
    };

    // Tap that opened the app from the background / closed state.
    Notifications.getLastNotificationResponseAsync().then(handle).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(handle);
    return () => sub.remove();
  }, []);
}
