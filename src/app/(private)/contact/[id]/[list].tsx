import { type Href, useLocalSearchParams } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { useCallback, useState } from 'react';
import { Pressable, Text } from 'react-native';

import { TaskFormModal, type TaskFormValues } from '@/components/tasks/task-form-modal';
import { TaskListView } from '@/components/tasks/task-list-view';
import { useColleague } from '@/hooks/use-colleague';
import { useAppSelector } from '@/hooks/use-redux';
import { createTask, fetchTaskList, isTaskListKind, PAGE_SIZE, taskListTitle } from '@/lib/tasks';
import { toast, toastError } from '@/lib/toast';

/** One of the task lists between me and a colleague (To / From / Need To Finish / Complete / Workload). */
export default function ColleagueTaskListScreen() {
  const { id, list } = useLocalSearchParams<{ id: string; list: string }>();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const colleague = useColleague(id);
  const kind = isTaskListKind(list) ? list : 'assignedTo';
  const isMe = id === me;
  const [createOpen, setCreateOpen] = useState(false);
  const [reloadList, setReloadList] = useState<(() => void) | null>(null);

  const fetchPage = useCallback(
    (page: number) => (me && id ? fetchTaskList(kind, me, id, page) : Promise.resolve([])),
    [kind, me, id]
  );

  // New tasks can be created from the lists of tasks I give (as on the web "To …" tab).
  const canCreate = kind === 'assignedTo' || kind === 'personal';

  const onCreate = async (values: TaskFormValues) => {
    if (!me || !id || !values.dueDate) return;
    try {
      await createTask({
        taskName: values.taskName,
        description: values.description,
        dueDate: values.dueDate.toISOString(),
        author: me,
        assigned: id,
        frequency: values.frequency,
        scheduledDate: values.frequency === 'weekly' || values.frequency === 'monthly' ? values.scheduledDate : null,
        priority: values.priority,
      });
      toast.success('Task created', isMe ? undefined : `Assigned to ${colleague?.name ?? 'your colleague'}`);
      reloadList?.();
    } catch (e) {
      toastError(e, 'Failed to create task');
      throw e;
    }
  };

  return (
    <>
      <TaskListView
        title={taskListTitle(kind, isMe ? 'Me' : (colleague?.name ?? 'Colleague'))}
        fallbackHref={`/contact/${id}` as Href}
        taskHrefBase="/contact/task"
        fetchPage={fetchPage}
        pageSize={PAGE_SIZE}
        completedList={kind === 'complete'}
        headerAction={
          canCreate
            ? (reload) => (
                <Pressable
                  onPress={() => {
                    setReloadList(() => reload);
                    setCreateOpen(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="New task"
                  className="h-10 flex-row items-center gap-1 rounded-xl bg-primary px-3 active:opacity-80"
                >
                  <SymbolView name={{ ios: 'plus', android: 'add', web: 'add' }} size={14} tintColor="#ffffff" />
                  <Text className="text-[13px] font-bold text-white">New Task</Text>
                </Pressable>
              )
            : undefined
        }
      />
      <TaskFormModal
        visible={createOpen}
        mode="create"
        subtitle={isMe ? 'Personal task' : `For ${colleague?.name ?? 'colleague'}`}
        onClose={() => setCreateOpen(false)}
        onSubmit={onCreate}
      />
    </>
  );
}
