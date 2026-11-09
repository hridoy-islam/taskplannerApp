import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/auth/back-button';
import { Brand } from '@/constants/theme';

type AuthLayoutProps = {
  title: string;
  subtitle?: ReactNode;
  showBack?: boolean;
  children: ReactNode;
};

/** Shared shell for the auth screens: back button, logo, title and subtitle. */
export function AuthLayout({ title, subtitle, showBack = false, children }: AuthLayoutProps) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.backRow}>{showBack ? <BackButton /> : null}</View>

          <View style={styles.content}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logo}
              contentFit="contain"
              accessibilityLabel="Task Planner"
            />
            <Text style={styles.title}>{title}</Text>
            {subtitle ? <View style={styles.subtitleWrap}>{subtitle}</View> : null}
            <View style={styles.body}>{children}</View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

const BACK_ROW_HEIGHT = 56;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.surface },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 32 },
  backRow: { height: BACK_ROW_HEIGHT, justifyContent: 'center' },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    // Offset the back row so the block sits at the true visual centre.
    paddingBottom: BACK_ROW_HEIGHT,
  },
  logo: { width: 136, height: 65 },
  title: {
    marginTop: 20,
    fontSize: 28,
    fontWeight: '700',
    color: Brand.text,
    textAlign: 'center',
  },
  subtitleWrap: { marginTop: 6, alignItems: 'center' },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Brand.textMuted,
    textAlign: 'center',
  },
  body: { width: '100%', marginTop: 28, gap: 22 },
});
