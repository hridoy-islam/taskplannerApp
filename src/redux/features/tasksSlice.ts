import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { DashboardCategory, Task } from '@/lib/tasks';
import { logout } from './authSlice';

export type DashboardCount = { count: number; capped: boolean };

/** One cached, paginated task list. */
export type CachedTaskList = {
  tasks: Task[];
  page: number;
  hasMore: boolean;
};

/**
 * In-memory cache for the dashboard counts and the task lists, so revisiting a screen shows
 * the last data straight away while a fresh copy loads in the background.
 */
interface TasksState {
  counts: Partial<Record<DashboardCategory, DashboardCount>>;
  /** Keyed by a list's cache key, e.g. "dashboard:today" or "contact:<id>:assignedTo". */
  lists: Record<string, CachedTaskList>;
}

const initialState: TasksState = {
  counts: {},
  lists: {},
};

const tasksSlice = createSlice({
  name: 'tasks',
  initialState,
  reducers: {
    /** null marks a failed request: keep the last known count, or fall back to 0. */
    setDashboardCounts(
      state,
      action: PayloadAction<Partial<Record<DashboardCategory, DashboardCount | null>>>
    ) {
      for (const [category, value] of Object.entries(action.payload) as [DashboardCategory, DashboardCount | null][]) {
        if (value) state.counts[category] = value;
        else if (!state.counts[category]) state.counts[category] = { count: 0, capped: false };
      }
    },
    /** Stores a loaded page; page 1 replaces the list, later pages are appended (deduped by id). */
    setListPage(
      state,
      action: PayloadAction<{ key: string; page: number; tasks: Task[]; hasMore: boolean }>
    ) {
      const { key, page, tasks, hasMore } = action.payload;
      const merged = page === 1 ? tasks : [...(state.lists[key]?.tasks ?? []), ...tasks];
      state.lists[key] = {
        tasks: Array.from(new Map(merged.map((t) => [t._id, t])).values()),
        page,
        hasMore,
      };
    },
    removeTaskFromList(state, action: PayloadAction<{ key: string; taskId: string }>) {
      const list = state.lists[action.payload.key];
      if (list) list.tasks = list.tasks.filter((t) => t._id !== action.payload.taskId);
    },
    /** Patches a task wherever it appears in a cached list. */
    patchTask(state, action: PayloadAction<{ taskId: string; changes: Partial<Task> }>) {
      const { taskId, changes } = action.payload;
      for (const list of Object.values(state.lists)) {
        const task = list.tasks.find((t) => t._id === taskId);
        if (task) Object.assign(task, changes);
      }
    },
  },
  extraReducers: (builder) => {
    // Never show the previous account's tasks after logging out.
    builder.addCase(logout.fulfilled, () => initialState);
  },
});

export const { setDashboardCounts, setListPage, removeTaskFromList, patchTask } = tasksSlice.actions;

export default tasksSlice.reducer;
