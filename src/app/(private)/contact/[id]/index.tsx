import { useLocalSearchParams, useRouter } from 'expo-router';
import { type SymbolViewProps, SymbolView } from 'expo-symbols';
import { Pressable, Text, View } from 'react-native';

import { Page } from '@/components/layout/page';
import { ScreenHeader } from '@/components/layout/screen-header';
import { Avatar } from '@/components/ui/avatar';
import { useColleague } from '@/hooks/use-colleague';
import { useAppSelector } from '@/hooks/use-redux';
import { resolveImageUrl } from '@/lib/image-url';
import { type TaskListKind, taskListTitle } from '@/lib/tasks';

type Option = { kind: TaskListKind; icon: SymbolViewProps['name'] };

const COLLEAGUE_OPTIONS: Option[] = [
  { kind: 'assignedTo', icon: { ios: 'paperplane', android: 'send', web: 'send' } },
  { kind: 'assignedBy', icon: { ios: 'envelope.open', android: 'drafts', web: 'drafts' } },
  { kind: 'needToFinish', icon: { ios: 'list.clipboard', android: 'assignment', web: 'assignment' } },
  { kind: 'complete', icon: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' } },
  { kind: 'workload', icon: { ios: 'briefcase', android: 'work', web: 'work' } },
];

// When opening yourself, "To"/"From" collapse into one list of your own tasks (as on the web).
const PERSONAL_OPTIONS: Option[] = [
  { kind: 'personal', icon: { ios: 'person', android: 'person', web: 'person' } },
  ...COLLEAGUE_OPTIONS.slice(2),
];

export default function ColleagueTaskOptionsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me: string | undefined = useAppSelector((state) => state.auth.user?._id);
  const colleague = useColleague(id);

  const isMe = !!id && id === me;
  const name = isMe ? 'Me' : (colleague?.name ?? 'Colleague');
  const options = isMe ? PERSONAL_OPTIONS : COLLEAGUE_OPTIONS;

  return (
    <Page>
      <ScreenHeader title={colleague?.name ?? 'Colleague'} fallbackHref="/contact" />

      <View className="items-center gap-2">
        <Avatar name={colleague?.name} uri={resolveImageUrl(colleague?.image)} size={72} />
        {colleague?.email ? <Text className="text-sm text-slate-500">{colleague.email}</Text> : null}
      </View>

      <View className="gap-3">
        {options.map((option) => (
          <Pressable
            key={option.kind}
            onPress={() =>
              router.push({ pathname: '/contact/[id]/[list]', params: { id: id!, list: option.kind } })
            }
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2.5 rounded-xl bg-primary px-4 py-4 shadow-md shadow-slate-900/20 active:opacity-90"
          >
            <SymbolView name={option.icon} size={18} tintColor="#ffffff" />
            <Text className="text-base font-bold text-white">{taskListTitle(option.kind, name)}</Text>
          </Pressable>
        ))}
      </View>
    </Page>
  );
}
