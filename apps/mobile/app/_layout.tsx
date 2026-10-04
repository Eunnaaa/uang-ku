import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { colors } from '../src/theme/colors';
import { getDb } from '../src/db/sqlite';

export default function RootLayout() {
  useEffect(() => {
    // Initialize SQLite local database on app launch
    getDb().catch(console.error);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg.base },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/new"
          options={{
            presentation: 'modal',
            headerShown: false,
            contentStyle: { backgroundColor: colors.bg.base },
          }}
        />
      </Stack>
    </>
  );
}
