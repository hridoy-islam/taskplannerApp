import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { getInitials } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { formatDisplayDate, ukMoment } from '@/lib/date';
import { isCompletedBy, refId, refName, type Task, type TaskActions } from '@/lib/tasks';

/* ------------------------------------------------------------------ */
/* Styling tables (static, so nothing is rebuilt per render)           */
/* ------------------------------------------------------------------ */

const BLACK = '#000000';

type ChipTone = { bg: string; text: string; icon: string };

const PRIORITY: Record<string, ChipTone & { label: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-700', icon: '#b91c1c', label: 'High' },
  medium: { bg: 'bg-amber-100', text: 'text-amber-800', icon: '#b45309', label: 'Medium' },
  low: { bg: 'bg-emerald-100', text: 'text-emerald-700', icon: '#047857', label: 'Low' },
};
const NO_PRIORITY: ChipTone = { bg: 'bg-sky-100', text: 'text-sky-800', icon: '#075985' };

const FREQUENCY: ChipTone = { bg: 'bg-indigo-100', text: 'text-indigo-700', icon: '#4338ca' };
const IMPORTANT_ON: ChipTone = { bg: 'bg-amber-500', text: 'text-white', icon: '#ffffff' };
// Not important: neutral outline so it doesn't read as already marked.
const IMPORTANT_OFF: ChipTone = { bg: 'border border-slate-300 bg-white', text: 'text-black', icon: '#000000' };

const ICONS = {
  created: { ios: 'calendar.badge.plus', android: 'event', web: 'event' },
  due: { ios: 'calendar.badge.clock', android: 'event_available', web: 'event_available' },
  frequency: { ios: 'repeat', android: 'repeat', web: 'repeat' },
  priority: { ios: 'flag.fill', android: 'flag', web: 'flag' },
  starOn: { ios: 'star.fill', android: 'star', web: 'star' },
  starOff: { ios: 'star', android: 'star_border', web: 'star_border' },
  mail: { ios: 'envelope', android: 'mail', web: 'mail' },
} satisfies Record<string, SymbolViewProps['name']>;


/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

type TaskCardProps = {
  task: Task;
  me?: string;
  /** Render-time clock, passed in so every card compares against the same moment. */
  now: number;
  /** Which action buttons to show (see TaskActions). */
  actions?: TaskActions;
  busy: boolean;
  onComplete: (task: Task) => void;
  onReassign: (task: Task) => void;
  onToggleImportant: (task: Task) => void;
  /** Opens the task details. */
  onOpen: (task: Task) => void;
};

