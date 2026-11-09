import { type ReactNode, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { DateField } from '@/components/ui/date-field';
import { formatDisplayDate, INPUT_FORMAT_HINT, nextUkMonthDay, nextUkWeekday, ukStartOfToday } from '@/lib/date';
import type { TaskFrequency, TaskPriority } from '@/lib/tasks';

export type TaskFormValues = {
  taskName: string;
  description: string;
  priority: TaskPriority;
  frequency: TaskFrequency;
  dueDate: Date | null;
  /** weekly: 0–6, monthly: 1–31, otherwise null. */
  scheduledDate: number | null;
};

type TaskFormModalProps = {
  visible: boolean;
  mode: 'create' | 'edit';
  /** Shown under the title, e.g. "For Sarah Johnson". */
  subtitle?: string;
  initial?: Partial<TaskFormValues>;
  onClose: () => void;
  /** Should throw on failure so the form stays open. */
  onSubmit: (values: TaskFormValues) => Promise<void>;
};

const PRIORITIES: { value: TaskPriority; label: string; on: string; text: string }[] = [
  { value: 'low', label: 'Low', on: 'bg-emerald-600', text: 'text-emerald-700' },
  { value: 'medium', label: 'Medium', on: 'bg-amber-500', text: 'text-amber-800' },
  { value: 'high', label: 'High', on: 'bg-red-600', text: 'text-red-700' },
];

const FREQUENCIES: { value: TaskFrequency; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];


const EMPTY: TaskFormValues = {
  taskName: '',
  description: '',
  priority: 'low',
  frequency: 'once',
  dueDate: null,
  scheduledDate: null,
};

/** Create / edit task form (the Figma "Create New Task" sheet), with the web app's recurrence rules. */
export function TaskFormModal(props: TaskFormModalProps) {
  // Remount the form each time it opens so it starts from `initial`.
  if (!props.visible) return null;
  return <TaskFormContent {...props} />;
}

function TaskFormContent({ visible, mode, subtitle, initial, onClose, onSubmit }: TaskFormModalProps) {
  const [values, setValues] = useState<TaskFormValues>({ ...EMPTY, ...initial });
  const [errors, setErrors] = useState<{ taskName?: string; dueDate?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const setFrequency = (frequency: TaskFrequency) => {
    setErrors((e) => ({ ...e, dueDate: undefined }));
    setValues((v) => ({
      ...v,
      frequency,
      scheduledDate: null,
      // Daily tasks are due today; the others need a date/day picked.
      dueDate: frequency === 'daily' ? ukStartOfToday() : frequency === v.frequency ? v.dueDate : null,
    }));
  };

  const submit = async () => {
    const next: typeof errors = {};
    if (!values.taskName.trim()) next.taskName = 'Task title is required';
    if (!values.dueDate) {
      next.dueDate =
        values.frequency === 'weekly' ? 'Pick a day of the week' : values.frequency === 'monthly' ? 'Pick a day of the month' : 'Due date is required';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setSubmitting(true);
    try {
      await onSubmit({ ...values, taskName: values.taskName.trim(), description: values.description.trim() });
      onClose();
    } catch {
      // The caller shows the backend error toast; keep the form open to retry.
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={submitting ? undefined : onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} className="flex-1 justify-end bg-black/50">
        <Pressable className="absolute inset-0" onPress={submitting ? undefined : onClose} accessibilityLabel="Close" />

        <View className="max-h-[92%] rounded-t-3xl bg-white">
          <View className="items-center pt-2.5">
            <View className="h-1 w-10 rounded-full bg-slate-300" />
          </View>
          <ScrollView contentContainerClassName="gap-4 p-5 pb-8" keyboardShouldPersistTaps="handled">
            <View>
              <Text className="text-xl font-extrabold text-black">{mode === 'create' ? 'Create New Task' : 'Edit Task'}</Text>
              {subtitle ? <Text className="text-sm font-medium text-black">{subtitle}</Text> : null}
            </View>

            <Field label="Task title" error={errors.taskName}>
              <TextInput
                value={values.taskName}
                onChangeText={(t) => set('taskName', t)}
                placeholder="What needs to be done?"
                placeholderTextColor="#64748b"
                className={`h-12 rounded-xl border bg-white px-3 text-[15px] text-black ${errors.taskName ? 'border-red-500' : 'border-slate-300'}`}
                autoFocus={mode === 'create'}
                accessibilityLabel="Task title"
              />
            </Field>

            <Field label="Description (optional)">
              <TextInput
                value={values.description}
                onChangeText={(t) => set('description', t)}
                placeholder="Add details"
                placeholderTextColor="#64748b"
                multiline
                textAlignVertical="top"
                className="min-h-[88px] rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-[15px] text-black"
                accessibilityLabel="Description"
              />
            </Field>

            <Field label="Priority">
              <View className="flex-row gap-2">
                {PRIORITIES.map((p) => {
                  const on = values.priority === p.value;
                  return (
                    <Pressable
                      key={p.value}
                      onPress={() => set('priority', p.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      className={`h-11 flex-1 items-center justify-center rounded-xl border ${on ? `${p.on} border-transparent` : 'border-slate-300 bg-white'}`}
                    >
                      <Text className={`text-sm font-bold ${on ? 'text-white' : p.text}`}>{p.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            <Field label="Frequency">
              <View className="flex-row gap-2">
                {FREQUENCIES.map((f) => {
                  const on = values.frequency === f.value;
                  return (
                    <Pressable
                      key={f.value}
                      onPress={() => setFrequency(f.value)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: on }}
                      className={`h-11 flex-1 items-center justify-center rounded-xl border ${on ? 'border-transparent bg-indigo-600' : 'border-slate-300 bg-white'}`}
                    >
                      <Text className={`text-sm font-bold ${on ? 'text-white' : 'text-indigo-700'}`}>{f.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </Field>

            {values.frequency === 'once' ? (
              <Field label={`Due date ${INPUT_FORMAT_HINT}`}>
                <DateField value={values.dueDate} onChange={(d) => set('dueDate', d)} minimumDate={ukStartOfToday()} error={errors.dueDate} />
              </Field>
            ) : null}

            {values.frequency === 'daily' ? (
              <Text className="rounded-xl bg-indigo-50 p-3 text-sm font-medium text-black">Repeats every day. First due today.</Text>
            ) : null}

            {values.frequency === 'weekly' ? (
              <Field label="Repeat every" error={errors.dueDate}>
                <View className="flex-row gap-1.5">
                  {WEEKDAYS.map((label, index) => {
                    const on = values.scheduledDate === index;
                    return (
                      <Pressable
                        key={label}
                        onPress={() => {
                          setErrors((e) => ({ ...e, dueDate: undefined }));
                          setValues((v) => ({ ...v, scheduledDate: index, dueDate: nextUkWeekday(index) }));
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        className={`h-10 flex-1 items-center justify-center rounded-lg border ${on ? 'border-transparent bg-primary' : 'border-slate-300 bg-white'}`}
                      >
                        <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-black'}`}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            {values.frequency === 'monthly' ? (
              <Field label="Day of the month" error={errors.dueDate}>
                <View className="flex-row flex-wrap gap-1.5">
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => {
                    const on = values.scheduledDate === day;
                    return (
                      <Pressable
                        key={day}
                        onPress={() => {
                          setErrors((e) => ({ ...e, dueDate: undefined }));
                          setValues((v) => ({ ...v, scheduledDate: day, dueDate: nextUkMonthDay(day) }));
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: on }}
                        className={`h-9 w-[12.5%] items-center justify-center rounded-lg border ${on ? 'border-transparent bg-primary' : 'border-slate-300 bg-white'}`}
                      >
                        <Text className={`text-xs font-bold ${on ? 'text-white' : 'text-black'}`}>{day}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </Field>
            ) : null}

            {values.frequency !== 'once' && values.dueDate ? (
              <Text className="text-sm font-medium text-black">
                Next due:{' '}
                <Text className="font-bold">
                  {formatDisplayDate(values.dueDate)}
                </Text>
              </Text>
            ) : null}

            <View className="flex-row gap-3 pt-1">
              <Button title="Cancel" variant="dark" onPress={onClose} disabled={submitting} className="flex-1 rounded-xl" />
              <Button
                title={mode === 'create' ? 'Create Task' : 'Save Changes'}
                onPress={submit}
                loading={submitting}
                className="flex-1 rounded-xl"
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <View className="gap-1.5">
      <Text className="text-sm font-bold text-black">{label}</Text>
      {children}
      {error ? <Text className="text-xs font-medium text-red-600">{error}</Text> : null}
    </View>
  );
}
