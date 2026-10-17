import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { BirdSessionProvider } from '@/hooks/useBirdSession';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <BirdSessionProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
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
    </BirdSessionProvider>
  );
}
