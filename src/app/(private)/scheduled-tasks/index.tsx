import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';

import { ScreenHeader } from '@/components/layout/screen-header';
import { TaskFormModal, type TaskFormValues } from '@/components/tasks/task-form-modal';
import { Button } from '@/components/ui/button';
import { DotLoader } from '@/components/ui/dot-loader';
import { EmptyState } from '@/components/ui/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/hooks/use-redux';
import { formatDisplayDate, ukMoment, ukStartOfToday } from '@/lib/date';
import {
  createScheduleTask,
  deleteScheduleTask,
  describeRecurrence,
  fetchScheduleTasks,
  SCHEDULE_PAGE_SIZE,
  type ScheduleTab,
  type ScheduleTask,
  sortScheduleTasks,
} from '@/lib/schedule-tasks';
import { refName } from '@/lib/tasks';
import { toast, toastError } from '@/lib/toast';

const TABS: { key: ScheduleTab; label: string }[] = [
  { key: 'personal', label: 'Personal' },
  { key: 'assignedTo', label: 'Assigned To Others' },
];

const EMPTY: Record<ScheduleTab, { title: string; description: string }> = {
  personal: { title: 'No personal schedules', description: 'Create a new schedule to get started.' },
  assignedTo: { title: 'No assigned schedules', description: 'Schedules you assign to others will appear here.' },
};

const PRIORITY: Record<string, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Medium' },
  low: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Low' },
};

const ICONS = {
  plus: { ios: 'plus', android: 'add', web: 'add' },
  repeat: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  due: { ios: 'calendar.badge.clock', android: 'event_available', web: 'event_available' },
  created: { ios: 'calendar.badge.plus', android: 'event', web: 'event' },
  person: { ios: 'person', android: 'person', web: 'person' },
  schedule: { ios: 'clock', android: 'schedule', web: 'schedule' },
} satisfies Record<string, SymbolViewProps['name']>;

/**
 * Schedule tasks (web CompanyScheduleTaskPage): recurring tasks in two tabs —
 * "Personal" (author = assignee = me) and "Assigned To Others" — 50 per page, priority first.
 * "New" creates a daily / weekly / monthly schedule for myself.
 */
