import { Stack } from 'expo-router';

import { NotesProvider } from '@/providers/notes-provider';

/** Notes list and editor share one notes/tags state (like the web page's single component). */
export default function Layout() {
  return (
    <NotesProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </NotesProvider>
  );
}
