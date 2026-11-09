import { type Href, useFocusEffect, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/layout/screen-header';
import { TaskFormModal, type TaskFormValues } from '@/components/tasks/task-form-modal';
import { getInitials } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DotLoader } from '@/components/ui/dot-loader';
import { EmptyState } from '@/components/ui/empty-state';
import { useAppSelector } from '@/hooks/use-redux';
import { formatDisplayDate, isSameUkDay } from '@/lib/date';
import {
  fetchTask,
  isCompletedBy,
  markTaskSeen,
  reassignTask,
  refId,
  refName,
  type TaskDetail,
  updateTask,
} from '@/lib/tasks';
import { connectSocket } from '@/lib/socket';
import { toast, toastError } from '@/lib/toast';


const PRIORITY_TONE: Record<string, string> = {
  high: 'text-red-700',
  medium: 'text-amber-700',
  low: 'text-emerald-700',
};

const ICONS = {
  edit: { ios: 'square.and.pencil', android: 'edit', web: 'edit' },
  message: { ios: 'bubble.left.and.bubble.right', android: 'forum', web: 'forum' },
  starOn: { ios: 'star.fill', android: 'star', web: 'star' },
  starOff: { ios: 'star', android: 'star_border', web: 'star_border' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
} satisfies Record<string, SymbolViewProps['name']>;

/** Task Details (Figma "Task Details" frame) with the web app's edit / complete / finish / reassign / important rules. */
export default function TaskDetailsScreen() {
  const { taskId, unread: unreadParam } = useLocalSearchParams<{ taskId: string; unread?: string }>();
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const user = useAppSelector((state) => state.auth.user) as { _id: string; name?: string } | null;
  const me = user?._id;

  // Unread chat messages: the count from the list (or the task), plus any that arrive while this
  // screen is open. Opening the chat marks them read, so it resets to 0.
  const [chatOpened, setChatOpened] = useState(false);
  const [liveUnread, setLiveUnread] = useState(0);

  useEffect(() => {
    if (!user?._id) return;
    const socket = connectSocket(user);
    const join = () => socket.emit('join chat', taskId);
    socket.on('connected', join);
    socket.on('connect', join);
    socket.on('message received', (payload: any) => {
      const data = payload?.data ?? payload;
      const author = typeof data?.authorId === 'object' ? data.authorId?._id : data?.authorId;
      if (data?.taskId === taskId && author && author !== user._id) setLiveUnread((n) => n + 1);
    });
    return () => {
      socket.disconnect();
    };
  }, [user, taskId]);

  const [task, setTask] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busy, setBusy] = useState<'complete' | 'finish' | 'reassign' | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const seenMarked = useRef(false);

  const load = useCallback(
    () =>
      fetchTask(taskId)
        .then(setTask)
        .catch((e) => toastError(e, 'Failed to load task')),
    [taskId]
  );

  // Reload whenever the screen gains focus (e.g. coming back from the chat).
  useFocusEffect(
    useCallback(() => {
      load().finally(() => setLoading(false));
    }, [load])
  );

  // Mark as seen once when the assignee opens it (as the web app does).
  const assigneeId = refId(task?.assigned);
  useEffect(() => {
    if (!task || seenMarked.current || task.seen !== false || me !== assigneeId) return;
    seenMarked.current = true;
    markTaskSeen(task._id).catch(() => {
      seenMarked.current = false;
    });
  }, [task, me, assigneeId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  /** PATCH with optimistic update; reverts and shows the backend error on failure. */
  const applyUpdate = async (data: Partial<TaskDetail>, successTitle: string) => {
    if (!task) return;
    const previous = task;
    setTask({ ...task, ...data });
    try {
      const updated = await updateTask(task._id, data as Record<string, unknown>);
      if (updated) setTask((t) => (t ? { ...t, ...updated, author: t.author, assigned: t.assigned } : t));
      toast.success(successTitle);
    } catch (e) {
      setTask(previous);
      toastError(e, 'Failed to update task');
      throw e;
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-slate-50">
        <DotLoader label="Loading task" />
      </View>
    );
  }

  if (!task) {
    return (
      <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="gap-4 p-5">
        <ScreenHeader title="Task Details" fallbackHref="/home" />
        <EmptyState icon={ICONS.info} tint="red" title="Task not found" description="It may have been deleted." />
      </ScrollView>
    );
  }

  const authorId = refId(task.author);
  const isAuthor = me === authorId;
  const isImportant = !!me && !!task.importantBy?.includes(me);
  const isCompletedByMe = isCompletedBy(task, me);
  const hasAnyCompletion = (task.completedBy?.length ?? 0) > 0;
  const isSelfTask = authorId === assigneeId;
  const baseUnread = chatOpened ? 0 : Math.max(Number(unreadParam) || 0, task.unreadMessageCount ?? 0);
  const unread = baseUnread + liveUnread;
  const priority = task.priority?.toLowerCase();

  const toggleImportant = () => {
    if (!me) return;
    const importantBy = isImportant ? (task.importantBy ?? []).filter((id) => id !== me) : [...(task.importantBy ?? []), me];
    applyUpdate({ importantBy }, isImportant ? 'Removed from important' : 'Marked as important').catch(() => {});
  };

  // Assignee: add my completion; the author then finishes it (web handleComplete).
  const complete = async () => {
    if (!me) return;
    setBusy('complete');
    const completedBy = isSelfTask ? [{ userId: me }, { userId: me }] : [...(task.completedBy ?? []), { userId: me }];
    await applyUpdate({ completedBy }, 'Task completed').catch(() => {});
    setBusy(null);
  };

  // Author: close the task (web handleFinishTask).
  const finish = async () => {
    if (!me) return;
    setBusy('finish');
    const completedBy = isSelfTask
      ? [{ userId: me }, { userId: me }]
      : [...(task.completedBy ?? []).filter((c) => refId(c?.userId) !== me), { userId: me }];
    await applyUpdate({ status: 'completed', completedBy }, 'Task finished').catch(() => {});
    setBusy(null);
  };

  const reassign = async () => {
    setBusy('reassign');
    try {
      await reassignTask(task._id);
      toast.success('Task reassigned');
      await load();
    } catch (e) {
      toastError(e, 'Failed to reassign task');
    } finally {
      setBusy(null);
    }
  };

  const saveEdit = async (values: TaskFormValues) => {
    const updates: Record<string, unknown> = {};
    if (values.taskName !== task.taskName) updates.taskName = values.taskName;
    if (values.description !== (task.description ?? '')) updates.description = values.description;
    if (values.priority !== (task.priority ?? 'medium')) updates.priority = values.priority;
    if (values.frequency !== (task.frequency ?? 'once')) {
      updates.frequency = values.frequency;
      updates.isRecurring = values.frequency !== 'once';
    }
    if (values.scheduledDate !== (task.scheduledDate ?? null)) updates.scheduledDate = values.scheduledDate;
    const due = values.dueDate?.toISOString();
    if (due && !isSameUkDay(task.dueDate, values.dueDate)) updates.dueDate = due;

    if (!Object.keys(updates).length) {
      toast.info('No changes to save');
      return;
    }
    await applyUpdate(updates as Partial<TaskDetail>, 'Task updated');
  };

  return (
    <View className="flex-1 bg-slate-50">
      <ScrollView
        contentContainerClassName="w-full max-w-3xl self-center gap-4 p-5"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <ScreenHeader title="Task Details" fallbackHref="/home" />

        {/* Action bar */}
        <View className="flex-row gap-2">
          {isAuthor ? (
            <ActionButton icon={ICONS.edit} label="Edit" className="bg-black" onPress={() => setEditOpen(true)} />
          ) : null}
          <ActionButton
            icon={ICONS.message}
            label="Message"
            className="bg-primary"
            badge={unread}
            onPress={() => {
              setChatOpened(true);
              setLiveUnread(0);
              router.push(`${pathname.replace(/\/$/, '')}/chat` as Href);
            }}
          />
          <Pressable
            onPress={toggleImportant}
            accessibilityRole="button"
            accessibilityState={{ selected: isImportant }}
            accessibilityLabel={isImportant ? 'Important, tap to unmark' : 'Mark as important'}
            className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-80 ${
              isImportant ? 'bg-amber-500' : 'border border-slate-300 bg-white'
            }`}
          >
            <SymbolView name={isImportant ? ICONS.starOn : ICONS.starOff} size={15} tintColor={isImportant ? '#ffffff' : '#000000'} />
            <Text className={`text-[13px] font-bold ${isImportant ? 'text-white' : 'text-black'}`}>Important</Text>
          </Pressable>
        </View>

        {/* Title + description */}
        <View
          className={`gap-2 rounded-2xl border p-4 shadow-sm shadow-slate-900/5 ${
            isImportant ? 'border-amber-300 bg-amber-100' : 'border-slate-200 bg-white'
          }`}
        >
          <Text className="text-xl font-extrabold leading-7 text-black">{task.taskName}</Text>
          {task.status === 'completed' ? (
            <View className="self-start rounded-md bg-emerald-600 px-2 py-0.5">
              <Text className="text-[11px] font-bold uppercase tracking-wider text-white">Completed</Text>
            </View>
          ) : null}
        </View>

        {/* Info grid */}
        <View className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <View className="flex-row">
            <InfoCell label="Created Date" value={formatDisplayDate(task.createdAt)} />
            <Divider />
            <InfoCell label="Due Date" value={formatDisplayDate(task.dueDate)} />
            <Divider />
            <InfoCell
              label="Priority"
              value={priority ? priority[0].toUpperCase() + priority.slice(1) : '—'}
              valueClassName={priority ? PRIORITY_TONE[priority] : undefined}
            />
          </View>
          <View className="h-px bg-slate-200" />
          <View className="flex-row">
            <PersonCell label="Created By" name={refName(task.author)} />
            <Divider />
            <PersonCell label="Assigned To" name={refName(task.assigned)} />
            <Divider />
            <InfoCell label="Frequency" value={task.frequency ? task.frequency[0].toUpperCase() + task.frequency.slice(1) : 'Once'} />
          </View>
        </View>

        {/* Details */}
        <View className="gap-2 rounded-2xl border border-slate-200 bg-white p-4">
          <View className="flex-row items-center gap-1.5">
            <SymbolView name={ICONS.info} size={16} tintColor="#000000" />
            <Text className="text-[15px] font-bold text-black">Task Details</Text>
          </View>
          <Text className="text-[15px] leading-[22px] text-black">{task.description?.trim() || 'No description added.'}</Text>
        </View>

        {/* Primary actions (web rules) */}
        {task.status !== 'completed' ? (
          <View className="gap-2">
            {!isAuthor ? (
              isCompletedByMe ? (
                <DoneNote text="You've completed this task. Waiting for the author to finish it." />
              ) : (
                <Button title="Complete Task" onPress={complete} loading={busy === 'complete'} className="rounded-xl" />
              )
            ) : (
              <View className="flex-row gap-2">
                {hasAnyCompletion && !isSelfTask ? (
                  <Button
                    title="Reassign"
                    variant="warning"
                    onPress={reassign}
                    loading={busy === 'reassign'}
                    disabled={!!busy}
                    className="flex-1 rounded-xl"
                  />
                ) : null}
                {!isCompletedByMe ? (
                  <Button title="Finish" onPress={finish} loading={busy === 'finish'} disabled={!!busy} className="flex-1 rounded-xl" />
                ) : null}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>

      <TaskFormModal
        visible={editOpen}
        mode="edit"
        initial={{
          taskName: task.taskName,
          description: task.description ?? '',
          priority: (priority as TaskFormValues['priority']) || 'medium',
          frequency: (task.frequency as TaskFormValues['frequency']) || 'once',
          dueDate: task.dueDate ? new Date(task.dueDate) : null,
          scheduledDate: task.scheduledDate ?? null,
        }}
        onClose={() => setEditOpen(false)}
        onSubmit={saveEdit}
      />
    </View>
  );
}

function ActionButton({
  icon,
  label,
  className,
  badge = 0,
  onPress,
}: {
  icon: SymbolViewProps['name'];
  label: string;
  className: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge} unread` : label}
      className={`h-11 flex-1 flex-row items-center justify-center gap-1.5 rounded-xl active:opacity-80 ${className}`}
    >
      <SymbolView name={icon} size={15} tintColor="#ffffff" />
      <Text className="text-[13px] font-bold text-white">{label}</Text>
      {badge > 0 ? (
        <View className="absolute -right-1 -top-1.5 h-5 min-w-5 items-center justify-center rounded-full border-2 border-slate-50 bg-red-600 px-1">
          <Text className="text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function Divider() {
  return <View className="w-px bg-slate-200" />;
}

function InfoCell({ label, value, valueClassName = 'text-black' }: { label: string; value: string; valueClassName?: string }) {
  return (
    <View className="flex-1 gap-1 p-3">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-black">{label}</Text>
      <Text className={`text-sm font-bold ${valueClassName}`} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function PersonCell({ label, name }: { label: string; name?: string }) {
  return (
    <View className="flex-1 gap-1 p-3">
      <Text className="text-[11px] font-semibold uppercase tracking-wider text-black">{label}</Text>
      <View className="flex-row items-center gap-1.5">
        <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Text className="text-[8px] font-bold text-white">{getInitials(name)}</Text>
        </View>
        <Text className="flex-1 text-sm font-bold text-black" numberOfLines={1}>
          {name ?? '—'}
        </Text>
      </View>
    </View>
  );
}

function DoneNote({ text }: { text: string }) {
  return (
    <View className="flex-row items-center gap-2 rounded-xl bg-emerald-50 p-3">
      <SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' }} size={18} tintColor="#047857" />
      <Text className="flex-1 text-sm font-semibold text-black">{text}</Text>
    </View>
  );
}
