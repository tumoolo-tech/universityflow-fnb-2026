import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Gate } from '../components/gate';
import { AuthProvider } from '../lib/auth';
import { configureNotifications } from '../lib/push';

// How a notification shows while the app is open. Nothing here asks for permission: that waits
// until the learner turns notifications on (lib/push.ts).
configureNotifications();

/**
 * Root layout: safe areas (mandatory under SDK 57's edge-to-edge), the session, and the auth
 * gate (components/gate.tsx), which also opens the screen a tapped notification names.
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      {/* Light status-bar icons on the dark theme (docs/design/README.md). */}
      <StatusBar style="light" />
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
