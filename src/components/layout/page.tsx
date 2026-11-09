import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

type PageProps = {
  title?: string;
  subtitle?: string;
  children?: ReactNode;
};

/** Scrollable content area for a signed-in page (top bar and navbar come from the layout). */
export function Page({ title, subtitle, children }: PageProps) {
  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerClassName="w-full max-w-3xl self-center gap-6 p-5 pb-10">
      {title || subtitle ? (
        <View className="gap-1">
          {subtitle ? <Text className="text-sm font-medium text-slate-500">{subtitle}</Text> : null}
          {title ? <Text className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</Text> : null}
        </View>
      ) : null}
      {children}
    </ScrollView>
  );
}