function TaskCardBase({
  task,
  me,
  now,
  actions = 'auto',
  busy,
  onComplete,
  onReassign,
  onToggleImportant,
  onOpen,
}: TaskCardProps) {
  const authorId = refId(task.author);
  const assigneeId = refId(task.assigned);
  const isAuthor = me === authorId;
  const isAssigned = me === assigneeId;
  const isCompleted = task.status === 'completed';
  const isImportant = !!me && !!task.importantBy?.includes(me);
  const isUnseen = isAssigned && task.seen === false;
  const doneByAssignee = isCompletedBy(task, assigneeId);
  const unread = task.unreadMessageCount ?? 0;
  const priority = PRIORITY[task.priority?.toLowerCase() ?? ''];

  // No status badge; the due date is tinted red when overdue and amber when due today.
  // Compared by UK calendar day.
  const due = ukMoment(task.dueDate);
  const today = ukMoment(now)!.startOf('day');
  const isOverdue = !isCompleted && !!due && due.isBefore(today, 'day');
  const isDueToday = !isCompleted && !!due && due.isSame(today, 'day');

  // Same button rules as the web app's task lists.
  let showFinish = false;
  let showComplete = false;
  if (actions === 'complete') showComplete = isAssigned;
  else if (actions === 'finish') showFinish = doneByAssignee;
  else if (actions === 'auto') {
    showFinish = doneByAssignee && isAuthor;
    showComplete = isAssigned && !showFinish;
  }

  // The other person: "Assigned to" if I wrote it, otherwise "Assigned by" (yourself for personal tasks).
  const assignLabel = isAuthor && authorId !== assigneeId ? 'Assigned to' : 'Assigned by';
  const assignName =
    authorId === assigneeId
      ? 'You'
      : (isAuthor ? refName(task.assigned) : refName(task.author)) ?? '—';
  const important = isImportant ? IMPORTANT_ON : IMPORTANT_OFF;
  // The due date itself still turns red when overdue, amber when due today.
  const dueTone = isOverdue ? 'danger' : isDueToday ? 'warning' : 'default';

  return (
    <Pressable
      onPress={() => onOpen(task)}
      accessibilityRole="button"
      accessibilityHint="Opens task details"
      // Important tasks get a golden background; unseen ones a light blue one (important wins).
      className={`overflow-hidden rounded-2xl border shadow-md shadow-slate-900/10 ${
        isImportant ? 'border-amber-300 bg-amber-100' : isUnseen ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'
      }`}
      accessibilityLabel={isUnseen ? `New task: ${task.taskName}` : task.taskName}
    >

      <View className="gap-3 p-3.5">
        {/* Title */}
        <Text className="text-base font-bold leading-[21px] text-black" numberOfLines={2}>
          {task.taskName}
        </Text>

        {/* Info strip: Created | Due | Assigned by */}
        <View className={`flex-row rounded-xl border border-slate-200 ${isImportant || isUnseen ? 'bg-white' : 'bg-slate-50'}`}>
          <InfoCell icon={ICONS.created} label="Created" value={formatDisplayDate(task.createdAt)} />
          <View className="w-px bg-slate-200" />
          <InfoCell icon={ICONS.due} label="Due" value={formatDisplayDate(task.dueDate)} tone={dueTone} />
          <View className="w-px bg-slate-200" />
          <View className="flex-1 gap-1 px-2.5 py-2">
            <Text className="text-[10px] font-semibold uppercase tracking-wider text-black" numberOfLines={1}>
              {assignLabel}
            </Text>
            <View className="flex-row items-center gap-1.5">
              <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                <Text className="text-[8px] font-bold text-white">{getInitials(assignName)}</Text>
              </View>
              <Text className="flex-1 text-xs font-bold text-black" numberOfLines={1}>
                {assignName}
              </Text>
            </View>
          </View>
        </View>

        {/* Colourful full-width row: Frequency | Priority | Important | messages */}
        <View className="flex-row gap-2">
          <Chip tone={FREQUENCY} icon={ICONS.frequency} label={task.frequency || 'Once'} capitalize />
          <Chip
            tone={priority ?? NO_PRIORITY}
            icon={ICONS.priority}
            label={priority ? priority.label : 'No priority'}
          />
          <Pressable
            onPress={() => onToggleImportant(task)}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityState={{ selected: isImportant }}
            accessibilityLabel={isImportant ? 'Important, tap to unmark' : 'Mark as important'}
            className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2 active:opacity-80 ${important.bg}`}
          >
            <SymbolView name={isImportant ? ICONS.starOn : ICONS.starOff} size={13} tintColor={important.icon} />
            <Text className={`text-xs font-bold ${important.text}`} numberOfLines={1}>
              Important
            </Text>
          </Pressable>
          <View
            className="w-10 items-center justify-center rounded-lg bg-primary"
            accessibilityLabel={unread > 0 ? `${unread} unread ${unread === 1 ? 'message' : 'messages'}` : 'No unread messages'}
          >
            <SymbolView name={ICONS.mail} size={16} tintColor="#ffffff" />
            {unread > 0 ? (
              <View className="absolute -right-1.5 -top-1.5 h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-white bg-red-600 px-0.5">
                <Text className="text-[9px] font-bold text-white">{unread > 9 ? '9+' : unread}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {showFinish ? (
          <View className="flex-row gap-2">
            <Button title="Reassign" variant="warning" onPress={() => onReassign(task)} disabled={busy} className="flex-1 rounded-xl py-2.5" />
            <Button title="Finish" onPress={() => onComplete(task)} loading={busy} className="flex-1 rounded-xl py-2.5" />
          </View>
        ) : showComplete ? (
          <Button title="Complete Task" onPress={() => onComplete(task)} loading={busy} className="rounded-xl py-2.5" />
        ) : null}
      </View>
    </Pressable>
  );
}

/** One task in the Tasklist design. Memoised: re-renders only when its task, busy state or handlers change. */
export const TaskCard = memo(TaskCardBase);

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

const INFO_TONES = {
  default: { icon: BLACK, value: 'text-black' },
  warning: { icon: '#b45309', value: 'text-amber-700' },
  danger: { icon: '#b91c1c', value: 'text-red-700' },
};

function InfoCell({
  icon,
  label,
  value,
  tone = 'default',
}: {
  icon: SymbolViewProps['name'];
  label: string;
  value: string;
  tone?: keyof typeof INFO_TONES;
}) {
  const t = INFO_TONES[tone];
  return (
    <View className="flex-1 gap-1 px-2.5 py-2">
      <View className="flex-row items-center gap-1">
        <SymbolView name={icon} size={11} tintColor={t.icon} />
        <Text className="text-[10px] font-semibold uppercase tracking-wider text-black">{label}</Text>
      </View>
      <Text className={`text-xs font-bold ${t.value}`} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function Chip({
  tone,
  icon,
  label,
  capitalize,
}: {
  tone: ChipTone;
  icon: SymbolViewProps['name'];
  label: string;
  capitalize?: boolean;
}) {
  return (
    <View
      className={`flex-1 flex-row items-center justify-center gap-1 rounded-lg py-2 ${tone.bg}`}
      accessibilityLabel={label}
    >
      <SymbolView name={icon} size={13} tintColor={tone.icon} />
      <Text className={`text-xs font-bold ${tone.text} ${capitalize ? 'capitalize' : ''}`} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
