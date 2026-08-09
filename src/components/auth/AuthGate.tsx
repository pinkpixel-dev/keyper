/**
 * AuthGate - requires a session before anything else renders.
 *
 * This is the outer gate. The inner one is PassphraseGate, and the split is
 * deliberate:
 *
 *   AuthGate       decides whether the database will return your rows at all
 *   PassphraseGate decides whether those rows can be decrypted
 *
 * Neither substitutes for the other. Being signed in gets you ciphertext; only
 * the master passphrase turns it into plaintext.
 *
 * Local providers (SQLite, Neon) have no server-side session to check, so the
 * gate steps out of the way entirely rather than showing a login that protects
 * nothing.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { onAuthStateChange, isAuthRequired } from '@/integrations/supabase/auth';
import { checkSchemaState } from '@/integrations/supabase/schema-check';
import { vaultManager } from '@/services/VaultManager';
import MigrationRequiredScreen from './MigrationRequiredScreen';
import SignInForm from './SignInForm';
import UserRegistration from '@/components/UserRegistration';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MailCheck } from 'lucide-react';

type AuthView = 'sign-in' | 'sign-up' | 'check-email';

interface AuthGateProps {
  children: React.ReactNode;
}

export default function AuthGate({ children }: AuthGateProps) {
  const authRequired = isAuthRequired();

  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(authRequired);
  const [needsMigration, setNeedsMigration] = useState(false);
  const [view, setView] = useState<AuthView>('sign-in');
  const [pendingEmail, setPendingEmail] = useState('');

  useEffect(() => {
    // `checking` is seeded from authRequired, so the local providers already
    // start in the not-checking state and there is nothing to do here.
    if (!authRequired) {
      return;
    }

    // The subscription is the single source of truth for the session.
    // supabase-js emits INITIAL_SESSION as soon as it has resolved any stored
    // session, so this one listener covers first paint, sign-in, sign-out in
    // another tab, and token expiry. Calling getSession() alongside it would
    // race with this callback.
    return onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      setChecking(false);

      if (event === 'SIGNED_OUT') {
        // Never leave a decrypted key in memory after the session ends.
        vaultManager.clearSession();
        setView('sign-in');
      }
    });
  }, [authRequired]);

  useEffect(() => {
    if (!authRequired) {
      return;
    }

    // Probed before sign-in, not after. On an un-migrated database the old
    // permissive policies still allow this read, so we can diagnose without a
    // session. Making someone create an account first and fail afterwards would
    // waste their time and muddy the diagnosis.
    let cancelled = false;

    void checkSchemaState().then((result) => {
      if (!cancelled) setNeedsMigration(result.state === 'needs-migration');
    });

    return () => {
      cancelled = true;
    };
  }, [authRequired]);

  const recheckSchema = useCallback(async () => {
    const result = await checkSchemaState();
    const migrated = result.state !== 'needs-migration';
    setNeedsMigration(!migrated);
    return migrated;
  }, []);

  if (!authRequired) {
    return <>{children}</>;
  }

  if (checking) {
    return (
      <div className="min-h-screen bg-dot-pattern text-foreground flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Checking your session...</p>
        </div>
      </div>
    );
  }

  // Takes priority over the sign-in form: on an un-migrated database, signing
  // in succeeds and then everything after it fails, which is a worse experience
  // than being told up front what is actually wrong.
  if (needsMigration) {
    return <MigrationRequiredScreen onRecheck={recheckSchema} />;
  }

  if (session) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-dot-pattern text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        {view === 'sign-in' && (
          <SignInForm onSwitchToSignUp={() => setView('sign-up')} />
        )}

        {view === 'sign-up' && (
          <UserRegistration
            onNeedsConfirmation={(email) => {
              setPendingEmail(email);
              setView('check-email');
            }}
            onSwitchToSignIn={() => setView('sign-in')}
          />
        )}

        {view === 'check-email' && (
          <Alert>
            <MailCheck className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="space-y-3">
              <p>
                Account created. Confirm <strong>{pendingEmail}</strong> from your
                inbox, then sign in.
              </p>
              <Button variant="outline" size="sm" onClick={() => setView('sign-in')}>
                Back to sign in
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
