import * as ImagePicker from 'expo-image-picker';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SearchInput, Sheet } from '@/components/ui/sheet';
import { useAppDispatch, useAppSelector } from '@/hooks/use-redux';
import {
  addGroupMembers,
  type GroupDetail,
  type GroupMember,
  removeGroupMember,
  setGroupMemberRole,
  updateGroup,
  uploadGroupImage,
} from '@/lib/groups';
import { resolveImageUrl } from '@/lib/image-url';
import { toast, toastError } from '@/lib/toast';
import { type Colleague, fetchColleagues } from '@/redux/features/colleaguesSlice';

type Icon = SymbolViewProps['name'];

export const GROUP_ICONS = {
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  media: { ios: 'photo.on.rectangle.angled', android: 'perm_media', web: 'perm_media' },
  camera: { ios: 'camera', android: 'photo_camera', web: 'photo_camera' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  addPerson: { ios: 'person.badge.plus', android: 'person_add', web: 'person_add' },
  members: { ios: 'person.2', android: 'group', web: 'group' },
  admin: { ios: 'checkmark.shield', android: 'admin_panel_settings', web: 'admin_panel_settings' },
  removePerson: { ios: 'person.badge.minus', android: 'person_remove', web: 'person_remove' },
  leave: { ios: 'rectangle.portrait.and.arrow.right', android: 'logout', web: 'logout' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
} satisfies Record<string, Icon>;

/** Members with me first, then admins, then by name. */
export function sortMembers(members: GroupMember[], me?: string) {
  return [...members].sort((a, b) => {
    if (a._id === me) return -1;
    if (b._id === me) return 1;
    if (a.role !== b.role) return a.role === 'admin' ? -1 : 1;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });
}

/**
 * Admin actions on a group (web RightSidebar + settings / add-member dialogs), shared by the
 * chat's ⋮ menu and the Group Info screen. Render `sheets` once in the screen.
 */
export function useGroupManagement({
  group,
  reload,
  onLeft,
}: {
  group: GroupDetail | null;
  /** Reloads the group after a change. */
  reload: () => Promise<unknown>;
  /** Called after I leave the group. */
  onLeft: () => void;
}) {
  const dispatch = useAppDispatch();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const colleagues = useAppSelector((state) => state.colleagues.users);

  const [busy, setBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [memberFor, setMemberFor] = useState<GroupMember | null>(null);

  useEffect(() => {
    if (me && colleagues.length === 0) dispatch(fetchColleagues(me));
  }, [me, colleagues.length, dispatch]);

  const groupId = group?._id;
  const isAdmin = !!group && group.members.find((m) => m._id === me)?.role === 'admin';

  const run = async (work: () => Promise<void>, success: string, failure: string) => {
    setBusy(true);
    try {
      await work();
      toast.success(success);
      await reload();
    } catch (e) {
      toastError(e, failure);
    } finally {
      setBusy(false);
    }
  };

  const changePhoto = async () => {
    if (!groupId) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      toast.error('Photo access needed', 'Allow photo access to change the group photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const type = asset.mimeType ?? 'image/jpeg';
    const name = asset.fileName ?? `group.${type.split('/')[1] ?? 'jpg'}`;
    let file: any = { uri: asset.uri, name, type };
    if (Platform.OS === 'web') {
      const blob = await (await fetch(asset.uri)).blob();
      file = new File([blob], name, { type });
    }
    run(() => uploadGroupImage(groupId, file), 'Group photo updated', 'Upload failed');
  };

  const toggleRole = (m: GroupMember) => {
    setMemberFor(null);
    if (!groupId) return;
    const role = m.role === 'admin' ? 'member' : 'admin';
    run(
      () => setGroupMemberRole(groupId, m._id, role),
      m._id === me ? 'Your role has been changed' : role === 'admin' ? `${m.name ?? 'Member'} is now an admin` : 'Admin rights removed',
      'Failed to change role'
    );
  };

  const removeMember = (m: GroupMember) => {
    setMemberFor(null);
    if (!groupId) return;
    Alert.alert('Remove member?', `${m.name ?? 'This member'} will be removed from the group.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => run(() => removeGroupMember(groupId, m._id), 'Member removed', 'Something went wrong') },
    ]);
  };

  const leave = () => {
    if (!groupId || !me) return;
    Alert.alert('Exit group?', "You'll no longer see this group's messages.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Exit',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeGroupMember(groupId, me);
            toast.success('You left the group');
            onLeft();
          } catch (e) {
            toastError(e, 'Something went wrong');
          }
        },
      },
    ]);
  };

  const sheets = group ? (
    <>
      <SettingsSheet
        visible={settingsOpen}
        group={group}
        onClose={() => setSettingsOpen(false)}
        onSave={(data) => run(() => updateGroup(group._id, data), 'Group updated', 'Failed to update group')}
      />
      <AddMembersSheet
        visible={addOpen}
        people={colleagues.filter((c) => c._id !== me && !group.members.some((m) => m._id === c._id))}
        onClose={() => setAddOpen(false)}
        onAdd={(ids) => run(() => addGroupMembers(group._id, ids), ids.length === 1 ? 'Member added' : 'Members added', 'Failed to add members')}
      />
      <MembersSheet
        visible={membersOpen}
        group={group}
        me={me}
        isAdmin={isAdmin}
        busy={busy}
        onClose={() => setMembersOpen(false)}
        onAdd={() => {
          setMembersOpen(false);
          setTimeout(() => setAddOpen(true), MODAL_SWAP_DELAY);
        }}
        onToggleRole={toggleRole}
        onRemove={removeMember}
      />
      <MemberSheet member={memberFor} onClose={() => setMemberFor(null)} onToggleRole={toggleRole} onRemove={removeMember} />
    </>
  ) : null;

  return {
    me,
    isAdmin,
    busy,
    openSettings: () => setSettingsOpen(true),
    openAddMembers: () => setAddOpen(true),
    openMembers: () => setMembersOpen(true),
    openMember: (m: GroupMember) => setMemberFor(m),
    changePhoto,
    leave,
    sheets,
  };
}

/** iOS can't present a modal while another one is still dismissing. */
export const MODAL_SWAP_DELAY = Platform.OS === 'ios' ? 350 : 0;

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

type SettingsProps = {
  visible: boolean;
  group: GroupDetail;
  onClose: () => void;
  onSave: (data: { groupName: string; description: string; status: 'active' | 'archived' }) => Promise<void>;
};

/** Web group-settings dialog: name, description and "Admin Only Message" (status archived when on). */
function SettingsSheet(props: SettingsProps) {
  return props.visible ? <SettingsContent {...props} /> : null;
}

function SettingsContent({ visible, group, onClose, onSave }: SettingsProps) {
  const [name, setName] = useState(group.groupName);
  const [description, setDescription] = useState(group.description ?? '');
  const [adminOnly, setAdminOnly] = useState(group.status !== 'active');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onSave({ groupName: name.trim(), description: description.trim(), status: adminOnly ? 'archived' : 'active' });
    setSaving(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title="Group Settings"
      subtitle="Change the group's name, description and who can send messages."
      onClose={saving ? () => {} : onClose}
      footer={
        <View className="flex-row gap-3">
          <Button title="Cancel" variant="dark" onPress={onClose} disabled={saving} className="h-12 flex-1 rounded-xl py-0" />
          <Button title="Save" onPress={save} loading={saving} disabled={!name.trim()} className="h-12 flex-1 rounded-xl py-0" />
        </View>
      }
    >
      <View className="gap-4 px-5">
        <View className="gap-1.5">
          <Text className="text-sm font-bold text-black">Group name</Text>
          <TextInput value={name} onChangeText={setName} maxLength={50} className="h-12 rounded-xl border border-slate-300 px-3.5 text-[15px] text-black" />
        </View>
        <View className="gap-1.5">
          <Text className="text-sm font-bold text-black">Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            multiline
            textAlignVertical="top"
            placeholder="What is this group about?"
            placeholderTextColor="#64748b"
            className="min-h-[88px] rounded-xl border border-slate-300 px-3.5 py-2.5 text-[15px] text-black"
          />
        </View>
        <View className="flex-row items-center gap-3 rounded-xl border border-slate-200 px-3.5 py-3">
          <View className="flex-1">
            <Text className="text-[15px] font-semibold text-black">Admin only messages</Text>
            <Text className="text-xs text-black">Only admins can send messages in this group.</Text>
          </View>
          <Switch value={adminOnly} onValueChange={setAdminOnly} trackColor={{ true: '#00214c' }} />
        </View>
      </View>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Add members                                                         */
/* ------------------------------------------------------------------ */

type AddProps = { visible: boolean; people: Colleague[]; onClose: () => void; onAdd: (ids: string[]) => Promise<void> };

function AddMembersSheet(props: AddProps) {
  return props.visible ? <AddMembersContent {...props} /> : null;
}

function AddMembersContent({ visible, people, onClose, onAdd }: AddProps) {
  const [search, setSearch] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const filtered = people.filter((p) => p.name?.toLowerCase().includes(search.trim().toLowerCase()));
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const add = async () => {
    if (!picked.length) return;
    setSaving(true);
    await onAdd(picked);
    setSaving(false);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      title="Add Members"
      subtitle="Pick people from your contacts."
      onClose={saving ? () => {} : onClose}
      footer={
        <Button
          title={picked.length ? `Add ${picked.length}` : 'Select people'}
          onPress={add}
          loading={saving}
          disabled={!picked.length}
          className="h-12 rounded-xl py-0"
        />
      }
    >
      <SearchInput value={search} onChange={setSearch} placeholder="Search people..." />
      <ScrollView contentContainerClassName="px-3 pb-2" keyboardShouldPersistTaps="handled">
        {filtered.length === 0 ? (
          <Text className="py-6 text-center text-sm text-black">
            {people.length === 0 ? 'Everyone is already in this group.' : 'No matching people.'}
          </Text>
        ) : (
          filtered.map((p) => {
            const on = picked.includes(p._id);
            return (
              <Pressable
                key={p._id}
                onPress={() => toggle(p._id)}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                className={`flex-row items-center gap-3 rounded-xl px-3 py-2.5 ${on ? 'bg-blue-50' : 'active:bg-slate-100'}`}
              >
                <Avatar name={p.name} uri={resolveImageUrl(p.image)} size={38} />
                <Text className="flex-1 text-[15px] font-semibold text-black" numberOfLines={1}>
                  {p.name}
                </Text>
                <View className={`h-6 w-6 items-center justify-center rounded-md border ${on ? 'border-primary bg-primary' : 'border-slate-300'}`}>
                  {on ? <SymbolView name={GROUP_ICONS.check} size={14} tintColor="#ffffff" /> : null}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Members list with inline admin actions (opened from the ⋮ menu)     */
/* ------------------------------------------------------------------ */

function MembersSheet({
  visible,
  group,
  me,
  isAdmin,
  busy,
  onClose,
  onAdd,
  onToggleRole,
  onRemove,
}: {
  visible: boolean;
  group: GroupDetail;
  me?: string;
  isAdmin: boolean;
  busy: boolean;
  onClose: () => void;
  onAdd: () => void;
  onToggleRole: (m: GroupMember) => void;
  onRemove: (m: GroupMember) => void;
}) {
  const [search, setSearch] = useState('');
  const members = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = sortMembers(group.members, me);
    return q ? sorted.filter((m) => m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q)) : sorted;
  }, [group.members, me, search]);

  if (!visible) return null;

  return (
    <Sheet visible title="Members" subtitle={`${group.members.length} members${isAdmin ? ' · tap an action to manage' : ''}`} onClose={onClose}>
      <SearchInput value={search} onChange={setSearch} placeholder="Search members..." />
      {isAdmin ? (
        <Pressable onPress={onAdd} accessibilityRole="button" className="mx-3 flex-row items-center gap-3 rounded-xl px-3 py-2.5 active:bg-slate-100">
          <View className="h-[38px] w-[38px] items-center justify-center rounded-full bg-primary">
            <SymbolView name={GROUP_ICONS.addPerson} size={18} tintColor="#ffffff" />
          </View>
          <Text className="flex-1 text-[15px] font-semibold text-black">Add members</Text>
        </Pressable>
      ) : null}
      <ScrollView contentContainerClassName="px-3 pb-2" keyboardShouldPersistTaps="handled">
        {members.map((m) => {
          const canManage = isAdmin && m._id !== me;
          const admin = m.role === 'admin';
          return (
            <View key={m._id} className="gap-2 rounded-xl px-3 py-2.5">
              <View className="flex-row items-center gap-3">
                <Avatar name={m.name ?? undefined} uri={resolveImageUrl(m.image ?? undefined)} size={38} />
                <View className="flex-1">
                  <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>
                    {m._id === me ? 'You' : (m.name ?? 'User')}
                  </Text>
                  {m.email ? (
                    <Text className="text-xs text-slate-500" numberOfLines={1}>
                      {m.email}
                    </Text>
                  ) : null}
                </View>
                {admin ? (
                  <View className="rounded-full bg-blue-50 px-2.5 py-1">
                    <Text className="text-[11px] font-bold text-blue-700">Group admin</Text>
                  </View>
                ) : null}
              </View>
              {canManage ? (
                <View className="ml-[50px] flex-row gap-2">
                  <SmallAction
                    icon={GROUP_ICONS.admin}
                    label={admin ? 'Dismiss as admin' : 'Make admin'}
                    disabled={busy}
                    onPress={() => onToggleRole(m)}
                  />
                  {/* As on the web, admins can't be removed until they're made a member. */}
                  {!admin ? (
                    <SmallAction icon={GROUP_ICONS.removePerson} label="Remove" danger disabled={busy} onPress={() => onRemove(m)} />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
        {busy ? <ActivityIndicator className="py-2" color="#00214c" /> : null}
      </ScrollView>
    </Sheet>
  );
}

function SmallAction({
  icon,
  label,
  danger,
  disabled,
  onPress,
}: {
  icon: Icon;
  label: string;
  danger?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`h-8 flex-row items-center gap-1.5 rounded-full border px-3 ${
        danger ? 'border-red-200 bg-red-50 active:bg-red-100' : 'border-slate-200 bg-white active:bg-slate-100'
      } ${disabled ? 'opacity-50' : ''}`}
    >
      <SymbolView name={icon} size={14} tintColor={danger ? '#dc2626' : '#00214c'} />
      <Text className={`text-xs font-semibold ${danger ? 'text-red-700' : 'text-black'}`}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/* Single member actions (Group Info screen)                           */
/* ------------------------------------------------------------------ */

function MemberSheet({
  member,
  onClose,
  onToggleRole,
  onRemove,
}: {
  member: GroupMember | null;
  onClose: () => void;
  onToggleRole: (m: GroupMember) => void;
  onRemove: (m: GroupMember) => void;
}) {
  if (!member) return null;
  return (
    <Sheet visible title={member.name ?? 'Member'} subtitle={member.email} onClose={onClose}>
      <View className="mx-5 overflow-hidden rounded-xl border border-slate-200">
        <Pressable onPress={() => onToggleRole(member)} accessibilityRole="button" className="flex-row items-center gap-3 px-4 py-3.5 active:bg-slate-50">
          <SymbolView name={GROUP_ICONS.admin} size={18} tintColor="#000000" />
          <Text className="text-[15px] text-black">{member.role === 'admin' ? 'Dismiss as admin' : 'Make group admin'}</Text>
        </Pressable>
        {/* As on the web, admins can't be removed until they're made a member. */}
        {member.role !== 'admin' ? (
          <Pressable
            onPress={() => onRemove(member)}
            accessibilityRole="button"
            className="flex-row items-center gap-3 border-t border-slate-100 px-4 py-3.5 active:bg-red-50"
          >
            <SymbolView name={GROUP_ICONS.removePerson} size={18} tintColor="#dc2626" />
            <Text className="text-[15px] font-semibold text-red-700">Remove from group</Text>
          </Pressable>
        ) : null}
      </View>
    </Sheet>
  );
}
