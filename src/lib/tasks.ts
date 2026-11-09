import axiosInstance from './axios';

type Ref = string | { _id: string; name?: string; image?: string } | null | undefined;

export type Task = {
  _id: string;
  taskName: string;
  description?: string;
  status: 'pending' | 'completed';
  dueDate?: string;
  createdAt?: string;
  updatedAt?: string;
  author: Ref;
  assigned: Ref;
  importantBy?: string[];
  completedBy?: { userId: Ref }[];
  seen?: boolean;
  priority?: string;
  frequency?: string;
  unreadMessageCount?: number;
};

export const refId = (ref: Ref) => (typeof ref === 'string' ? ref : ref?._id);
export const refName = (ref: Ref) => (typeof ref === 'string' ? undefined : ref?.name);

/** Which list of tasks between "me" and a colleague to show (mirrors the web app's tabs). */
/**
 * Which action buttons a task card shows:
 * - complete: "Complete Task" for the assignee (Today / Overdue / Upcoming)
 * - finish: "Reassign" + "Finish" once the assignee is done (Need To Finish)
 * - none: no actions (Assign To Others, completed lists)
 * - auto: finish for the author once the assignee is done, otherwise complete for the assignee
 */
export type TaskActions = 'auto' | 'complete' | 'finish' | 'none';

export type TaskListKind = 'assignedTo' | 'assignedBy' | 'personal' | 'needToFinish' | 'complete' | 'workload';

export const TASK_LIST_KINDS: TaskListKind[] = ['assignedTo', 'assignedBy', 'personal', 'needToFinish', 'complete', 'workload'];

export function isTaskListKind(value: unknown): value is TaskListKind {
  return typeof value === 'string' && (TASK_LIST_KINDS as string[]).includes(value);
}

export function taskListTitle(kind: TaskListKind, colleagueName = 'Colleague') {
  switch (kind) {
    case 'assignedTo':
      return `To ${colleagueName}`;
    case 'assignedBy':
      return `From ${colleagueName}`;
    case 'personal':
      return 'My Tasks';
    case 'needToFinish':
      return 'Need To Finish';
    case 'complete':
      return 'Complete';
    case 'workload':
      return 'Workload';
  }
}

export const PAGE_SIZE = 50;

/** Same endpoints as the web app's colleague task page. */
function listEndpoint(kind: TaskListKind, me: string, colleague: string, page: number) {
  const paging = `page=${page}&limit=${PAGE_SIZE}`;
  const personal = me === colleague;
  switch (kind) {
    case 'assignedTo':
    case 'personal':
      return `/task/getbothuser/${me}/${colleague}?${paging}&status=pending`;
    case 'assignedBy':
      return `/task/getbothuser/${colleague}/${me}?${paging}&status=pending`;
    case 'needToFinish':
      return personal
        ? `/task/needtofinish/${colleague}?${paging}`
        : `/task/needtofinish/${me}/${colleague}?${paging}`;
    case 'complete':
      return `/task/completetask/${me}/${colleague}?${paging}`;
    case 'workload':
      return `/task/alltasks/${colleague}?${paging}&status=pending`;
  }
}

export async function fetchTaskList(kind: TaskListKind, me: string, colleague: string, page = 1): Promise<Task[]> {
  const res = await axiosInstance.get(listEndpoint(kind, me, colleague, page));
  const result = res.data?.data?.result;
  return Array.isArray(result) ? result : [];
}

/** Every task involving the user; used for the unseen counts on the contact list. */
export async function fetchAllTasks(userId: string): Promise<Task[]> {
  const res = await axiosInstance.get(`/task/alltasks/${userId}`);
  const result = res.data?.data?.result;
  return Array.isArray(result) ? result : [];
}

export function isCompletedBy(task: Task, userId?: string) {
  if (!userId) return false;
  return (task.completedBy ?? []).some((c) => refId(c?.userId) === userId);
}

/** Unseen tasks a colleague has assigned to me, keyed by the colleague's id. */
export function countUnseenByAuthor(tasks: Task[], me: string) {
  const counts: Record<string, number> = {};
  for (const task of tasks) {
    const author = refId(task.author);
    if (!author || refId(task.assigned) !== me || task.seen !== false) continue;
    counts[author] = (counts[author] ?? 0) + 1;
  }
  return counts;
}

