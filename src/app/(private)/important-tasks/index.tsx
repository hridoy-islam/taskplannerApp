import { useCallback } from 'react';

import { TaskListView } from '@/components/tasks/task-list-view';
import { useAppSelector } from '@/hooks/use-redux';
import { fetchDashboardTasks, type Task } from '@/lib/tasks';

const ONE_MINUTE = 60_000;

/**
 * Important tasks (same rules as the web CompanyImportantPage):
 * pending tasks I've starred, newest update first. A task drops off the list as soon as
 * it's un-starred or completed by me; the list re-polls every minute.
 */
const isImportantToMe = (task: Task, me?: string) =>
  !!me && task.status === 'pending' && (task.importantBy ?? []).includes(me);

const byLatestUpdate = (a: Task, b: Task) =>
  new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime();

export default function ImportantTasksScreen() {
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);

  // The endpoint isn't paginated on the web, so load everything on page 1 and stop there.
  const fetchPage = useCallback(
    async (page: number) => {
      if (!me || page > 1) return [];
      const tasks = await fetchDashboardTasks('important', me, 1, 500);
      return [...tasks].sort(byLatestUpdate);
    },
    [me]
  );

  return (
    <TaskListView
      cacheKey="important"
      title="Important Task"
      fallbackHref="/home"
      taskHrefBase="/important-tasks/task"
      fetchPage={fetchPage}
      pageSize={Number.MAX_SAFE_INTEGER}
      actions="auto"
      filter={isImportantToMe}
      pollInterval={ONE_MINUTE}
      emptyTitle="No important tasks"
      emptyDescription="Tap the star on any task to keep it here."
    />
  );
}
