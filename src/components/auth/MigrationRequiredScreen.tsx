/**
 * Shown when the database predates the v1.3.0 security migration.
 *
 * The tone here is deliberate. Someone hitting this screen is looking at a
 * vault full of credentials that suddenly will not open, so the first thing
 * they need to know is that nothing is lost and nothing is deleted. The
 * instructions come second.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import migrationSql from '../../../migration-auth-rls.sql?raw';
import {
  Check,
  ClipboardCopy,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react';

interface MigrationRequiredScreenProps {
  /** Re-runs the schema probe. Resolves true when the database looks current. */
  onRecheck: () => Promise<boolean>;
}

const STEPS = [
  {
    title: 'Back up your database',
    body: 'Supabase dashboard → Database → Backups. Good practice before any schema change.',
  },
  {
    title: 'Turn on email sign-in',
    body: 'Authentication → Providers → enable Email. Keyper signs you in to an account now, so this needs to be on before you can continue.',
  },
  {
    title: 'Create your account',
    body: 'Authentication → Users → Add user. Use a real email and a strong password, then copy the account UUID from the users list.',
  },
  {
    title: 'Run the migration',
    body: 'Paste the script into the SQL editor and work through it in order. You will need to paste your UUID into the Stage 1c section. Stage 3 is commented out on purpose, so leave it for now.',
  },
  {
    title: 'Come back and sign in',
    body: 'Use Re-check below, sign in, then unlock with your existing master passphrase. Keyper moves your vault key to the new format automatically. Run Stage 3 once that is done.',
  },
];

export default function MigrationRequiredScreen({ onRecheck }: MigrationRequiredScreenProps) {
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [stillStale, setStillStale] = useState(false);

  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(migrationSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Copy migration-auth-rls.sql from the Keyper repo instead.',
        variant: 'destructive',
      });
    }
  };

  const handleRecheck = async () => {
    setChecking(true);
    setStillStale(false);
    try {
      const migrated = await onRecheck();
      if (!migrated) setStillStale(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-dot-pattern text-foreground flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            Your database needs a one-time update
          </CardTitle>
          <CardDescription>
            Keyper 1.3.0 changed how your vault key is stored and who the database
            will hand rows to. Your database is still on the older layout.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <Alert>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              <strong>Your credentials are safe.</strong> Nothing has been deleted
              and nothing is corrupted. This update adds an ownership column and
              replaces the access rules. Your encrypted data is not touched, and
              your master passphrase still works.
            </AlertDescription>
          </Alert>

          <Alert>
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Use <code>migration-auth-rls.sql</code>, not{' '}
              <code>supabase-setup.sql</code>. The setup script is for new
              installs. Work through the migration in order rather than pasting
              it all at once, since the last stage removes the old vault key.
            </AlertDescription>
          </Alert>

          <div>
            <h3 className="text-sm font-medium mb-3">What to do</h3>
            <ol className="space-y-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="flex gap-3">
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary"
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium leading-tight">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopy()}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copied to clipboard
                </>
              ) : (
                <>
                  <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
                  Copy migration SQL
                </>
              )}
            </Button>

            <Button
              type="button"
              onClick={() => void handleRecheck()}
              disabled={checking}
              className="flex-1"
            >
              {checking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
                  Re-check database
                </>
              )}
            </Button>
          </div>

          {stillStale && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Still on the old layout. Stage 1 of the migration has not completed
                yet. Check the SQL editor for an error, most often an unclaimed row
                blocking the <code>SET NOT NULL</code> step in Stage 1d.
              </AlertDescription>
            </Alert>
          )}

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Why is this needed?
            </summary>
            <div className="pt-2 space-y-2 text-muted-foreground">
              <p>
                Keyper used to identify you by a username typed into the app, and
                the database rules that came with it applied broadly rather than to
                the signed-in owner. That meant the database was not enforcing the
                separation the app assumed.
              </p>
              <p>
                Now you sign in to a real account, the database checks it on every
                request, and your vault key is stored encrypted under your master
                passphrase. This migration adds the ownership column and swaps the
                rules over so your existing data works with all of that.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