/** Marks a task finished by me (same rules as the web app's handleToggleTaskCompletion). */
export async function completeTask(task: Task, me: string) {
  const authorId = refId(task.author);
  const assignedId = refId(task.assigned);

  const completedBy =
    authorId === assignedId && me === authorId
      ? [{ userId: me }, { userId: me }]
      : [...(task.completedBy ?? []).filter((c) => refId(c?.userId) !== me), { userId: me }];

  await axiosInstance.patch(`/task/${task._id}`, {
    // Only the author closes the task; an assignee's completion waits for the author to finish it.
    status: me === authorId ? 'completed' : 'pending',
    completedBy,
  });
}

export async function setTaskImportant(task: Task, me: string, important: boolean) {
  const current = task.importantBy ?? [];
  const importantBy = important ? Array.from(new Set([...current, me])) : current.filter((id) => id !== me);
  await axiosInstance.patch(`/task/${task._id}`, { importantBy });
  return importantBy;
}

export async function reassignTask(taskId: string) {
  await axiosInstance.patch(`/task/reassign/${taskId}`);
}

/* ---------------------------------------------------------------------------
 * Dashboard categories (same endpoints as the web app's CompanyDashboard).
 * ------------------------------------------------------------------------- */

export type DashboardCategory = 'today' | 'overdue' | 'upcoming' | 'assigned' | 'finish' | 'important';

export const DASHBOARD_CATEGORIES: DashboardCategory[] = ['today', 'overdue', 'upcoming', 'assigned', 'finish', 'important'];

export const DASHBOARD_PAGE_SIZE = 20;

export function isDashboardCategory(value: unknown): value is DashboardCategory {
  return typeof value === 'string' && (DASHBOARD_CATEGORIES as string[]).includes(value);
}

export const DASHBOARD_TITLES: Record<DashboardCategory, string> = {
  today: 'Today Task',
  overdue: 'Overdue Task',
  upcoming: 'Upcoming Task',
  assigned: 'Assign To Others',
  finish: 'Need To Finish',
  important: 'Important',
};

/** Which action buttons each list shows (mirrors the web dashboard's list components). */
export const DASHBOARD_ACTIONS: Record<DashboardCategory, TaskActions> = {
  today: 'complete',
  overdue: 'complete',
  upcoming: 'complete',
  assigned: 'none',
  finish: 'finish',
  important: 'auto',
};

/** Empty-state copy from the web dashboard. */
export const DASHBOARD_EMPTY: Record<DashboardCategory, { title: string; description: string }> = {
  today: { title: 'No tasks for today', description: "You're all caught up!" },
  overdue: { title: 'No overdue tasks', description: 'Great job keeping up!' },
  upcoming: { title: 'No upcoming tasks', description: 'Your schedule looks clear.' },
  assigned: { title: 'No tasks assigned', description: "You haven't assigned tasks to others yet." },
  finish: { title: 'Nothing to review', description: 'No tasks are currently waiting for your final completion.' },
  important: { title: 'No important tasks', description: 'Star a task to see it here.' },
};

const DASHBOARD_ENDPOINTS: Record<DashboardCategory, string> = {
  today: '/task/today',
  overdue: '/task/duetasks',
  upcoming: '/task/upcommingtasks',
  assigned: '/task/assignedtasks',
  finish: '/task/needtofinish',
  important: '/task/important',
};

export async function fetchDashboardTasks(
  category: DashboardCategory,
  userId: string,
  page = 1,
  limit = DASHBOARD_PAGE_SIZE
): Promise<Task[]> {
  const res = await axiosInstance.get(`${DASHBOARD_ENDPOINTS[category]}/${userId}`, { params: { page, limit } });
  // "today"/"important" may return a plain array; the others return { result, meta }.
  const data = res.data?.data ?? res.data;
  const list = Array.isArray(data) ? data : data?.result;
  return Array.isArray(list) ? list : [];
}

