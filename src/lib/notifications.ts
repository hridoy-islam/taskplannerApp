import type { Href } from 'expo-router';

import axiosInstance from './axios';

/** Notification document from the API (`/notifications`). */
export type AppNotification = {
  _id: string;
  message: string;
  isRead: boolean;
  type?: 'task' | 'comment' | 'group' | 'note' | 'message' | 'invoice' | string;
  docId?: string;
  senderId?: { _id?: string; name?: string; image?: string } | string | null;
  createdAt?: string;
  updatedAt?: string;
};

export const NOTIFICATION_PAGE_SIZE = 15;

/** One page of notifications plus the total count (from the API's meta), newest first. */
export async function fetchNotificationsPage(userId: string, limit = NOTIFICATION_PAGE_SIZE) {
  const res = await axiosInstance.get(`/notifications/${userId}`, { params: { limit, sort: '-createdAt' } });
  const result = res.data?.data?.result;
  const items = (Array.isArray(result) ? result : []) as AppNotification[];
  const total = res.data?.data?.meta?.total;
  return { items, total: typeof total === 'number' ? total : items.length };
}

/** Newest first (the API sorts by -createdAt by default). */
export async function fetchNotifications(userId: string, limit = NOTIFICATION_PAGE_SIZE) {
  const res = await axiosInstance.get(`/notifications/${userId}`, { params: { limit, sort: '-createdAt' } });
  const result = res.data?.data?.result;
  return (Array.isArray(result) ? result : []) as AppNotification[];
}

/** Total unread, from the list endpoint's meta (the API filters on `isRead`). */
export async function fetchUnreadCount(userId: string) {
  const res = await axiosInstance.get(`/notifications/${userId}`, { params: { isRead: false, limit: 1 } });
  const total = res.data?.data?.meta?.total;
  return typeof total === 'number' ? total : 0;
}

export async function markNotificationRead(id: string) {
  await axiosInstance.patch(`/notifications/${id}/read`, { isRead: true });
}

export async function markAllNotificationsRead() {
  await axiosInstance.patch('/notifications/readall');
}

/**
 * Where tapping a notification goes (same rules as the web NotificationDropdown):
 * task/comment → task details, group → groups, note → notes.
 * Task details open inside the notifications stack so "back" returns to the list.
 */
export function notificationHref(n: AppNotification): Href | null {
  if ((n.type === 'task' || n.type === 'comment') && n.docId) return `/notifications/task/${n.docId}` as Href;
  if (n.type === 'group') return (n.docId ? `/groups/${n.docId}` : '/groups') as Href;
  if (n.type === 'note') return (n.docId ? `/notes/${n.docId}` : '/notes') as Href;
  return null;
}

export const senderName = (n: AppNotification) => (typeof n.senderId === 'object' ? n.senderId?.name : undefined);
export const senderImage = (n: AppNotification) => (typeof n.senderId === 'object' ? n.senderId?.image : undefined);
