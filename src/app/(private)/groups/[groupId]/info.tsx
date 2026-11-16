import { type Href, useLocalSearchParams, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { sortMembers, useGroupManagement } from '@/components/groups/group-manage';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDisplayDate } from '@/lib/date';
import { fetchGroup, type GroupDetail } from '@/lib/groups';
import { resolveImageUrl } from '@/lib/image-url';
import { toastError } from '@/lib/toast';

type Icon = SymbolViewProps['name'];

const ICONS = {
  back: { ios: 'arrow.left', android: 'arrow_back', web: 'arrow_back' },
  camera: { ios: 'camera.fill', android: 'photo_camera', web: 'photo_camera' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  addPerson: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  more: { ios: 'ellipsis', android: 'more_vert', web: 'more_vert' },
  leave: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
} satisfies Record<string, Icon>;

/**
 * Group info (web RightSidebar + settings / add-member dialogs):
 * photo, name and description; admins can change the photo, edit settings ("Admin only messages"),
 * add members, change roles and remove members. Anyone can leave the group.
 */
export default function GroupInfoScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { groupId } = useLocalSearchParams<{ groupId: string }>();

  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    () =>
      groupId
        ? fetchGroup(groupId)
            .then(setGroup)
            .catch((e) => toastError(e, 'Could not load group'))
            .finally(() => setLoading(false))
        : Promise.resolve(),
    [groupId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const manage = useGroupManagement({ group, reload: load, onLeft: () => router.navigate('/groups' as Href) });
  const { me, isAdmin, busy } = manage;
  const goBack = () => (router.canGoBack() ? router.back() : router.navigate(`/groups/${groupId}` as Href));

  const sortedMembers = useMemo(() => sortMembers(group?.members ?? [], me), [group, me]);

  return (
    <View className="flex-1 bg-slate-50">
      <View className="flex-row items-center gap-3 border-b border-slate-200 bg-white px-4 pb-3" style={{ paddingTop: 12 }}>
        <Pressable
          onPress={goBack}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Back to chat"
          className="h-10 w-10 items-center justify-center rounded-full border border-slate-200 active:opacity-70"
        >
          <SymbolView name={ICONS.back} size={20} tintColor="#000000" />
        </Pressable>
        <Text className="flex-1 text-lg font-bold text-black">Group Info</Text>
        {busy ? <ActivityIndicator color="#00214c" /> : null}
      </View>

      {loading || !group ? (
        <View className="items-center gap-3 p-6">
          <Skeleton width={96} height={96} radius={48} />
          <Skeleton width="50%" height={20} />
          <Skeleton width="70%" height={14} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="w-full max-w-3xl self-center gap-4 p-5" contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
          {/* Overview */}
          <View className="items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-6">
            <View>
              <Avatar name={group.groupName} uri={resolveImageUrl(group.image)} size={96} />
              {isAdmin ? (
                <Pressable
                  onPress={manage.changePhoto}
                  accessibilityRole="button"
                  accessibilityLabel="Change group photo"
                  className="absolute -bottom-1 -right-1 h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-primary"
                >
                  <SymbolView name={ICONS.camera} size={15} tintColor="#ffffff" />
                </Pressable>
              ) : null}
            </View>
            <View className="items-center gap-1">
              <Text className="text-center text-xl font-bold text-black">{group.groupName}</Text>
              {group.description ? <Text className="text-center text-sm text-black">{group.description}</Text> : null}
              <Text className="text-xs text-black">
                {group.members.length} members · Created {formatDisplayDate(group.createdAt)}
                {group.creator?.name ? ` by ${group.creator._id === me ? 'you' : group.creator.name}` : ''}
              </Text>
            </View>
            {group.status !== 'active' ? (
              <View className="flex-row items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1">
                <SymbolView name={ICONS.lock} size={12} tintColor="#b45309" />
                <Text className="text-xs font-semibold text-amber-700">Only admins can send messages</Text>
              </View>
            ) : null}

            {isAdmin ? (
              <View className="w-full flex-row gap-2 pt-1">
                <InfoButton icon={ICONS.settings} label="Settings" onPress={manage.openSettings} />
                <InfoButton icon={ICONS.addPerson} label="Add members" onPress={manage.openAddMembers} />
              </View>
            ) : null}
          </View>

          {/* Members */}
          <View className="gap-2">
            <Text className="px-1 text-[13px] font-semibold uppercase tracking-wider text-black">Members ({group.members.length})</Text>
            <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              {sortedMembers.map((m, i) => {
                const canManage = isAdmin && m._id !== me;
                return (
                  <View key={m._id} className={`flex-row items-center gap-3 px-4 py-3 ${i ? 'border-t border-slate-100' : ''}`}>
                    <Avatar name={m.name ?? undefined} uri={resolveImageUrl(m.image ?? undefined)} size={42} />
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>
                        {m._id === me ? 'You' : (m.name ?? 'User')}
                      </Text>
                      {m.email ? (
                        <Text className="text-xs text-black" numberOfLines={1}>
                          {m.email}
                        </Text>
                      ) : null}
                    </View>
                    {m.role === 'admin' ? (
                      <View className="rounded-full bg-blue-50 px-2.5 py-1">
                        <Text className="text-[11px] font-bold text-blue-700">Admin</Text>
                      </View>
                    ) : null}
                    {canManage ? (
                      <Pressable
                        onPress={() => manage.openMember(m)}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel={`Manage ${m.name ?? 'member'}`}
                        className="h-9 w-9 items-center justify-center rounded-full active:bg-slate-100"
                      >
                        <SymbolView name={ICONS.more} size={18} tintColor="#000000" />
                      </Pressable>
                    ) : null}
                  </View>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={manage.leave}
            accessibilityRole="button"
            className="h-12 flex-row items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 active:bg-red-100"
          >
            <SymbolView name={ICONS.leave} size={18} tintColor="#dc2626" />
            <Text className="text-[15px] font-bold text-red-700">Exit group</Text>
          </Pressable>
        </ScrollView>
      )}

      {manage.sheets}
    </View>
  );
}

function InfoButton({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="h-14 flex-1 items-center justify-center gap-1 rounded-xl border border-slate-200 bg-white active:bg-slate-50"
    >
      <SymbolView name={icon} size={19} tintColor="#00214c" />
      <Text className="text-xs font-semibold text-black">{label}</Text>
    </Pressable>
  );
}
