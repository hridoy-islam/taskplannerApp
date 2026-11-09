import { useEffect } from 'react';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { Provider as ReduxProvider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { persistStore } from 'redux-persist';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';

import { Toaster } from '@/components/ui/toaster';
import store from '@/redux/store';

// Keep the native splash (logo.png) on screen until the app is ready.
SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

const persistor = persistStore(store);

function HideSplashWhenReady() {
  useEffect(() => {
    SplashScreen.hide();
  }, []);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ReduxProvider store={store}>
      <PersistGate loading={null} persistor={persistor}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          {/* The app is always light, so keep the phone's status bar icons dark and visible. */}
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }} />
          <HideSplashWhenReady />
          {/* Global toasts, shown from the top over every screen. */}
          <Toaster />
        </ThemeProvider>
      </PersistGate>
    </ReduxProvider>
  );
}
