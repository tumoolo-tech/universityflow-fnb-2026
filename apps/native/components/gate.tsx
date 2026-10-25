import { en } from '@universityflow/content/app';
import { Stack, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { useAuth } from '../lib/auth';
import { useReduceMotion } from '../lib/motion';
import { useNotificationRouting, usePushRegistration } from '../lib/push';
import { theme } from '../lib/theme';
import { Body, Screen } from './ui';

/**
 * The auth gate under the root layout. Signed out, only sign-in exists; signed in, only the app
 * does. A 401 anywhere clears the token (lib/api.ts), which flips the gate back to sign-in. A
 * tapped notification opens the screen it names, once signed in (lib/push.ts).
 *
 * Every file under app/ must be declared in one of the two guards: expo-router adds an undeclared
 * screen unguarded (A7-13). __tests__/gate-screens.test.tsx fails on one that isn't.
 */
export function Gate() {
  const { status } = useAuth();
  const router = useRouter();
  const signedIn = status === 'signed-in';
  const reduceMotion = useReduceMotion();
  const open = useCallback(
    (route: string) => router.push(route as Parameters<typeof router.push>[0]),
    [router],
  );
  useNotificationRouting(signedIn, open);
  // Each session registers this phone for notifications again, if they are on (A7-02).
  usePushRegistration(signedIn);

  if (status === 'loading') {
    return (
      <Screen>
        <Body>{en.common.loading}</Body>
      </Screen>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.color.canvas },
        headerTintColor: theme.color.brand,
        headerTitleStyle: { color: theme.color.ink },
        contentStyle: { backgroundColor: theme.color.canvas },
        headerBackTitle: en.common.back,
        // The platform's own push, or an instant cut when the phone asks for less motion
        // (hard rule 9, A7-12).
        animation: reduceMotion ? 'none' : 'default',
      }}
    >
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ headerShown: false, title: en.nav.home }} />
        <Stack.Screen name="results" options={{ title: en.results.title }} />
        <Stack.Screen name="subjects" options={{ title: en.subjects.title }} />
        <Stack.Screen name="goals" options={{ title: en.goals.title }} />
        <Stack.Screen name="plan-map" options={{ title: en.planMaps.title }} />
        <Stack.Screen name="offers" options={{ title: en.offers.title }} />
        <Stack.Screen name="campus" options={{ title: en.campus.title }} />
        <Stack.Screen name="first-week" options={{ title: en.firstWeek.title }} />
        <Stack.Screen name="modules" options={{ title: en.modules.title }} />
        <Stack.Screen name="module/[code]" options={{ title: en.moduleCard.pageTitle }} />
        <Stack.Screen name="what-i-need/[programmeId]" options={{ title: en.whatINeed.title }} />
        <Stack.Screen name="upload" options={{ title: en.documents.uploadReport }} />
        <Stack.Screen name="notifications" options={{ title: en.notifications.title }} />
        <Stack.Screen name="account" options={{ title: en.me.title }} />
        <Stack.Screen name="cv" options={{ title: en.cv.title }} />
        <Stack.Screen name="chat" options={{ headerShown: false, title: en.chat.title }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ headerShown: false, title: en.auth.title }} />
      </Stack.Protected>
    </Stack>
  );
}
