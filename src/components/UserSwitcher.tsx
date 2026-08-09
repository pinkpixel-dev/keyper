/**
 * UserSwitcher - the signed-in account panel
 *
 * This component used to list every registered user by selecting user_id from
 * vault_config with no filter, and let you switch to any of them. That only
 * worked because the table was readable by anyone, which was the bug. Now the
 * query would return just your own row, and switching accounts means signing in
 * as that account, which is the honest behaviour.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getDisplayName, signOut, isAuthRequired } from '@/integrations/supabase/auth';
import { vaultManager } from '@/services/VaultManager';
import { AlertTriangle, LogOut, Shield, User } from 'lucide-react';

interface UserSwitcherProps {
  onUserSwitched?: () => void;
}

export default function UserSwitcher({ onUserSwitched }: UserSwitcherProps) {
  const [accountName, setAccountName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const authRequired = isAuthRequired();

  useEffect(() => {
    void getDisplayName().then(setAccountName);
  }, []);

  const handleSignOut = async () => {
    setSigningOut(true);
    setError(null);

    try {
      // Drop the decrypted key before the session goes away, not after.
      vaultManager.clearSession();
      await signOut();
      onUserSwitched?.();
      window.location.reload();
    } catch (signOutError) {
      console.error('Failed to sign out:', signOutError);
      setError(signOutError instanceof Error ? signOutError.message : 'Failed to sign out');
      setSigningOut(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-primary" aria-hidden="true" />
          Account
        </CardTitle>
        <CardDescription>
          {authRequired
            ? 'Your vault belongs to this account. To use a different one, sign out and sign in as that account.'
            : 'This vault is stored locally on this device, so there is no account to sign in to.'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <Shield className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Signed in as <strong>{accountName || 'loading...'}</strong>. Signing in
            only gets you your own encrypted rows; the master passphrase is still
            required to read them.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {authRequired && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="flex w-full items-center gap-2 sm:w-auto"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {signingOut ? 'Signing out...' : 'Sign out'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
