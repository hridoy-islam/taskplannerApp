import axiosInstance from './axios';
import type { Task, TaskFrequency, TaskPriority } from './tasks';

/** Recurring task from the web app's Schedule Task page (`/schedule-task`). */
export type ScheduleTask = Task & {
  frequency?: TaskFrequency | string;
  scheduledDate?: number | null;
  IsRecurring?: boolean;
  isRecurring?: boolean;
};

/** The two tabs on the web page. */
export type ScheduleTab = 'personal' | 'assignedTo';

export const SCHEDULE_PAGE_SIZE = 50;

/** Same endpoints as the web CompanyScheduleTaskPage (viewing my own company page, so id = me). */
export async function fetchScheduleTasks(tab: ScheduleTab, me: string, page = 1): Promise<ScheduleTask[]> {
  const paging = `page=${page}&limit=${SCHEDULE_PAGE_SIZE}&status=pending`;
  const url =
    tab === 'personal'
      ? `/schedule-task/personal-task/${me}?${paging}`
      : `/schedule-task/assignedScheduleTasks/${me}/${me}?${paging}`;
  const res = await axiosInstance.get(url);
  const data = res.data?.data;
  const list = Array.isArray(data) ? data : data?.result;
  return Array.isArray(list) ? list : [];
}

export type NewScheduleTask = {
  taskName: string;
  description?: string;
  dueDate: string;
  author: string;
  assigned: string;
  frequency: TaskFrequency;
  /** weekly: 0–6 (day index); monthly: 1–31 (day of month); daily: null. */
  scheduledDate: number | null;
  priority: TaskPriority;
};

export async function createScheduleTask(task: NewScheduleTask): Promise<ScheduleTask> {
  const res = await axiosInstance.post('/schedule-task', {
    ...task,
    isRecurring: true,
    status: 'pending',
  });
  return res.data?.data ?? res.data;
}

export async function deleteScheduleTask(id: string) {
  await axiosInstance.delete(`/schedule-task/${id}`);
}

const PRIORITY_WEIGHT: Record<string, number> = { high: 3, medium: 2, low: 1 };

/** Web ordering: highest priority first, then most recently updated. */
export function sortScheduleTasks(tasks: ScheduleTask[]) {
  return [...tasks].sort((a, b) => {
    const wa = PRIORITY_WEIGHT[a.priority?.toLowerCase() ?? ''] ?? 0;
    const wb = PRIORITY_WEIGHT[b.priority?.toLowerCase() ?? ''] ?? 0;
    if (wa !== wb) return wb - wa;
    return new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();
  });
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function ordinal(n: number) {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** "Every day", "Every Monday", "15th of every month". */
export function describeRecurrence(task: ScheduleTask) {
  const freq = String(task.frequency ?? '').toLowerCase();
  const day = task.scheduledDate;
  if (freq === 'daily') return 'Every day';
  if (freq === 'weekly') return typeof day === 'number' && WEEKDAYS[day] ? `Every ${WEEKDAYS[day]}` : 'Every week';
  if (freq === 'monthly') return typeof day === 'number' && day > 0 ? `${ordinal(day)} of every month` : 'Every month';
  return freq ? freq[0].toUpperCase() + freq.slice(1) : 'Once';
}
