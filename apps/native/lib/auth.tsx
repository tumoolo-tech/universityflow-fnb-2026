import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { removeThisPhone } from './push';
import { clearToken, onSessionChange, readToken, saveToken } from './session';

/**
 * Whether the app holds a session. The root layout's gate reads it: signed out shows sign-in,
 * signed in shows the app. It changes on sign-in, sign-out and any 401 (api.ts clears the token).
 */

export type AuthStatus = 'loading' | 'signed-in' | 'signed-out';

interface AuthValue {
  readonly status: AuthStatus;
  signIn(token: string): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');

  useEffect(() => {
    let live = true;
    const off = onSessionChange((signedIn) => setStatus(signedIn ? 'signed-in' : 'signed-out'));
    void readToken().then((token) => {
      if (live) setStatus(token ? 'signed-in' : 'signed-out');
    });
    return () => {
      live = false;
      off();
    };
  }, []);

  const value = useMemo<AuthValue>(
    () => ({
      status,
      signIn: (token) => saveToken(token),
      async signOut() {
        try {
          // This phone stops getting notifications for this account first (while the session
          // still works); the server would drop the token with the session anyway.
          await removeThisPhone();
          // Revokes the token on the server; the app forgets it whatever the answer.
          await api('/api/auth/sign-out', { method: 'POST' });
        } catch {
          // Offline or already revoked: still signed out here.
        } finally {
          await clearToken();
        }
      },
    }),
    [status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}
