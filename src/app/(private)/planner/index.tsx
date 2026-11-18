import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { Brand } from '@/constants/theme';
import { useAppSelector } from '@/hooks/use-redux';
import { ukMoment, ukNow } from '@/lib/date';
import { type Person, usePersonResolver } from '@/hooks/use-person';
import { fetchPlannerTasks, type Ref, refId, type Task } from '@/lib/tasks';
import { toastError } from '@/lib/toast';

const ONE_MINUTE = 60_000;
const DAY_KEY = 'YYYY-MM-DD';
/** Week starts Monday; the last two (Sat, Sun) are the weekend and shown in blue. */
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const CELL = { width: `${100 / 7}%` } as const;


type Icon = SymbolViewProps['name'];

const ICONS = {
  prev: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  next: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  repeat: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  to: { ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' },
  done: { ios: 'checkmark.circle', android: 'task_alt', web: 'task_alt' },
} satisfies Record<string, Icon>;

const PRIORITY: Record<string, { bar: string; chip: string; text: string; label: string }> = {
  high: { bar: 'bg-red-500', chip: 'bg-red-50', text: 'text-red-700', label: 'High' },
  medium: { bar: 'bg-amber-500', chip: 'bg-amber-50', text: 'text-amber-700', label: 'Medium' },
  low: { bar: 'bg-emerald-500', chip: 'bg-emerald-50', text: 'text-emerald-700', label: 'Low' },
};

/**
 * Monthly planner (web CompanyTaskPlanner): pending tasks assigned to me, by due date.
 * A month calendar with task dots, and the selected day's agenda.
 * Re-polls every minute like the web page.
 */
export default function PlannerScreen() {
  const router = useRouter();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  /** Name and photo for a task's author / assignee, even when the API only sent an id. */
  const person = usePersonResolver();

  const [month, setMonth] = useState(() => ukNow().startOf('month'));
  const [selected, setSelected] = useState(() => ukNow().format(DAY_KEY));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const year = month.year();
  const monthNumber = month.month() + 1;
  const todayKey = ukNow().format(DAY_KEY);
  const isCurrentMonth = month.isSame(ukNow(), 'month');

  const load = useCallback(
    (silent = false) =>
      me
        ? fetchPlannerTasks(year, monthNumber, me)
            .then(setTasks)
            .catch((e) => {
              if (!silent) toastError(e, 'Could not load the planner');
            })
        : Promise.resolve(),
    [me, year, monthNumber]
  );

  // Load on month change, then poll every minute.
  useEffect(() => {
    load().finally(() => setLoading(false));
    const id = setInterval(() => load(true), ONE_MINUTE);
    return () => clearInterval(id);
  }, [load]);

  // Refresh silently when returning from task details.
  const returning = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (returning.current) load(true);
      returning.current = true;
    }, [load])
  );

  const showMonth = (next: typeof month) => {
    setLoading(true);
    setTasks([]);
    setMonth(next);
  };

  const changeMonth = (delta: number) => {
    const next = month.clone().add(delta, 'month');
    showMonth(next);
    // Select today when it's in that month, otherwise the 1st.
    setSelected(next.isSame(ukNow(), 'month') ? todayKey : next.format(DAY_KEY));
  };

  const goToday = () => {
    if (!isCurrentMonth) showMonth(ukNow().startOf('month'));
    setSelected(todayKey);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // Tasks per day, most recently updated first (as on the web).
  const byDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const task of tasks) {
      const key = ukMoment(task.dueDate)?.format(DAY_KEY);
      if (!key) continue;
      (map[key] ??= []).push(task);
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
    }
    return map;
  }, [tasks]);

  // Calendar cells: blanks before the 1st (weeks start Monday), then each day of the month.
  const cells = useMemo(() => {
    const leading = (month.day() + 6) % 7;
    const days = Array.from({ length: month.daysInMonth() }, (_, i) => month.clone().date(i + 1));
    return [...Array<null>(leading).fill(null), ...days];
  }, [month]);

  const selectedTasks = byDay[selected] ?? [];
  const selectedDay = ukMoment(selected);
  const openTask = (task: Task) => router.push(`/planner/task/${task._id}` as Href);

  return (
    <ScrollView
      className="flex-1 bg-slate-50"
      contentContainerClassName="w-full max-w-3xl self-center gap-5 p-5 pb-10"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <ScreenHeader title="Planner" fallbackHref="/home" />

      {/* Calendar */}
      <View className="rounded-3xl border border-slate-200/80 bg-white px-3 pb-3 pt-4 shadow-sm shadow-slate-900/5">
        <View className="mb-4 flex-row items-center justify-between px-1">
          <View>
            <Text className="text-xl font-bold tracking-tight text-black">{month.format('MMMM')}</Text>
            <Text className="text-[13px] text-black">{month.format('YYYY')}</Text>
          </View>

          <View className="flex-row items-center gap-2">
            {!isCurrentMonth || selected !== todayKey ? (
              <Pressable
                onPress={goToday}
                accessibilityRole="button"
                accessibilityLabel="Go to today"
                className="h-9 justify-center rounded-full border border-slate-200 px-3.5 active:bg-slate-50"
              >
                <Text className="text-[13px] font-semibold text-black">Today</Text>
              </Pressable>
            ) : null}
            <View className="flex-row overflow-hidden rounded-full border border-slate-200">
              <MonthArrow icon={ICONS.prev} label="Previous month" onPress={() => changeMonth(-1)} />
              <View className="w-px bg-slate-200" />
              <MonthArrow icon={ICONS.next} label="Next month" onPress={() => changeMonth(1)} />
            </View>
          </View>
        </View>

        <View className="flex-row">
          {WEEKDAYS.map((d, i) => (
            <View key={i} style={CELL} className="items-center pb-2">
              <Text className={`text-xs font-semibold ${i >= 5 ? 'text-blue-600' : 'text-black'}`}>{d}</Text>
            </View>
          ))}
        </View>

        <View className="flex-row flex-wrap">
          {cells.map((day, i) => {
            if (!day) return <View key={`blank-${i}`} style={CELL} className="h-12" />;
            const key = day.format(DAY_KEY);
            const count = byDay[key]?.length ?? 0;
            const isSelected = key === selected;
            const isToday = key === todayKey;
            const isPast = key < todayKey;
            const isWeekend = day.day() === 0 || day.day() === 6;

            return (
              <Pressable
                key={key}
                style={CELL}
                onPress={() => setSelected(key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${day.format('D MMMM')}, ${count} ${count === 1 ? 'task' : 'tasks'}`}
                className="h-12 items-center justify-center"
              >
                <View
                  style={[
                    styles.dayCircle,
                    isSelected ? styles.daySelected : isToday ? styles.dayToday : null,
                  ]}
                >
                  <Text
                    className={`text-[15px] ${
                      isSelected
                        ? 'font-bold text-white'
                        : isToday
                          ? 'font-bold text-blue-700'
                          : isWeekend
                            ? 'font-medium text-blue-600'
                            : 'font-medium text-black'
                    }`}
                  >
                    {day.date()}
                  </Text>
                  {/* One dot when the day has any tasks; white on the selected (filled) day so it stays visible. */}
                  {!loading && count > 0 ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: isSelected ? '#ffffff' : isPast ? '#cbd5e1' : '#2563eb' },
                      ]}
                    />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Agenda */}
      <View className="gap-3">
        <View className="flex-row items-end justify-between">
          <View>
            <Text className="text-[13px] font-semibold uppercase tracking-wider text-black">
              {selected === todayKey ? 'Today' : selectedDay?.format('dddd')}
            </Text>
            <Text className="text-lg font-bold text-black">{selectedDay?.format('D MMMM YYYY')}</Text>
          </View>
          {!loading ? (
            <View className="rounded-full bg-slate-200/70 px-2.5 py-1">
              <Text className="text-xs font-semibold text-black">
                {selectedTasks.length} {selectedTasks.length === 1 ? 'task' : 'tasks'}
              </Text>
            </View>
          ) : null}
        </View>

        {loading ? (
          <AgendaSkeleton />
        ) : selectedTasks.length === 0 ? (
          <View className="items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10">
            <View className="h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <SymbolView name={ICONS.done} size={24} tintColor="#000000" />
            </View>
            <Text className="mt-1 text-[15px] font-semibold text-black">Nothing due</Text>
            <Text className="text-center text-[13px] text-black">You have no pending tasks on this day.</Text>
          </View>
        ) : (
          selectedTasks.map((task) => <AgendaCard key={task._id} task={task} me={me} person={person} onPress={openTask} />)
        )}
      </View>
    </ScrollView>
  );
}

function MonthArrow({ icon, label, onPress }: { icon: Icon; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-9 w-10 items-center justify-center active:bg-slate-50"
    >
      <SymbolView name={icon} size={15} tintColor="#000000" />
    </Pressable>
  );
}

/** Agenda row: priority bar, title, created by / assigned to, priority/repeat chips; important tasks get an amber background. */
function AgendaCard({
  task,
  me,
  person,
  onPress,
}: {
  task: Task;
  me?: string;
  person: (ref: Ref) => Person | undefined;
  onPress: (t: Task) => void;
}) {
  const important = !!me && (task.importantBy ?? []).includes(me);
  const priority = PRIORITY[task.priority?.toLowerCase() ?? ''];
  const author = person(task.author);
  // Self tasks: show the name once.
  const assignee = refId(task.assigned) === refId(task.author) ? undefined : person(task.assigned);
  const recurring = !!task.frequency && task.frequency !== 'once';

  return (
    <Pressable
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={task.taskName}
      className={`flex-row overflow-hidden rounded-2xl border shadow-sm shadow-slate-900/5 ${
        important ? 'border-amber-200 bg-amber-50 active:bg-amber-100' : 'border-slate-200/80 bg-white active:bg-slate-50'
      }`}
    >
      <View className={`w-1 ${priority?.bar ?? 'bg-slate-300'}`} />

      <View className="flex-1 gap-3 p-4">
        <Text className="text-[15px] font-semibold leading-5 text-black" numberOfLines={2}>
          {task.taskName}
        </Text>

        {/* One line: creator → assignee on the left, priority / repeat chips on the right. */}
        <View className="flex-row items-center gap-2">
          <View
            className="flex-1 flex-row items-center gap-1.5"
            accessible
            accessibilityLabel={[author && `Created by ${author.name}`, assignee && `assigned to ${assignee.name}`]
              .filter(Boolean)
              .join(', ')}
          >
            {author ? <PersonName person={author} /> : null}
            {author && assignee ? <SymbolView name={ICONS.to} size={11} tintColor="#64748b" /> : null}
            {assignee ? <PersonName person={assignee} /> : null}
          </View>
          {priority ? <Chip label={priority.label} className={priority.chip} textClassName={priority.text} /> : null}
          {recurring ? (
            <Chip icon={ICONS.repeat} label={capitalise(task.frequency!)} className="bg-indigo-50" textClassName="text-indigo-700" />
          ) : null}
        </View>
      </View>

      <View className="justify-center pr-3">
        <SymbolView name={ICONS.next} size={14} tintColor="#000000" />
      </View>
    </Pressable>
  );
}

/** Small avatar + name that shrinks (with "…") so the whole row stays on one line. */
function PersonName({ person }: { person: Person }) {
  return (
    <View className="flex-shrink flex-row items-center gap-1">
      <Avatar name={person.name} uri={person.image} size={18} />
      <Text className="flex-shrink text-xs font-semibold text-black" numberOfLines={1}>
        {person.name}
      </Text>
    </View>
  );
}

function Chip({ icon, label, className, textClassName }: { icon?: Icon; label: string; className: string; textClassName: string }) {
  return (
    <View className={`flex-row items-center gap-1 rounded-md px-2 py-0.5 ${className}`}>
      {icon ? <SymbolView name={icon} size={11} tintColor="#000000" /> : null}
      <Text className={`text-[11px] font-semibold ${textClassName}`}>{label}</Text>
    </View>
  );
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function AgendaSkeleton() {
  return (
    <View className="gap-3" accessible accessibilityRole="progressbar" accessibilityLabel="Loading tasks">
      {Array.from({ length: 3 }, (_, i) => (
        <View key={i} className="gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
          <Skeleton width="75%" height={15} />
          <View className="flex-row gap-2">
            <Skeleton width={90} height={18} />
            <Skeleton width={56} height={18} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Plain styles (no className) so the day marker is always a perfect circle. */
const styles = StyleSheet.create({
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: Brand.primary },
  /** Task marker inside the day circle, under the number. */
  dot: { position: 'absolute', bottom: 4, width: 5, height: 5, borderRadius: 2.5 },
  dayToday: { backgroundColor: '#eff6ff' },
});
