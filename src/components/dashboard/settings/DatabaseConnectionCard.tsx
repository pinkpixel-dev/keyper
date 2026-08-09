/**
 * Where Keyper is currently storing things, and how to point it somewhere else.
 *
 * This card is the way back to the Configure Database screen. Without it the
 * only route to a different provider was clearing browser storage by hand,
 * which is a rough thing to ask of someone who just wants to move from Supabase
 * to Neon.
 *
 * Disconnecting is deliberately not destructive. It forgets the connection
 * details held in this browser or Electron profile, signs the session out and
 * drops the in-memory vault key. The encrypted rows stay in the database, so
 * reconnecting to the same one with the same passphrase brings everything back.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  disconnectDatabase,
  getDatabaseProvider,
  getNeonConnectionString,
  getNeonMode,
  getSqliteDatabasePath,
  getSupabaseCredentials,
  isElectronApp,
} from '@/integrations/supabase/client';
import { isAuthRequired, getDisplayName, signOut } from '@/integrations/supabase/auth';
import { vaultManager } from '@/services/VaultManager';
import { Database, Info, Loader2, PlugZap } from 'lucide-react';

const PROVIDER_LABELS = {
  supabase: 'Supabase',
  neon: 'Neon Postgres',
  sqlite: 'SQLite (local)',
} as const;

/**
 * A connection string carries a password, so only the host is ever shown.
 * Falling back to the raw string would defeat the point of hiding it.
 */
function neonHost(connectionString: string): string {
  try {
    return new URL(connectionString).host;
  } catch {
    return 'connection string set';
  }
}

export default function DatabaseConnectionCard() {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);

  const { toast } = useToast();

  const provider = getDatabaseProvider();
  const showsAccount = isAuthRequired();

  useEffect(() => {
    if (!showsAccount) return;

    let active = true;
    void getDisplayName().then((name) => {
      if (active) setAccountName(name);
    });

    return () => {
      active = false;
    };
  }, [showsAccount]);

  const target = (): string => {
    if (provider === 'neon') {
      const connectionString = getNeonConnectionString();
      const mode = getNeonMode() === 'local' ? 'Neon Local' : 'Neon Cloud';
      return connectionString ? `${mode} — ${neonHost(connectionString)}` : mode;
    }

    if (provider === 'sqlite') {
      const path = getSqliteDatabasePath();
      if (path) return path;
      return isElectronApp() ? 'Default app data directory' : 'Default browser-local database';
    }

    return getSupabaseCredentials().supabaseUrl;
  };

  const handleDisconnect = async () => {
    setBusy(true);

    try {
      // Order matters. Sign out first, while the credentials that built the
      // auth client are still there to sign out against.
      if (showsAccount) {
        try {
          await signOut();
        } catch (signOutError) {
          // A dead session should not trap someone on a database they are
          // trying to leave.
          console.warn('Sign out during disconnect failed, continuing:', signOutError);
        }
      }

      vaultManager.clearSession();
      disconnectDatabase();

      toast({
        title: 'Database disconnected',
        description: 'Your stored credentials are untouched. Set up a database to continue.',
      });

      window.location.reload();
    } catch (error) {
      toast({
        title: 'Could not disconnect',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setBusy(false);
      setConfirmOpen(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" aria-hidden="true" />
          Database Connection
        </CardTitle>
        <CardDescription>
          Where Keyper is storing your encrypted credentials right now.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/40 p-3">
            <dt className="text-xs font-medium text-muted-foreground">Provider</dt>
            <dd className="mt-1 text-sm font-medium text-foreground">
              {PROVIDER_LABELS[provider]}
            </dd>
          </div>

          <div className="rounded-lg border bg-muted/40 p-3">
            <dt className="text-xs font-medium text-muted-foreground">
              {provider === 'sqlite' ? 'Database' : 'Endpoint'}
            </dt>
            <dd className="mt-1 break-all font-mono text-sm text-foreground">{target()}</dd>
          </div>

          {showsAccount && (
            <div className="rounded-lg border bg-muted/40 p-3 sm:col-span-2">
              <dt className="text-xs font-medium text-muted-foreground">Signed in as</dt>
              <dd className="mt-1 break-all text-sm text-foreground">
                {accountName ?? 'Loading...'}
              </dd>
            </div>
          )}
        </dl>

        <Alert>
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            Disconnecting forgets these details on this device and returns you to
            setup, which is how you move to a different database or provider. It
            does not delete anything: your encrypted credentials stay in the
            database, and reconnecting with the same master passphrase brings
            them back.
          </AlertDescription>
        </Alert>

        <Button
          variant="outline"
          onClick={() => setConfirmOpen(true)}
          disabled={busy}
          className="w-full sm:w-auto"
        >
          {busy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              Disconnecting...
            </>
          ) : (
            <>
              <PlugZap className="mr-2 h-4 w-4" aria-hidden="true" />
              Disconnect &amp; reconfigure
            </>
          )}
        </Button>

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect this database?</AlertDialogTitle>
              <AlertDialogDescription>
                Keyper will forget the connection details for{' '}
                <strong>{PROVIDER_LABELS[provider]}</strong>
                {showsAccount ? ', sign you out' : ''} and lock the vault, then
                reload to the setup screen. Nothing stored in the database is
                deleted. Your theme and font settings are kept.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(event) => {
                  // The dialog closes on click by default, which would unmount
                  // the busy state mid-disconnect.
                  event.preventDefault();
                  void handleDisconnect();
                }}
                disabled={busy}
              >
                {busy ? 'Disconnecting...' : 'Disconnect'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
