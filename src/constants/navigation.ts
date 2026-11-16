import type { Href } from 'expo-router';
import type { SymbolViewProps } from 'expo-symbols';

import type { TintName } from '@/constants/theme';

export type NavIcon = SymbolViewProps['name'];

export type NavItem = {
  /** Unique tab name used by the tab navigator. */
  name: string;
  label: string;
  href: Href;
  icon: NavIcon;
  /** Filled variant shown when the item is active (iOS has fill variants). */
  activeIcon?: NavIcon;
  description?: string;
  tint?: TintName;
  /** Roles that can see this item; visible to everyone when omitted. */
  roles?: string[];
};

/** Bottom navbar tabs. Profile is handled separately (it opens a menu). */
export const BOTTOM_NAV_ITEMS: NavItem[] = [
  {
    name: 'home',
    label: 'Home',
    href: '/home',
    icon: { ios: 'house', android: 'home', web: 'home' },
    activeIcon: { ios: 'house.fill', android: 'home', web: 'home' },
  },
  {
    name: 'groups',
    label: 'Groups',
    href: '/groups',
    icon: { ios: 'person.3', android: 'groups', web: 'groups' },
    activeIcon: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
    description: 'Create groups and work together on tasks.',
    tint: 'purple',
  },
  {
    name: 'contact',
    label: 'Contact',
    href: '/contact',
    icon: { ios: 'person.crop.circle', android: 'contacts', web: 'contacts' },
    activeIcon: { ios: 'person.crop.circle.fill', android: 'contacts', web: 'contacts' },
    description: 'Your contacts will appear here.',
    tint: 'green',
  },
  {
    name: 'notes',
    label: 'Notes',
    href: '/notes',
    icon: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
    activeIcon: { ios: 'note.text', android: 'sticky_note_2', web: 'sticky_note_2' },
    description: 'Capture ideas and keep quick notes.',
    tint: 'pink',
  },
];

export const PROFILE_NAV_ITEM: NavItem = {
  name: 'profile',
  label: 'Profile',
  href: '/profile',
  icon: { ios: 'person.circle', android: 'account_circle', web: 'account_circle' },
};

/** Sidebar links. */
export const SIDEBAR_ITEMS: NavItem[] = [
  {
    name: 'planner',
    label: 'Planner',
    href: '/planner',
    icon: { ios: 'calendar', android: 'calendar_month', web: 'calendar_month' },
    description: 'Plan your day and week.',
    tint: 'blue',
  },
  {
    name: 'important-tasks',
    label: 'Important Task',
    href: '/important-tasks',
    icon: { ios: 'star', android: 'star', web: 'star' },
    description: 'Tasks you have marked as important.',
    tint: 'amber',
  },
  {
    name: 'scheduled-tasks',
    label: 'Schedule Task',
    href: '/scheduled-tasks',
    icon: { ios: 'clock', android: 'schedule', web: 'schedule' },
    description: 'Tasks with a date and time.',
    tint: 'green',
  },
  {
    name: 'staff',
    label: 'Staff',
    href: '/staff' as Href,
    icon: { ios: 'person.2.badge.gearshape', android: 'manage_accounts', web: 'manage_accounts' },
    description: 'Create and manage your staff.',
    tint: 'purple',
    // Company director and manager (web: Staff nav item for 'company' and 'creator').
    roles: ['company', 'creator'],
  },
];

/** Sidebar / quick-link items the given role is allowed to see. */
export function sidebarItemsFor(role?: string): NavItem[] {
  return SIDEBAR_ITEMS.filter((item) => !item.roles || (!!role && item.roles.includes(role)));
}

/** Opened from the bell in the top bar (not shown in the sidebar or navbar). */
export const NOTIFICATIONS_NAV_ITEM: NavItem = {
  name: 'notifications',
  label: 'Notifications',
  href: '/notifications' as Href,
  icon: { ios: 'bell', android: 'notifications', web: 'notifications' },
  description: 'Your latest updates.',
  tint: 'blue',
};

/** Every route inside the signed-in area. */
export const ALL_NAV_ITEMS: NavItem[] = [...BOTTOM_NAV_ITEMS, PROFILE_NAV_ITEM, ...SIDEBAR_ITEMS, NOTIFICATIONS_NAV_ITEM];

export function getNavItem(name: string): NavItem {
  const item = ALL_NAV_ITEMS.find((i) => i.name === name);
  if (!item) throw new Error(`Unknown nav item: ${name}`);
  return item;
}
