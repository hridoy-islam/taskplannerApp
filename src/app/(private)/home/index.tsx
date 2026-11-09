import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { type ReactNode, useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Page } from '@/components/layout/page';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { type TintName, Tints } from '@/constants/theme';
import { useCurrentUser } from '@/hooks/use-current-user';
import { formatDisplayDate, ukNow } from '@/lib/date';
import { countDashboardTasks, type DashboardCategory } from '@/lib/tasks';

type TaskStat = {
  key: DashboardCategory;
  label: string;
  caption: string;
  icon: SymbolViewProps['name'];
  tint: TintName;
};

const TODAY: TaskStat = {
  key: 'today',
  label: 'Today',
  caption: 'Tasks due today',
  icon: { ios: 'calendar', android: 'today', web: 'today' },
  tint: 'blue',
};

const TASK_STATS: TaskStat[] = [
  {
    key: 'overdue',
    label: 'Overdue',
    caption: 'Past due date',
    icon: { ios: 'exclamationmark.triangle', android: 'warning', web: 'warning' },
    tint: 'red',
  },
  {
    key: 'upcoming',
    label: 'Upcoming',
    caption: 'Coming up next',
    icon: { ios: 'calendar.badge.clock', android: 'event_upcoming', web: 'event_upcoming' },
    tint: 'purple',
  },
  {
    key: 'assigned',
    label: 'Assign To Others',
    caption: 'Delegated tasks',
    icon: { ios: 'person.2', android: 'assignment_ind', web: 'assignment_ind' },
    tint: 'green',
  },
  {
    key: 'finish',
    label: 'Need To Finish',
    caption: 'Still in progress',
    icon: { ios: 'checklist', android: 'pending_actions', web: 'pending_actions' },
    tint: 'amber',
  },
];

/** Only the categories shown on this screen are counted. */
const COUNTED: DashboardCategory[] = [TODAY.key, ...TASK_STATS.map((s) => s.key)];

type Count = { count: number; capped: boolean };
type Counts = Partial<Record<DashboardCategory, Count>>;

/**
 * Live task counts per card (same endpoints as the web CompanyDashboard), refreshed whenever Home gains focus.
 * All counts are applied together once every request has settled, so the numbers appear at the same time.
 * On a refresh the previous numbers stay visible until the new set is ready.
 */
function useDashboardCounts(userId?: string) {
  const [counts, setCounts] = useState<Counts>({});

  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      let active = true;
      Promise.allSettled(COUNTED.map((category) => countDashboardTasks(category, userId))).then((results) => {
        if (!active) return;
        setCounts((prev) => {
          const next: Counts = { ...prev };
          results.forEach((result, i) => {
            const category = COUNTED[i];
            if (result.status === 'fulfilled') next[category] = result.value;
            // A failed request shows 0 rather than loading forever (keeps the last value if there was one).
            else if (!next[category]) next[category] = { count: 0, capped: false };
          });
          return next;
        });
      });
      return () => {
        active = false;
      };
    }, [userId])
  );

  return counts;
}

function formatCount(value?: Count) {
  if (!value) return undefined;
  return value.capped ? `${value.count}+` : String(value.count);
}



