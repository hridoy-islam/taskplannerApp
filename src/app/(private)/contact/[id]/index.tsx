import { useLocalSearchParams, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { Page } from '@/components/layout/page';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { type TintName, Tints } from '@/constants/theme';
import { useColleague } from '@/hooks/use-colleague';
import { useAppSelector } from '@/hooks/use-redux';
import { resolveImageUrl } from '@/lib/image-url';
import { type TaskListKind, taskListTitle } from '@/lib/tasks';

type Option = {
  kind: TaskListKind;
  icon: SymbolViewProps['name'];
  tint: TintName;
  /** Short explanation under the title; gets the colleague's name. */
  describe: (name: string) => string;
};

const COLLEAGUE_OPTIONS: Option[] = [
  {
    kind: 'assignedTo',
    icon: { ios: 'paperplane.fill', android: 'send', web: 'send' },
    tint: 'blue',
    describe: (name) => `Tasks you've assigned to ${name}`,
  },
  {
    kind: 'assignedBy',
    icon: { ios: 'tray.and.arrow.down.fill', android: 'move_to_inbox', web: 'move_to_inbox' },
    tint: 'purple',
    describe: (name) => `Tasks ${name} has assigned to you`,
  },
  {
    kind: 'needToFinish',
    icon: { ios: 'list.clipboard.fill', android: 'assignment', web: 'assignment' },
    tint: 'amber',
    describe: () => 'Done by the assignee, waiting for you to finish',
  },
  {
    kind: 'complete',
    icon: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
    tint: 'green',
    describe: () => 'Tasks that have been completed',
  },
  {
    kind: 'workload',
    icon: { ios: 'briefcase.fill', android: 'work', web: 'work' },
    tint: 'pink',
    describe: (name) => `Everything currently on ${name}'s plate`,
  },
];

// When opening yourself, "To"/"From" collapse into one list of your own tasks (as on the web).
const PERSONAL_OPTIONS: Option[] = [
  {
    kind: 'personal',
    icon: { ios: 'person.fill', android: 'person', web: 'person' },
    tint: 'blue',
    describe: () => "Tasks you've created for yourself",
  },
  ...COLLEAGUE_OPTIONS.slice(2).map((o) =>
    o.kind === 'workload' ? { ...o, describe: () => 'All of your pending tasks' } : o
  ),
];

const CHEVRON = { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' } as const;

export default function ColleagueTaskOptionsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const colleague = useColleague(id);

  const isMe = !!id && id === me;
  const name = isMe ? 'Me' : (colleague?.name ?? 'Colleague');
  const firstName = colleague?.name?.split(' ')[0] ?? 'them';
  const options = isMe ? PERSONAL_OPTIONS : COLLEAGUE_OPTIONS;

  return (
    <Page>
      <ScreenHeader title={isMe ? 'My Tasks' : 'Contact'} fallbackHref="/contact" />

      {/* Profile */}
      <View className="items-center gap-3 rounded-3xl border border-slate-200 bg-white px-5 py-6 shadow-sm shadow-slate-900/5">
        <View className="rounded-full border-2 border-slate-100 p-1">
          <Avatar name={colleague?.name} uri={resolveImageUrl(colleague?.image)} size={84} />
        </View>
        <View className="items-center gap-1">
          <Text className="text-center text-xl font-bold tracking-tight text-black" numberOfLines={2}>
            {colleague?.name ?? 'Colleague'}
          </Text>
          {colleague?.email ? (
            <Text className="text-center text-sm text-black" numberOfLines={1}>
              {colleague.email}
            </Text>
          ) : null}
        </View>
        {isMe ? (
          <View className="rounded-full bg-blue-50 px-3 py-1">
            <Text className="text-xs font-semibold text-blue-700">This is you</Text>
          </View>
        ) : null}
      </View>

      {/* Task lists */}
      <View className="gap-3">
        <Text className="px-1 text-[13px] font-semibold uppercase tracking-wider text-black">Tasks</Text>

        {options.map((option) => {
          const tint = Tints[option.tint];
          return (
            <Pressable
              key={option.kind}
              onPress={() => router.push({ pathname: '/contact/[id]/[list]', params: { id: id!, list: option.kind } })}
              accessibilityRole="button"
              accessibilityHint={option.describe(firstName)}
              className="min-h-[76px] flex-row items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm shadow-slate-900/5 active:bg-slate-50"
            >
              <View className={`h-12 w-12 items-center justify-center rounded-xl ${tint.bg}`}>
                <SymbolView name={option.icon} size={22} tintColor={tint.fg} />
              </View>
              <View className="flex-1 gap-0.5">
                <Text className="text-[16px] font-bold text-black" numberOfLines={1}>
                  {taskListTitle(option.kind, name)}
                </Text>
                <Text className="text-[13px] leading-[18px] text-black" numberOfLines={2}>
                  {option.describe(firstName)}
                </Text>
              </View>
              <SymbolView name={CHEVRON} size={16} tintColor="#000000" />
            </Pressable>
          );
        })}
      </View>
    </Page>
  );
}