export default function ScheduledTasksScreen() {
  const user = useAppSelector((state) => state.auth.user);
  const me: string | undefined = user?._id;

  const [tab, setTab] = useState<ScheduleTab>('personal');
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [selected, setSelected] = useState<ScheduleTask | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(
    (pageNum: number) =>
      me
        ? fetchScheduleTasks(tab, me, pageNum)
            .then((fetched) => {
              setHasMore(fetched.length >= SCHEDULE_PAGE_SIZE);
              setPage(pageNum);
              setTasks((prev) => {
                const merged = pageNum === 1 ? fetched : [...prev, ...fetched];
                return Array.from(new Map(merged.map((t) => [t._id, t])).values());
              });
            })
            .catch((e) => toastError(e, 'Could not load schedules'))
        : Promise.resolve(),
    [me, tab]
  );

  // Reload from page 1 whenever the tab changes (skeleton until it arrives).
  useEffect(() => {
    load(1).finally(() => setLoading(false));
  }, [load]);

  const switchTab = (next: ScheduleTab) => {
    if (next === tab) return;
    setLoading(true);
    setTasks([]);
    setTab(next);
  };

  const sorted = useMemo(() => sortScheduleTasks(tasks), [tasks]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  };

  const onCreate = async (values: TaskFormValues) => {
    if (!me || !values.dueDate) return;
    try {
      const created = await createScheduleTask({
        taskName: values.taskName,
        description: values.description || undefined,
        dueDate: values.dueDate.toISOString(),
        author: me,
        assigned: me,
        frequency: values.frequency,
        scheduledDate: values.frequency === 'weekly' || values.frequency === 'monthly' ? values.scheduledDate : null,
        priority: values.priority,
      });
      toast.success('Schedule task created');
      // New schedules are always for me, so they belong in the Personal tab.
      if (tab === 'personal') {
        setTasks((prev) => [{ ...created, assigned: { _id: me, name: user?.name } }, ...prev]);
      } else {
        switchTab('personal');
      }
    } catch (e) {
      toastError(e, 'Failed to create schedule task');
      throw e;
    }
  };

  const onDeleted = (id: string) => {
    setTasks((prev) => prev.filter((t) => t._id !== id));
    setSelected(null);
  };

  const renderItem = useCallback(
    ({ item }: { item: ScheduleTask }) => (
      <ScheduleTaskCard task={item} now={now} showAssignee={tab === 'assignedTo'} onPress={setSelected} />
    ),
    [now, tab]
  );

  return (
    <>
      <FlatList
        className="flex-1 bg-slate-50"
        contentContainerClassName="w-full max-w-3xl grow self-center gap-3 p-5 pb-10"
        data={loading ? [] : sorted}
        keyExtractor={(t) => t._id}
        renderItem={renderItem}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <View className="gap-4 pb-1">
            <ScreenHeader
              title="Schedule Task"
              fallbackHref="/home"
              right={
                <Pressable
                  onPress={() => setFormOpen(true)}
                  accessibilityRole="button"
                  accessibilityLabel="New schedule"
                  className="h-10 w-10 items-center justify-center rounded-full bg-primary active:opacity-80"
                >
                  <SymbolView name={ICONS.plus} size={20} tintColor="#ffffff" />
                </Pressable>
              }
            />

            <View className="flex-row rounded-2xl bg-primary p-1">
              {TABS.map((t) => {
                const on = t.key === tab;
                return (
                  <Pressable
                    key={t.key}
                    onPress={() => switchTab(t.key)}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: on }}
                    className={`h-10 flex-1 items-center justify-center rounded-xl ${on ? 'bg-white' : ''}`}
                  >
                    <Text className={`text-sm font-bold ${on ? 'text-primary' : 'text-white'}`} numberOfLines={1}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <ScheduleSkeleton />
          ) : (
            <View className="flex-1 justify-center">
              <EmptyState
                icon={ICONS.schedule}
                tint="green"
                title={EMPTY[tab].title}
                description={EMPTY[tab].description}
                action={
                  tab === 'personal' ? (
                    <Button title="New Schedule" onPress={() => setFormOpen(true)} className="rounded-xl px-5" />
                  ) : undefined
                }
              />
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <View className="py-4">
              <DotLoader size={8} label="Loading more schedules" />
            </View>
          ) : undefined
        }
      />

      <TaskFormModal
        visible={formOpen}
        mode="create"
        frequencies={['daily', 'weekly', 'monthly']}
        initial={{ frequency: 'daily', dueDate: ukStartOfToday() }}
        labels={{ title: 'Create New Schedule Task', submit: 'Create Schedule' }}
        onClose={() => setFormOpen(false)}
        onSubmit={onCreate}
      />

      <ScheduleDetailsSheet task={selected} onClose={() => setSelected(null)} onDeleted={onDeleted} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

type CardProps = {
  task: ScheduleTask;
  now: number;
  showAssignee: boolean;
  onPress: (task: ScheduleTask) => void;
};

const ScheduleTaskCard = memo(function ScheduleTaskCard({ task, now, showAssignee, onPress }: CardProps) {
  const priority = PRIORITY[task.priority?.toLowerCase() ?? ''];
  const overdue = task.status !== 'completed' && (ukMoment(task.dueDate)?.valueOf() ?? Infinity) < now;
  const assignee = refName(task.assigned);

  return (
    <Pressable
      onPress={() => onPress(task)}
      accessibilityRole="button"
      accessibilityLabel={`${task.taskName}, ${describeRecurrence(task)}`}
      className="gap-3 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm shadow-slate-900/5 active:scale-[0.98] active:opacity-90"
    >
      <View className="flex-row items-start gap-3">
        <View className="h-10 w-10 items-center justify-center rounded-xl bg-emerald-50">
          <SymbolView name={ICONS.repeat} size={20} tintColor="#059669" />
        </View>
        <View className="flex-1 gap-0.5">
          <Text className="text-[16px] font-bold leading-5 text-slate-900" numberOfLines={2}>
            {task.taskName}
          </Text>
          <Text className="text-[13px] font-medium text-emerald-700">{describeRecurrence(task)}</Text>
        </View>
        {priority ? (
          <View className={`rounded-full px-2.5 py-1 ${priority.bg}`}>
            <Text className={`text-xs font-bold ${priority.text}`}>{priority.label}</Text>
          </View>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-1.5">
        <Meta icon={ICONS.due} label="Next due" value={formatDisplayDate(task.dueDate)} danger={overdue} />
        <Meta icon={ICONS.created} label="Created" value={formatDisplayDate(task.createdAt)} />
        {showAssignee && assignee ? <Meta icon={ICONS.person} label="To" value={assignee} /> : null}
      </View>
    </Pressable>
  );
});

function Meta({ icon, label, value, danger }: { icon: SymbolViewProps['name']; label: string; value: string; danger?: boolean }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <SymbolView name={icon} size={14} tintColor={danger ? '#dc2626' : '#64748b'} />
      <Text className="text-[13px] text-slate-500">
        {label}: <Text className={`font-semibold ${danger ? 'text-red-600' : 'text-slate-900'}`}>{value}</Text>
      </Text>
    </View>
  );
}

function ScheduleSkeleton() {
  return (
    <View className="gap-3" accessible accessibilityRole="progressbar" accessibilityLabel="Loading schedules">
      {Array.from({ length: 4 }, (_, i) => (
        <View key={i} className="gap-3 rounded-2xl bg-white p-4">
          <View className="flex-row items-center gap-3">
            <Skeleton width={40} height={40} radius={12} />
            <View className="flex-1 gap-2">
              <Skeleton width="70%" height={16} />
              <Skeleton width="40%" height={12} />
            </View>
            <Skeleton width={52} height={24} radius={12} />
          </View>
          <View className="flex-row gap-4">
            <Skeleton width="38%" height={12} />
            <Skeleton width="38%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Details sheet                                                       */
/* ------------------------------------------------------------------ */

function ScheduleDetailsSheet({
  task,
  onClose,
  onDeleted,
}: {
  task: ScheduleTask | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const close = () => {
    if (deleting) return;
    setConfirming(false);
    onClose();
  };

  const remove = async () => {
    if (!task) return;
    setDeleting(true);
    try {
      await deleteScheduleTask(task._id);
      toast.success('Schedule deleted');
      setConfirming(false);
      onDeleted(task._id);
    } catch (e) {
      toastError(e, 'Failed to delete schedule');
    } finally {
      setDeleting(false);
    }
  };

  const priority = task ? PRIORITY[task.priority?.toLowerCase() ?? ''] : undefined;

  return (
    <Modal visible={!!task} transparent animationType="slide" onRequestClose={close}>
      <View className="flex-1 justify-end bg-black/50">
        <Pressable className="absolute inset-0" onPress={close} accessibilityLabel="Close" />
        {task ? (
          <View className="max-h-[85%] rounded-t-3xl bg-white">
            <View className="items-center pt-2.5">
              <View className="h-1 w-10 rounded-full bg-slate-300" />
            </View>
            <ScrollView contentContainerClassName="gap-4 p-5 pb-8">
              <View className="gap-1">
                <Text className="text-xl font-extrabold text-slate-900">{task.taskName}</Text>
                <Text className="text-sm font-semibold text-emerald-700">{describeRecurrence(task)}</Text>
              </View>

              {task.description ? (
                <Text className="text-[15px] leading-6 text-slate-700">{task.description}</Text>
              ) : null}

              <View className="gap-2.5 rounded-2xl bg-slate-50 p-4">
                <DetailRow label="Priority" value={priority?.label ?? '—'} />
                <DetailRow label="Next due" value={formatDisplayDate(task.dueDate)} />
                <DetailRow label="Created" value={formatDisplayDate(task.createdAt)} />
                <DetailRow label="Created by" value={refName(task.author) ?? '—'} />
                <DetailRow label="Assigned to" value={refName(task.assigned) ?? '—'} />
              </View>

              {confirming ? (
                <View className="gap-3 rounded-2xl border border-red-200 bg-red-50 p-4">
                  <Text className="text-sm font-semibold text-red-700">
                    Delete this schedule? It will stop repeating. This can&apos;t be undone.
                  </Text>
                  <View className="flex-row gap-3">
                    <Button title="Cancel" variant="dark" onPress={() => setConfirming(false)} disabled={deleting} className="flex-1 rounded-xl" />
                    <Button title="Delete" variant="destructive" onPress={remove} loading={deleting} className="flex-1 rounded-xl" />
                  </View>
                </View>
              ) : (
                <View className="flex-row gap-3">
                  <Button title="Close" variant="dark" onPress={close} className="flex-1 rounded-xl" />
                  <Button title="Delete" variant="destructive" onPress={() => setConfirming(true)} className="flex-1 rounded-xl" />
                </View>
              )}
            </ScrollView>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between gap-3">
      <Text className="text-sm text-slate-500">{label}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-slate-900" numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}
