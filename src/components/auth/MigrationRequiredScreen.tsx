/**
 * Shown when the database predates the v1.3.0 update.
 *
 * This is the highest-stakes screen in the app. Someone reaching it is looking at
 * a vault that will not open, which is alarming, and the next thing they do
 * decides whether the upgrade goes smoothly. So:
 *
 * - reassurance comes first, before any instruction
 * - the steps are handed out one at a time with their own copy buttons, because
 *   a single file with "stages" in comments is a file people paste whole
 * - the one destructive-sounding decision (the edit) is called out in red
 * - progress is remembered, since the flow moves between Keyper and Supabase
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import step1Sql from '../../../migration/01-check.sql?raw';
import step2Sql from '../../../migration/02-claim-your-data.sql?raw';
import step3Sql from '../../../migration/03-apply-security.sql?raw';
import step4Sql from '../../../migration/04-check-key.sql?raw';
import step5Sql from '../../../migration/05-remove-old-key.sql?raw';
import {
  Check,
  ClipboardCopy,
  Database,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Info,
  TriangleAlert,
  BookOpen,
} from 'lucide-react';

const PROGRESS_KEY = 'keyper-migration-progress';
const GUIDE_URL = 'https://keyper.icu/getting-started/upgrading-to-1-3/';

interface MigrationRequiredScreenProps {
  /** Re-runs the schema probe. Resolves true when the database looks current. */
  onRecheck: () => Promise<boolean>;
}

interface Step {
  id: string;
  where: 'Supabase dashboard' | 'SQL Editor' | 'Here in Keyper';
  title: string;
  body: React.ReactNode;
  sql?: string;
  file?: string;
  /** Rendered in red. Reserved for things that cause real confusion if missed. */
  critical?: React.ReactNode;
  expected?: string;
}

const STEPS: Step[] = [
  {
    id: 'backup',
    where: 'Supabase dashboard',
    title: 'Back up your database',
    body: 'Database → Backups. Takes ten seconds, and means any mistake from here is never permanent.',
  },
  {
    id: 'email',
    where: 'Supabase dashboard',
    title: 'Turn on email sign-in',
    body: 'Authentication → Providers → Email → enable. Keyper signs you in to a real account now, so this has to exist before anything else works.',
  },
  {
    id: 'account',
    where: 'Supabase dashboard',
    title: 'Create your account',
    body: 'Authentication → Users → Add user. Use a real email address and a strong password.',
    critical: (
      <>
        This password is <strong>not</strong> your master passphrase. Do not reuse
        your master passphrase here. They do different jobs and you will need both.
      </>
    ),
  },
  {
    id: 'check',
    where: 'SQL Editor',
    title: 'Run 01-check.sql to find your account ID',
    body: 'Reads only, changes nothing, safe to run as often as you like. It prints the account UUID you need in the next step.',
    sql: step1Sql,
    file: '01-check.sql',
    expected: 'Accounts you can migrate to | you@example.com  ->  a1b2c3d4-...',
    critical: (
      <>
        Copy the UUID printed next to your email address. It is{' '}
        <strong>not</strong> the <code>id</code> column in your credentials or
        vault_config tables — those are row IDs, one per row.
      </>
    ),
  },
  {
    id: 'claim',
    where: 'SQL Editor',
    title: 'Run 02-claim-your-data.sql',
    body: (
      <>
        This is the <strong>only script that needs an edit</strong>. Find this line
        and replace the zeros with your UUID from the previous step, keeping the
        quotes:
        <code className="mt-2 block overflow-x-auto rounded bg-muted p-2 text-xs">
          target_owner UUID := &apos;00000000-0000-0000-0000-000000000000&apos;;
        </code>
        Change nothing else. Leave <code>only_username</code> as <code>NULL</code>{' '}
        unless several people share this database.
      </>
    ),
    sql: step2Sql,
    file: '02-claim-your-data.sql',
    expected: 'Assigned to you@example.com: 25 credential(s), 1 vault config(s), 8 category/ies',
    critical: (
      <>
        Check those numbers match what you actually have. If credentials says{' '}
        <strong>0</strong>, stop and read the troubleshooting section in the guide
        before continuing.
      </>
    ),
  },
  {
    id: 'secure',
    where: 'SQL Editor',
    title: 'Run 03-apply-security.sql',
    body: 'No edits. Paste and run. This swaps over the database access rules. If the previous step did not finish, this stops without changing anything and tells you so.',
    sql: step3Sql,
    file: '03-apply-security.sql',
    expected: 'Done. Access rules replaced on all three tables.  (every row below should say SCOPED)',
  },
  {
    id: 'unlock',
    where: 'Here in Keyper',
    title: 'Re-check, sign in, and unlock',
    body: 'Press Re-check below, sign in with the account you just created, then unlock with your existing master passphrase. Keyper moves your vault key to the new format the moment you unlock. Nothing is re-encrypted, so it is instant.',
    critical: (
      <>
        If Keyper offers to <strong>create a new vault</strong> instead of asking
        for your existing passphrase, stop and do not create one. It means the
        previous step did not claim your vault row.
      </>
    ),
  },
  {
    id: 'verify',
    where: 'SQL Editor',
    title: 'Run 04-check-key.sql to confirm',
    body: 'Reads only, changes nothing. Confirms your vault key moved across.',
    sql: step4Sql,
    file: '04-check-key.sql',
    expected: 'sizzlebop | DONE — ready for step 5',
    critical: <>Do not continue until every row says <strong>DONE</strong>.</>,
  },
  {
    id: 'cleanup',
    where: 'SQL Editor',
    title: 'Run 05-remove-old-key.sql',
    body: 'The last one. Removes the old copy of your vault key. It checks first and refuses if any vault has not moved across, so it cannot be run too early.',
    sql: step5Sql,
    file: '05-remove-old-key.sql',
    expected: 'Done. Old key columns removed. Your migration is complete.',
  },
];