export default function HomeScreen() {
  const user = useCurrentUser();
  const router = useRouter();
  const counts = useDashboardCounts(user?._id);
  const now = new Date();
  const todayLabel = formatDisplayDate(now);
  const overdue = counts.overdue?.count ?? 0;
  // Counts are applied together, so the first load is over once any of them is present.
  const loading = !counts[TODAY.key];
  const open = (stat: TaskStat) => router.push(`/home/tasks/${stat.key}` as Href);

  return (
    <Page>
      {/* Welcome card */}
      <View className="overflow-hidden rounded-3xl bg-primary p-6 shadow-lg shadow-slate-900/20">
        {/* Decorative circles */}
        <View className="absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/10" />
        <View className="absolute -bottom-20 right-16 h-36 w-36 rounded-full bg-white/5" />

        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1 gap-1">
            <Text className="text-[13px] font-medium text-white/90">Welcome back!👋</Text>
            <Text className="text-[26px] font-extrabold leading-8 tracking-tight text-white" numberOfLines={2}>
              {user?.name ?? 'there'}
            </Text>
          </View>
          <View className="rounded-full border-2 border-white/30">
            <Avatar name={user?.name} uri={user?.image} size={48} />
          </View>
        </View>

        <View className="mt-5 flex-row flex-wrap items-center gap-2">
          <View className="flex-row items-center rounded-full bg-white/15 px-3 py-1.5">
            <Text className="text-xs font-semibold text-white">{todayLabel}</Text>
          </View>
          {overdue > 0 ? (
            <View className="flex-row items-center rounded-full bg-red-500/90 px-3 py-1.5">
              <Text className="text-xs font-semibold text-white">
                {formatCount(counts.overdue)} overdue {overdue === 1 ? 'task' : 'tasks'}
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Overview */}
      <View className="gap-3">
        <Text className="text-[17px] font-bold tracking-tight text-slate-900">Task overview</Text>

        {loading ? (
          <OverviewSkeleton />
        ) : (
          <>
            <TodayCard stat={TODAY} count={formatCount(counts.today)} onPress={() => open(TODAY)} />

            <View className="flex-row flex-wrap gap-3">
              {TASK_STATS.map((stat) => (
                <StatCard key={stat.key} stat={stat} count={formatCount(counts[stat.key])} onPress={() => open(stat)} />
              ))}
            </View>
          </>
        )}
      </View>
    </Page>
  );
}

/** Whole-card placeholders shown until the first counts arrive; sized to match the real cards. */
function OverviewSkeleton() {
  return (
    <View className="gap-3" accessible accessibilityRole="progressbar" accessibilityLabel="Loading task overview">
      <View className="h-20 flex-row items-center gap-3 rounded-2xl bg-brand-soft px-4">
        <Skeleton width={48} height={48} radius={24} />
        <View className="flex-1 gap-2">
          <Skeleton width="45%" height={18} />
          <Skeleton width="70%" height={14} />
        </View>
        <Skeleton width={52} height={40} />
      </View>

      <View className="flex-row flex-wrap gap-3">
        {TASK_STATS.map((stat) => (
          <View key={stat.key} className="h-32 min-w-[45%] flex-1 justify-between rounded-2xl bg-brand-soft p-4">
            <View className="flex-row items-center justify-between">
              <Skeleton width={42} height={42} radius={21} />
              <Skeleton width={44} height={34} />
            </View>
            <View className="gap-2">
              <Skeleton width="75%" height={16} />
              <Skeleton width="55%" height={12} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

/** Solid coloured, pressable card surface with soft decorative circles; each stat has its own colour. */
function ColorCard({
  stat,
  count,
  onPress,
  className,
  lowerCirclePosition = '-right-2',
  children,
}: {
  stat: TaskStat;
  count?: string;
  onPress: () => void;
  className: string;
  /** Horizontal position class for the lower decorative circle. */
  lowerCirclePosition?: string;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className={`overflow-hidden rounded-2xl ${Tints[stat.tint].solid} shadow-md shadow-slate-900/15 active:scale-[0.98] active:opacity-90 ${className}`}
      accessibilityLabel={`${stat.label}: ${count}`}
    >
      <View className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/15" />
      <View className={`absolute -bottom-10 ${lowerCirclePosition} h-20 w-20 rounded-full bg-white/10`} />
      {children}
    </Pressable>
  );
}

/** White icon on a translucent white circle. */
function StatIcon({ stat, size }: { stat: TaskStat; size: number }) {
  return (
    <View className="items-center justify-center rounded-full bg-white/20" style={{ width: size, height: size }}>
      <SymbolView name={stat.icon} size={size * 0.48} tintColor="#ffffff" />
    </View>
  );
}

type CardProps = { stat: TaskStat; count?: string; onPress: () => void };

/** Wide featured card for today's tasks. */
function TodayCard({ stat, count, onPress }: CardProps) {
  return (
    <ColorCard
      stat={stat}
      count={count}
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3.5"
      lowerCirclePosition="right-1 mr-8 "
    >
      <StatIcon stat={stat} size={48} />
      <View className="flex-1">
        <Text className="text-xl font-bold leading-6 text-white">{stat.label}</Text>
        <Text className="text-[15px] leading-5 text-white/85">{stat.caption}</Text>
      </View>
      <Text className="text-5xl font-extrabold leading-[52px] tracking-tight text-white">{count}</Text>
    </ColorCard>
  );
}

function StatCard({ stat, count, onPress }: CardProps) {
  return (
    <ColorCard stat={stat} count={count} onPress={onPress} className="min-w-[45%] flex-1 gap-2.5 p-4">
      {/* Icon and number share the top row to avoid empty space */}
      <View className="flex-row items-center justify-between">
        <StatIcon stat={stat} size={42} />
        <Text className="text-[40px] font-extrabold leading-[44px] tracking-tight text-white">{count}</Text>
      </View>

      <View>
        <Text className="text-[17px] font-bold leading-[22px] text-white" numberOfLines={2}>
          {stat.label}
        </Text>
        <Text className="flex-shrink text-sm leading-5 text-white/85" numberOfLines={1}>
          {stat.caption}
        </Text>
      </View>
    </ColorCard>
  );
}
