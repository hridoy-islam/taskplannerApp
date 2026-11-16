import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, Switch, Text, View } from 'react-native';

import { Page } from '@/components/layout/page';
import { StaffFormSheet } from '@/components/staff/staff-sheets';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchInput } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Palette } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { resolveImageUrl } from '@/lib/image-url';
import {
  fetchStaff,
  isAuthorized,
  roleLabel,
  setStaffActive,
  setStaffAuthorized,
  STAFF_ROLE_OPTIONS,
  type StaffMember,
  type StaffRole,
  staffCompanyId,
} from '@/lib/staff';
import { toast, toastError } from '@/lib/toast';

const SEARCH_DELAY = 400;

export default function StaffScreen() {
  const user = useCurrentUser();
  const router = useRouter();
  const viewerRole = user?.role;
  const isDirector = viewerRole === 'company';
  const companyId = staffCompanyId(user);

  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<StaffRole | null>(null);
  const [items, setItems] = useState<StaffMember[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Edit sheet: `null` closed, `''` create, an id to edit. */
  const [formFor, setFormFor] = useState<string | null>(null);
  const requestId = useRef(0);

  // Debounced search (the web applies it on a Search button press).
  useEffect(() => {
    const t = setTimeout(() => setSearch(input.trim()), SEARCH_DELAY);
    return () => clearTimeout(t);
  }, [input]);

  const load = useCallback(
    async (nextPage: number) => {
      if (!companyId) {
        setLoading(false);
        return;
      }
      const id = ++requestId.current;
      if (nextPage === 1) setLoading(true);
      else setLoadingMore(true);
      try {
        const res = await fetchStaff({ companyId, viewerRole, page: nextPage, searchTerm: search, role: roleFilter });
        if (id !== requestId.current) return;
        setItems((prev) => (nextPage === 1 ? res.items : [...prev, ...res.items.filter((m) => !prev.some((p) => p._id === m._id))]));
        setPage(nextPage);
        setTotalPages(res.totalPages);
      } catch (e) {
        if (id === requestId.current) toastError(e, 'Could not load staff');
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [companyId, viewerRole, search, roleFilter]
  );

  // Reload on focus (e.g. back from the associate page) and whenever the filters change.
  useFocusEffect(
    useCallback(() => {
      load(1);
    }, [load])
  );

  const patch = (id: string, change: Partial<StaffMember>) =>
    setItems((prev) => prev.map((m) => (m._id === id ? { ...m, ...change } : m)));

  const toggleActive = async (m: StaffMember) => {
    const active = !!m.isDeleted; // currently inactive → activate
    patch(m._id, { isDeleted: !active });
    try {
      await setStaffActive(m._id, active);
      toast.success(active ? 'User activated' : 'User deactivated');
    } catch (e) {
      patch(m._id, { isDeleted: m.isDeleted });
      toastError(e, 'Error updating status');
    }
  };

  const toggleAuthorized = async (m: StaffMember) => {
    const next = !isAuthorized(m);
    patch(m._id, { isValided: next, authorized: next });
    try {
      await setStaffAuthorized(m._id, next);
      toast.success(`Authorization ${next ? 'granted' : 'revoked'}`);
    } catch (e) {
      patch(m._id, { isValided: m.isValided, authorized: m.authorized });
      toastError(e, 'Authorization failed');
    }
  };

  return (
    <Page>
      <View className="flex-row items-center justify-between gap-3">
        <Text className="flex-1 text-2xl font-extrabold tracking-tight text-slate-900" numberOfLines={1} accessibilityRole="header">
          Staff Management
        </Text>
        <Pressable
          onPress={() => setFormFor('')}
          disabled={!companyId}
          accessibilityRole="button"
          accessibilityLabel="Create staff"
          style={{ height: 40 }}
          className={`flex-row items-center justify-center gap-1.5 rounded-full bg-primary px-4 active:opacity-90 ${
            companyId ? '' : 'opacity-50'
          }`}
        >
          <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={16} tintColor="#ffffff" />
          <Text className="text-sm font-bold text-white" numberOfLines={1}>
            Create Staff
          </Text>
        </Pressable>
      </View>

      <View className="gap-3">
        <SearchInput value={input} onChange={setInput} placeholder="Search staff" className="bg-white border border-slate-200" />
        {isDirector ? (
          <View className="flex-row gap-2">
            {[{ value: null, label: 'All' }, ...STAFF_ROLE_OPTIONS].map((opt) => {
              const selected = roleFilter === opt.value;
              return (
                <Pressable
                  key={opt.label}
                  onPress={() => setRoleFilter(opt.value as StaffRole | null)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  className={`rounded-full border px-4 py-2 ${selected ? 'border-primary bg-primary' : 'border-slate-200 bg-white'}`}
                >
                  <Text className={`text-[13px] font-semibold ${selected ? 'text-white' : 'text-slate-700'}`}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>

      {loading && items.length === 0 ? (
        <StaffSkeleton />
      ) : !companyId ? (
        <EmptyState
          icon={{ ios: 'building.2', android: 'business', web: 'business' }}
          tint="slate"
          title="No company found"
          description="Your account isn't linked to a company yet."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={{ ios: 'person.2', android: 'group', web: 'group' }}
          tint="purple"
          title="No users found"
          description={search ? 'Try a different search.' : 'Create your first staff member to get started.'}
        />
      ) : (
        <View className="gap-3">
          {items.map((m) => (
            <StaffCard
              key={m._id}
              member={m}
              // Web: only the director (or admin) can activate/deactivate.
              canToggleActive={isDirector}
              onToggleActive={() => toggleActive(m)}
              onToggleAuthorized={() => toggleAuthorized(m)}
              onAssociate={() => router.push(`/staff/${m._id}` as Href)}
              onEdit={() => setFormFor(m._id)}
            />
          ))}
          {page < totalPages ? (
            <Button title="Load more" variant="outline" loading={loadingMore} onPress={() => load(page + 1)} className="rounded-xl" />
          ) : null}
        </View>
      )}

      <StaffFormSheet
        visible={formFor !== null}
        staffId={formFor || null}
        viewerRole={viewerRole}
        companyId={companyId}
        onClose={() => setFormFor(null)}
        onSaved={() => load(1)}
      />
    </Page>
  );
}

function StaffCard({
  member,
  canToggleActive,
  onToggleActive,
  onToggleAuthorized,
  onAssociate,
  onEdit,
}: {
  member: StaffMember;
  canToggleActive: boolean;
  onToggleActive: () => void;
  onToggleAuthorized: () => void;
  onAssociate: () => void;
  onEdit: () => void;
}) {
  const active = !member.isDeleted;
  const authorized = isAuthorized(member);
  const manager = member.role === 'creator';

  return (
    <View className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <View className="flex-row items-center gap-3">
        <Avatar name={member.name} uri={resolveImageUrl(member.image)} size={44} />
        <View className="flex-1">
          <Text className="text-[15px] font-bold text-slate-900" numberOfLines={1}>
            {member.name}
          </Text>
          <Text className="text-[13px] text-slate-500" numberOfLines={1}>
            {member.email}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${manager ? 'bg-violet-50' : 'bg-blue-50'}`}>
          <Text className={`text-[11px] font-bold uppercase ${manager ? 'text-violet-700' : 'text-blue-700'}`}>
            {roleLabel(member.role)}
          </Text>
        </View>
      </View>

      <View className="flex-row gap-2">
        <ToggleChip label={active ? 'Active' : 'Inactive'} value={active} onChange={onToggleActive} disabled={!canToggleActive} />
        <ToggleChip label="Authorized" value={authorized} onChange={onToggleAuthorized} />
      </View>

      <View className="flex-row gap-2">
        <Pressable
          onPress={onAssociate}
          accessibilityRole="button"
          className="h-10 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary active:opacity-90"
        >
          <SymbolView name={{ ios: 'link', android: 'link', web: 'link' }} size={16} tintColor="#ffffff" />
          <Text className="text-[13px] font-bold text-white">Associate Staff</Text>
        </Pressable>
        <Pressable
          onPress={onEdit}
          accessibilityRole="button"
          className="h-10 flex-row items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 active:bg-slate-100"
        >
          <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor={Palette.text} />
          <Text className="text-[13px] font-bold text-slate-900">Edit</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleChip({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <View className={`flex-1 flex-row items-center justify-between rounded-xl bg-slate-50 px-3 py-1.5 ${disabled ? 'opacity-60' : ''}`}>
      <Text className="text-[13px] font-semibold text-slate-700">{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: Palette.primary, false: '#cbd5e1' }}
        thumbColor="#ffffff"
        accessibilityLabel={label}
      />
    </View>
  );
}

function StaffSkeleton() {
  return (
    <View className="gap-3" accessible accessibilityRole="progressbar" accessibilityLabel="Loading staff">
      {[0, 1, 2].map((i) => (
        <View key={i} className="gap-3 rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-center gap-3">
            <Skeleton width={44} height={44} radius={22} />
            <View className="flex-1 gap-2">
              <Skeleton width="55%" height={14} />
              <Skeleton width="75%" height={12} />
            </View>
          </View>
          <Skeleton width="100%" height={40} radius={12} />
        </View>
      ))}
    </View>
  );
}
