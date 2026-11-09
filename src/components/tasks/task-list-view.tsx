import { type Href, useFocusEffect, useRouter } from "expo-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  type ListRenderItem,
  RefreshControl,
  Text,
  View,
} from "react-native";

import { ScreenHeader } from "@/components/layout/screen-header";
import { TaskCard } from "@/components/tasks/task-card";
import { DotLoader } from "@/components/ui/dot-loader";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppSelector } from "@/hooks/use-redux";
import {
  completeTask,
  isCompletedBy,
  reassignTask,
  refId,
  setTaskImportant,
  type Task,
  type TaskActions,
} from "@/lib/tasks";
import { getErrorMessage, toast, toastError } from "@/lib/toast";

type TaskListViewProps = {
  title: string;
  fallbackHref: Href;
  /** Loads one page of tasks. Change its identity to reload from page 1. */
  fetchPage: (page: number) => Promise<Task[]>;
  pageSize: number;
  /** Completed lists keep tasks I've completed and hide the action buttons. */
  completedList?: boolean;
  /** Action buttons on each card; defaults to none for completed lists, auto otherwise. */
  actions?: TaskActions;
  emptyTitle?: string;
  emptyDescription?: string;
  /** Small line under the title (e.g. today's date). */
  subtitle?: string;
  /** Route prefix for task details in this stack, e.g. "/home/task". */
  taskHrefBase: string;
  /** Extra header content (e.g. a "New Task" button); gets a reload callback. */
  headerAction?: (reload: () => void) => ReactNode;
};

const keyExtractor = (t: Task) => t._id;

/** Paginated, pull-to-refresh task list in the "Tasklist" design, with complete/finish/reassign/important actions. */
export function TaskListView({
  title,
  fallbackHref,
  fetchPage,
  pageSize,
  completedList = false,
  actions,
  emptyTitle = "No tasks here",
  emptyDescription = "Tasks in this list will appear here.",
  subtitle,
  taskHrefBase,
  headerAction,
}: TaskListViewProps) {
  const router = useRouter();
  const me: string | undefined = useAppSelector(
    (state) => state.auth.user?._id,
  );

  const [tasks, setTasks] = useState<Task[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const load = useCallback(
    (pageNum: number) =>
      fetchPage(pageNum)
        .then((fetched) => {
          setError(null);
          setHasMore(fetched.length >= pageSize);
          setPage(pageNum);
          setTasks((prev) => {
            const merged = pageNum === 1 ? fetched : [...prev, ...fetched];
            return Array.from(new Map(merged.map((t) => [t._id, t])).values());
          });
        })
        .catch((e: any) => {
          setError(getErrorMessage(e, "Could not load tasks."));
          toastError(e, "Could not load tasks");
        }),
    [fetchPage, pageSize],
  );

  useEffect(() => {
    load(1).finally(() => setLoading(false));
  }, [load]);

  // Refresh silently when coming back from task details (it may have been completed or edited there).
  const returning = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (returning.current) load(1);
      returning.current = true;
    }, [load]),
  );

  const reload = useCallback(() => {
    load(1);
  }, [load]);

  const onOpen = useCallback(
    (task: Task) => router.push(`${taskHrefBase}/${task._id}?unread=${task.unreadMessageCount ?? 0}` as Href),
    [router, taskHrefBase],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load(1);
    setRefreshing(false);
  };

  const onEndReached = async () => {
    if (!hasMore || loadingMore || loading) return;
    setLoadingMore(true);
    await load(page + 1);
    setLoadingMore(false);
  };

  // Handlers are stable (useCallback) so memoised cards only re-render when their own task changes.
  const onComplete = useCallback(
    async (task: Task) => {
      if (!me) return;
      setBusyId(task._id);
      try {
        await completeTask(task, me);
        setTasks((prev) => prev.filter((t) => t._id !== task._id));
        toast.success(
          refId(task.author) === me ? "Task finished" : "Task completed",
        );
      } catch (e) {
        toastError(e, "Failed to update the task");
      } finally {
        setBusyId(null);
      }
    },
    [me],
  );

  const onReassign = useCallback(async (task: Task) => {
    setBusyId(task._id);
    try {
      await reassignTask(task._id);
      const assignee = refId(task.assigned);
      setTasks((prev) =>
        prev.map((t) =>
          t._id === task._id
            ? {
                ...t,
                status: "pending",
                completedBy: (t.completedBy ?? []).filter(
                  (c) => refId(c?.userId) !== assignee,
                ),
              }
            : t,
        ),
      );
      toast.success("Task reassigned");
    } catch (e) {
      toastError(e, "Failed to reassign the task");
    } finally {
      setBusyId(null);
    }
  }, []);

  const onToggleImportant = useCallback(
    async (task: Task) => {
      if (!me) return;
      const important = !task.importantBy?.includes(me);
      const previous = task.importantBy;
      // Optimistic update, rolled back on failure.
      setTasks((prev) =>
        prev.map((t) =>
          t._id === task._id
            ? {
                ...t,
                importantBy: important
                  ? [...(t.importantBy ?? []), me]
                  : (t.importantBy ?? []).filter((x) => x !== me),
              }
            : t,
        ),
      );
      try {
        await setTaskImportant(task, me, important);
      } catch (e) {
        setTasks((prev) =>
          prev.map((t) =>
            t._id === task._id ? { ...t, importantBy: previous } : t,
          ),
        );
        toastError(e, "Failed to update importance");
      }
    },
    [me],
  );

  // Hide tasks I've already completed from the active lists (as the web app does).
  const visible = useMemo(
    () => (completedList ? tasks : tasks.filter((t) => !isCompletedBy(t, me))),
    [tasks, completedList, me],
  );

  const cardActions = actions ?? (completedList ? "none" : "auto");

  const renderItem = useCallback<ListRenderItem<Task>>(
    ({ item }) => (
      <TaskCard
        task={item}
        me={me}
        now={now}
        actions={cardActions}
        busy={busyId === item._id}
        onComplete={onComplete}
        onReassign={onReassign}
        onToggleImportant={onToggleImportant}
        onOpen={onOpen}
      />
    ),
    [
      me,
      now,
      cardActions,
      busyId,
      onComplete,
      onReassign,
      onToggleImportant,
      onOpen,
    ],
  );

  return (
    <FlatList
      className="flex-1 bg-slate-50"
      // grow lets the empty/loading state take the remaining height so it can be centred.
      contentContainerClassName="w-full max-w-3xl grow self-center gap-3 p-5 pb-10"
      data={loading ? [] : visible}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      onEndReached={onEndReached}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ListHeaderComponent={
        <View className="gap-3 pb-1">
          <ScreenHeader
            title={title}
            fallbackHref={fallbackHref}
            right={headerAction?.(reload)}
          />
          {subtitle ? (
            <Text className="text-center text-lg font-semibold -mt-4 text-slate-900">
              {subtitle}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <View className="flex-1 items-center justify-center">
            <DotLoader label="Loading tasks" />
          </View>
        ) : (
          <View className="flex-1 justify-center">
            <EmptyState
              icon={{ ios: "checklist", android: "task_alt", web: "task_alt" }}
              tint="blue"
              title={emptyTitle}
              description={error ? "Pull down to try again." : emptyDescription}
            />
          </View>
        )
      }
      ListFooterComponent={
        loadingMore ? (
          <View className="py-4">
            <DotLoader size={8} label="Loading more tasks" />
          </View>
        ) : null
      }
    />
  );
}