/** Cap used when counting a category for the dashboard cards. */
export const DASHBOARD_COUNT_LIMIT = 100;

/** Active (not completed by me) tasks in a category, up to DASHBOARD_COUNT_LIMIT. */
export async function countDashboardTasks(category: DashboardCategory, userId: string) {
  const tasks = await fetchDashboardTasks(category, userId, 1, DASHBOARD_COUNT_LIMIT);
  return {
    count: tasks.filter((t) => !isCompletedBy(t, userId)).length,
    capped: tasks.length >= DASHBOARD_COUNT_LIMIT,
  };
}

/* ---------------------------------------------------------------------------
 * Single task, create/update (same endpoints as the web task pages).
 * ------------------------------------------------------------------------- */

export type TaskFrequency = 'once' | 'daily' | 'weekly' | 'monthly';
export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskDetail = Task & {
  scheduledDate?: number | null;
  history?: unknown[];
};

export async function fetchTask(taskId: string): Promise<TaskDetail> {
  const res = await axiosInstance.get(`/task/${taskId}`);
  return res.data?.data ?? res.data;
}

export async function updateTask(taskId: string, data: Record<string, unknown>): Promise<TaskDetail | undefined> {
  const res = await axiosInstance.patch(`/task/${taskId}`, data);
  return res.data?.data;
}

export type NewTask = {
  taskName: string;
  description?: string;
  dueDate: string;
  author: string;
  assigned: string;
  frequency: TaskFrequency;
  /** weekly: 0–6 (day index); monthly: 1–31 (day of month); otherwise null. */
  scheduledDate: number | null;
  priority: TaskPriority;
};

export async function createTask(task: NewTask): Promise<TaskDetail> {
  const res = await axiosInstance.post('/task', {
    ...task,
    isRecurring: task.frequency !== 'once',
    status: 'pending',
  });
  return res.data?.data ?? res.data;
}

/** Marks a task as seen by its assignee. */
export async function markTaskSeen(taskId: string) {
  await axiosInstance.patch(`/task/${taskId}`, { seen: true });
}

/* ---------------------------------------------------------------------------
 * Task chat (comments).
 * ------------------------------------------------------------------------- */

export type Comment = {
  _id: string;
  taskId: string;
  content: string;
  isFile?: boolean;
  authorId: Ref;
  createdAt?: string;
  /** Local-only: still being sent. */
  pending?: boolean;
};

export async function fetchComments(taskId: string): Promise<Comment[]> {
  const res = await axiosInstance.get(`/comment/${taskId}`);
  const data = res.data?.data;
  return Array.isArray(data) ? data : [];
}

export async function postComment(input: { taskId: string; authorId: string; content: string; isFile?: boolean }) {
  const res = await axiosInstance.post('/comment', input);
  return res.data?.data as Comment | undefined;
}

export async function markCommentsRead(taskId: string, userId: string, messageId: string) {
  await axiosInstance.post('/task/readcomment', { taskId, userId, messageId });
}

/** Uploads a file for a task chat and returns its URL. */
export async function uploadTaskFile(taskId: string, file: { uri: string; name: string; type: string }) {
  const formData = new FormData();
  formData.append('entityId', taskId);
  formData.append('file_type', 'taskDoc');
  formData.append('file', file as any);
  const res = await axiosInstance.post('/documents', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  return (res.data?.data?.fileUrl || res.data?.url) as string;
}

/** A chat file's URL and whether it's an image (content may be a URL or a JSON blob). */
export function parseFileComment(content: string): { url: string; isImage: boolean; name: string } {
  let url = content;
  let mime: string | undefined;
  const trimmed = content.trim();
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed);
      url = parsed.url || parsed.fileUrl || parsed.cdnUrl || content;
      mime = parsed.mimeType;
    } catch {
      // Not JSON; treat as a URL.
    }
  }
  const isImage = mime?.startsWith('image/') || /\.(png|jpe?g|gif|webp|heic|bmp)(\?|$)/i.test(url) || url.startsWith('data:image/');
  const name = decodeURIComponent(url.split('?')[0].split('/').pop() || 'File');
  return { url, isImage: !!isImage, name };
}