function loadProgress(): string[] {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export default function MigrationRequiredScreen({ onRecheck }: MigrationRequiredScreenProps) {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [stillStale, setStillStale] = useState(false);
  const [done, setDone] = useState<string[]>(loadProgress);

  const { toast } = useToast();

  const toggleStep = useCallback((id: string) => {
    setDone((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
      try {
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
      } catch {
        // Progress tracking is a convenience; losing it changes nothing.
      }
      return next;
    });
  }, []);

  const handleCopy = async (step: Step) => {
    if (!step.sql || !step.file) return;

    try {
      await navigator.clipboard.writeText(step.sql);
      setCopiedFile(step.file);
      setTimeout(() => setCopiedFile((c) => (c === step.file ? null : c)), 2500);
    } catch {
      toast({
        title: 'Could not copy',
        description: `Open migration/${step.file} in the Keyper repo instead.`,
        variant: 'destructive',
      });
    }
  };

  const handleRecheck = async () => {
    setChecking(true);
    setStillStale(false);
    try {
      if (!(await onRecheck())) setStillStale(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-dot-pattern text-foreground flex justify-center p-4">
      <Card className="w-full max-w-3xl my-8 h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            Your database needs a one-time update
          </CardTitle>
          <CardDescription>
            Keyper 1.3.0 changed how you sign in and how your vault key is stored.
            Your database is still set up the previous way.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          <Alert>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              <strong>Your credentials are safe.</strong> Nothing has been deleted,
              nothing is corrupted, and your master passphrase still works. This
              adds an ownership column and swaps the access rules over. Your
              credentials are never re-encrypted, so it is quick.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="space-y-2">
              <p className="font-medium">Please read all of this before you start.</p>
              <ol className="list-decimal space-y-1 pl-4">
                <li>Run the scripts <strong>one at a time, in order</strong>. Do not paste them all in together.</li>
                <li><strong>Back up your database first.</strong> Supabase → Database → Backups.</li>
                <li>Do <strong>not</strong> run <code>supabase-setup.sql</code>. That is for new installs only.</li>
              </ol>
              <p>
                Every script checks itself before changing anything, so running one
                out of order stops safely and tells you where to go back to.
                Nothing half-applies.
              </p>
            </AlertDescription>
          </Alert>

          <Alert>
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              <strong>You will end up with two secrets, not one.</strong> The
              account password you create below gets you your rows. Your existing
              master passphrase decrypts them. You need both, and the master
              passphrase can no longer be reset, so keep a copy somewhere safe.
            </AlertDescription>
          </Alert>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild variant="outline" className="flex-1">
              <a href={GUIDE_URL} target="_blank" rel="noreferrer noopener">
                <BookOpen className="mr-2 h-4 w-4" aria-hidden="true" />
                Open the full guide
              </a>
            </Button>
            <Button onClick={() => void handleRecheck()} disabled={checking} className="flex-1">
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
            <Alert>
              <Info className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                Still on the previous setup. Steps 4, 5 and 6 all need to have run.
                Check the SQL Editor output: if a script stopped, it says what it
                was waiting for.
              </AlertDescription>
            </Alert>
          )}

          <div>
            <h3 className="mb-1 text-sm font-medium">The steps</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              Tick them off as you go. Your progress is remembered if you close
              this page.
            </p>

            <ol className="space-y-4">
              {STEPS.map((step, index) => {
                const isDone = done.includes(step.id);

                return (
                  <li
                    key={step.id}
                    className={`rounded-lg border p-3 transition-opacity ${
                      isDone ? 'border-border/50 opacity-60' : 'border-border'
                    }`}
                  >
                    <div className="flex gap-3">
                      <Checkbox
                        id={`step-${step.id}`}
                        checked={isDone}
                        onCheckedChange={() => toggleStep(step.id)}
                        className="mt-1"
                        aria-label={`Mark step ${index + 1} done`}
                      />

                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-muted-foreground">
                              Step {index + 1}
                            </span>
                            <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                              {step.where}
                            </span>
                          </div>
                          <label
                            htmlFor={`step-${step.id}`}
                            className="block cursor-pointer text-sm font-medium leading-tight"
                          >
                            {step.title}
                          </label>
                          <div className="text-sm text-muted-foreground">{step.body}</div>
                        </div>

                        {step.critical && (
                          <p className="flex gap-2 rounded border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">
                            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                            <span>{step.critical}</span>
                          </p>
                        )}

                        {step.expected && (
                          <div className="text-xs text-muted-foreground">
                            <span className="font-medium">Expected output: </span>
                            <code className="break-all">{step.expected}</code>
                          </div>
                        )}

                        {step.sql && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleCopy(step)}
                            className="w-full sm:w-auto"
                          >
                            {copiedFile === step.file ? (
                              <>
                                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                                Copied {step.file}
                              </>
                            ) : (
                              <>
                                <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
                                Copy {step.file}
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              What changed, and why is this needed?
            </summary>
            <div className="space-y-2 pt-2 text-muted-foreground">
              <p>
                Keyper used to identify you by a username typed into the app, and
                the database rules that shipped with it applied broadly rather than
                to the signed-in owner. So the database was not enforcing the
                separation the app assumed.
              </p>
              <p>
                Now you sign in to a real account, the database checks it on every
                request, and your vault key is stored encrypted under your master
                passphrase. These steps move your existing data onto that setup.
              </p>
            </div>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
