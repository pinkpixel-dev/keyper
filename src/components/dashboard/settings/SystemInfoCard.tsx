/**
 * System information.
 *
 * Everything here is read from the running app. The previous version hardcoded
 * the version as "0.1.0" and described a bcrypt reset flow that no longer
 * exists, which is worse than showing nothing: people quote this panel in bug
 * reports.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getDatabaseProvider, isElectronApp } from '@/integrations/supabase/client';
import { getDisplayName, isAuthRequired } from '@/integrations/supabase/auth';
import { APP_LINKS, APP_VERSION } from '@/lib/app-info';
import { Database, Info } from 'lucide-react';

const PROVIDER_LABEL: Record<string, string> = {
  supabase: 'Supabase (Postgres)',
  neon: 'Neon (Postgres)',
  sqlite: 'SQLite (local)',
};

export default function SystemInfoCard() {
  const [account, setAccount] = useState('...');

  const provider = getDatabaseProvider();
  const authRequired = isAuthRequired();

  useEffect(() => {
    void getDisplayName().then(setAccount);
  }, []);

  const rows: Array<{ label: string; value: React.ReactNode }> = [
    { label: 'Signed in as', value: account },
    { label: 'App version', value: <span className="font-mono">{APP_VERSION}</span> },
    { label: 'Database provider', value: PROVIDER_LABEL[provider] ?? provider },
    { label: 'Running as', value: isElectronApp() ? 'Desktop app' : 'Browser / PWA' },
    {
      label: 'Account sign-in',
      value: authRequired ? 'Required' : 'Not used by this provider',
    },
    { label: 'Vault key storage', value: 'Encrypted under your master passphrase' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" aria-hidden="true" />
          System Information
        </CardTitle>
        <CardDescription>Current status and configuration.</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <dl className="grid gap-3 sm:grid-cols-2">
          {rows.map(({ label, value }) => (
            <div key={label} className="rounded-lg border bg-muted/30 p-3">
              <dt className="text-sm text-muted-foreground">{label}</dt>
              <dd className="pt-0.5 text-sm font-medium break-words">{value}</dd>
            </div>
          ))}
        </dl>

        <Alert>
          <Info className="h-4 w-4" aria-hidden="true" />
          <AlertDescription className="space-y-1">
            <p>
              {authRequired
                ? 'Signing in decides whether the database returns your rows. Your master passphrase decrypts them. Two separate secrets.'
                : 'This provider stores your vault locally, so there is no account to sign in to. Your master passphrase decrypts the vault.'}
            </p>
            <p>
              <a
                href={APP_LINKS.securityModel}
                target="_blank"
                rel="noreferrer noopener"
                className="text-primary underline-offset-4 hover:underline"
              >
                Read the security model
              </a>{' '}
              for what each layer covers, including what is and is not encrypted.
            </p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
