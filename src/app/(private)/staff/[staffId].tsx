import { type Href, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { Page } from '@/components/layout/page';
import { ScreenHeader } from '@/components/layout/screen-header';
import { AddByEmailSheet } from '@/components/staff/staff-sheets';
import { Avatar } from '@/components/ui/avatar';
import { SearchInput } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette } from '@/constants/theme';
import { resolveImageUrl } from '@/lib/image-url';
import {
  fetchCompanyMembers,
  fetchStaffMember,
  idOf,
  isAuthorized,
  roleLabel,
  type StaffMember,
  updateColleague,
} from '@/lib/staff';
import { toast, toastError } from '@/lib/toast';

/** Web "Associate Staff" page: manage who is on this person's team (their colleagues). */
export default function AssociateStaffScreen() {
  const { staffId } = useLocalSearchParams<{ staffId: string }>();
  const [member, setMember] = useState<StaffMember | null>(null);
  const [team, setTeam] = useState<StaffMember[]>([]);
  const [directory, setDirectory] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);

  const loadDirectory = useCallback(
    async (companyId?: string) => {
      if (!companyId) return;
      try {
        const all = await fetchCompanyMembers(companyId);
        setDirectory(all.filter((m) => m._id !== staffId));
      } catch (e) {
        toastError(e, 'Could not load members');
      }
    },
    [staffId]
  );

  useEffect(() => {
    if (!staffId) return;
    let active = true;
    fetchStaffMember(staffId)
      .then(async (data) => {
        if (!active) return;
        setMember(data);
        setTeam(Array.isArray(data?.colleagues) ? data.colleagues.filter((c) => c && typeof c === 'object') : []);
        await loadDirectory(idOf(data?.company));
      })
      .catch((e) => active && toastError(e, 'Could not load staff details'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [staffId, loadDirectory]);

  const teamIds = useMemo(() => new Set(team.map((t) => t._id)), [team]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? directory.filter((m) => m.name?.toLowerCase().includes(q)) : directory;
  }, [directory, query]);

  const assign = async (m: StaffMember) => {
    if (!staffId || teamIds.has(m._id)) return;
    setBusyId(m._id);
    try {
      await updateColleague(staffId, m._id, 'add');
      setTeam((prev) => [...prev, m]);
      toast.success('Member assigned', `${m.name} has been assigned.`);
    } catch (e) {
      toastError(e, 'Error assigning member');
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (m: StaffMember) => {
    if (!staffId) return;
    setBusyId(m._id);
    try {
      await updateColleague(staffId, m._id, 'remove');
      setTeam((prev) => prev.filter((t) => t._id !== m._id));
      toast.success('Member removed');
    } catch (e) {
      toastError(e, 'Error removing member');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Page>
      <ScreenHeader title="Associate Staff" fallbackHref={"/staff" as Href} />

      {loading ? (
        <DetailSkeleton />
      ) : !member ? (
        <Text className="py-10 text-center text-sm text-slate-500">Staff member not found.</Text>
      ) : (
        <>
          {/* Profile */}
          <View className="flex-row items-center gap-4 rounded-2xl bg-primary p-5">
            <View className="rounded-full border-2 border-white/30">
              <Avatar name={member.name} uri={resolveImageUrl(member.image)} size={56} />
            </View>
            <View className="flex-1 gap-0.5">
              <Text className="text-xl font-extrabold text-white" numberOfLines={1}>
                {member.name}
              </Text>
              <Text className="text-[13px] text-white/85" numberOfLines={1}>
                {member.email}
              </Text>
              <View className="mt-1.5 flex-row flex-wrap gap-1.5">
                <Badge label={roleLabel(member.role)} />
                {isAuthorized(member) ? <Badge label="Authorized" /> : null}
                {member.isDeleted ? <Badge label="Inactive" /> : null}
              </View>
            </View>
          </View>

          {/* Current team */}
          <Section title="Current Team" count={team.length}>
            {team.length === 0 ? (
              <Text className="py-6 text-center text-sm text-slate-500">No team members assigned yet.</Text>
            ) : (
              team.map((m) => (
                <MemberRow key={m._id} member={m}>
                  <Pressable
                    onPress={() => remove(m)}
                    disabled={busyId === m._id}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.name}`}
                    className="h-9 w-9 items-center justify-center rounded-full bg-red-50 active:bg-red-100"
                  >
                    {busyId === m._id ? (
                      <ActivityIndicator size="small" color={Palette.danger} />
                    ) : (
                      <SymbolView name={{ ios: 'trash', android: 'delete', web: 'delete' }} size={16} tintColor={Palette.danger} />
                    )}
                  </Pressable>
                </MemberRow>
              ))
            )}
          </Section>

          {/* Add members */}
          <Section
            title="Add Members"
            right={
              <Pressable
                onPress={() => setEmailOpen(true)}
                accessibilityRole="button"
                className="flex-row items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 active:opacity-80"
              >
                <SymbolView name={{ ios: 'envelope', android: 'mail', web: 'mail' }} size={14} tintColor={Palette.primary} />
                <Text className="text-xs font-bold text-primary">Add by email</Text>
              </Pressable>
            }
          >
            <SearchInput value={query} onChange={setQuery} placeholder="Search available members..." className="mb-1" />
            {filtered.length === 0 ? (
              <Text className="py-6 text-center text-sm text-slate-500">No matching members found.</Text>
            ) : (
              filtered.map((m) => {
                const assigned = teamIds.has(m._id);
                return (
                  <MemberRow key={m._id} member={m} subtitle={roleLabel(m.role)}>
                    {assigned ? (
                      <View className="rounded-full bg-slate-100 px-2.5 py-1">
                        <Text className="text-[11px] font-semibold text-slate-600">Assigned</Text>
                      </View>
                    ) : (
                      <Pressable
                        onPress={() => assign(m)}
                        disabled={busyId === m._id}
                        accessibilityRole="button"
                        accessibilityLabel={`Add ${m.name}`}
                        className="h-8 min-w-16 flex-row items-center justify-center gap-1 rounded-lg border border-slate-300 px-2.5 active:bg-slate-100"
                      >
                        {busyId === m._id ? (
                          <ActivityIndicator size="small" color={Palette.primary} />
                        ) : (
                          <>
                            <Text className="text-xs font-bold text-slate-900">Add</Text>
                            <SymbolView name={{ ios: 'person.badge.plus', android: 'person_add', web: 'person_add' }} size={14} tintColor={Palette.text} />
                          </>
                        )}
                      </Pressable>
                    )}
                  </MemberRow>
                );
              })
            )}
          </Section>
        </>
      )}

      <AddByEmailSheet
        visible={emailOpen}
        ownerId={staffId}
        title="Add Member"
        subtitle={member ? `Assign someone to ${member.name}'s team.` : undefined}
        onClose={() => setEmailOpen(false)}
        onAdded={(u) => setTeam((prev) => (prev.some((t) => t._id === u._id) ? prev : [...prev, u as StaffMember]))}
      />
    </Page>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <View className="rounded-full bg-white/15 px-2.5 py-0.5">
      <Text className="text-[11px] font-semibold text-white">{label}</Text>
    </View>
  );
}

function Section({
  title,
  count,
  right,
  children,
}: {
  title: string;
  count?: number;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="mb-1 flex-row items-center justify-between">
        <Text className="text-[17px] font-bold tracking-tight text-slate-900">
          {title}
          {count !== undefined ? <Text className="text-slate-400"> · {count}</Text> : null}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

function MemberRow({ member, subtitle, children }: { member: StaffMember; subtitle?: string; children?: ReactNode }) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
      <Avatar name={member.name} uri={resolveImageUrl(member.image)} size={38} />
      <View className="min-w-0 flex-1">
        <Text className="text-sm font-semibold text-slate-900" numberOfLines={1}>
          {member.name}
        </Text>
        <Text className="text-xs text-slate-500" numberOfLines={1}>
          {subtitle ?? member.email}
        </Text>
      </View>
      {children}
    </View>
  );
}

function DetailSkeleton() {
  return (
    <View className="gap-4" accessible accessibilityRole="progressbar" accessibilityLabel="Loading staff details">
      <View className="h-24 flex-row items-center gap-4 rounded-2xl bg-brand-soft p-5">
        <Skeleton width={56} height={56} radius={28} />
        <View className="flex-1 gap-2">
          <Skeleton width="60%" height={18} />
          <Skeleton width="80%" height={12} />
        </View>
      </View>
      <Skeleton width="100%" height={160} radius={16} />
      <Skeleton width="100%" height={220} radius={16} />
    </View>
  );
}
