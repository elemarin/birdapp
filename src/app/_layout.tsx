import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { BirdSessionProvider } from '@/hooks/useBirdSession';
import { LocalDataProvider } from '@/hooks/useLocalData';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <LocalDataProvider><BirdSessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="session/[id]" />
        <Stack.Screen
          name="bird/[id]"
          options={{
            presentation: 'formSheet',
            sheetAllowedDetents: [0.65, 1],
            sheetGrabberVisible: true,
            sheetCornerRadius: 26,
            contentStyle: { backgroundColor: colors.bg },
          }}
        />
      </Stack>
    </BirdSessionProvider></LocalDataProvider>
  );
}
