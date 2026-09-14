import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, AppState, Platform, type AppStateStatus } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { useAppStore } from '@/stores/useAppStore';
import { palette } from '@/theme/colors';

export default function RootLayout() {
  const hydrate = useAppStore((s) => s.hydrate);
  const loadToday = useAppStore((s) => s.loadToday);
  const hydrated = useAppStore((s) => s.hydrated);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      hydrate();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [hydrate]);

  useEffect(() => {
    const onActive = (state: AppStateStatus) => {
      if (state === 'active') {
        try { loadToday(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
      }
    };
    const sub = AppState.addEventListener('change', onActive);
    return () => sub.remove();
  }, [loadToday, hydrated]);

  if (error) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ color: palette.text }}>数据库初始化失败：{error}</Text>
      </View>
    );
  }
  if (!hydrated) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={palette.blue} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider statusBarTranslucent navigationBarTranslucent={false}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="checklist/[id]" options={{ presentation: 'card', headerShown: true, title: '' }} />
          <Stack.Screen
            name="template/edit"
            options={{
              presentation: Platform.OS === 'ios' ? 'modal' : 'card',
              headerShown: false,
            }}
          />
        </Stack>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
