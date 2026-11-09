import { useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { TaskListView } from '@/components/tasks/task-list-view';
import { useAppSelector } from '@/hooks/use-redux';
import { formatDisplayDate } from '@/lib/date';
import {
  DASHBOARD_ACTIONS,
  DASHBOARD_EMPTY,
  DASHBOARD_PAGE_SIZE,
  DASHBOARD_TITLES,
  fetchDashboardTasks,
  isDashboardCategory,
} from '@/lib/tasks';

/** Task list opened from a dashboard card (Today / Overdue / Upcoming / Assign To Others / Need To Finish). */
export default function DashboardTaskListScreen() {
  const { category: param } = useLocalSearchParams<{ category: string }>();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const category = isDashboardCategory(param) ? param : 'today';

  const fetchPage = useCallback(
    (page: number) => (me ? fetchDashboardTasks(category, me, page) : Promise.resolve([])),
    [category, me]
  );

  return (
    <TaskListView
      title={DASHBOARD_TITLES[category]}
      fallbackHref="/home"
      taskHrefBase="/home/task"
      fetchPage={fetchPage}
      pageSize={DASHBOARD_PAGE_SIZE}
      actions={DASHBOARD_ACTIONS[category]}
      emptyTitle={DASHBOARD_EMPTY[category].title}
      emptyDescription={DASHBOARD_EMPTY[category].description}
      subtitle={
        category === 'today'
          ? formatDisplayDate(new Date())
          : undefined
      }
    />
  );
}
