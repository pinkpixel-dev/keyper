/**
 * The database setup script, for fresh installs.
 *
 * The SQL is read from the shipped sql/supabase-setup.sql at build time rather than
 * pasted in here. An earlier copy in this app drifted out of date, so people
 * pasting from Settings installed policies that the repo had already fixed.
 *
 * The old "existing database update script" section is gone. It applied a
 * credential-type change from several versions back, and on a current install it
 * only added confusion next to the 1.3.0 migration.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { getDatabaseProvider } from '@/integrations/supabase/client';
import { APP_LINKS } from '@/lib/app-info';
import setupSqlScript from '/sql/supabase-setup.sql?raw';
import neonSetupSqlScript from '/sql/neon-setup.sql?raw';
import { AlertTriangle, Check, ClipboardCopy, Database, ExternalLink } from 'lucide-react';

export default function DatabaseSqlCard() {
  const [copied, setCopied] = useState(false);
  const [showScript, setShowScript] = useState(false);

  const { toast } = useToast();
  const provider = getDatabaseProvider();

  const isNeon = provider === 'neon';
  const script = isNeon ? neonSetupSqlScript : setupSqlScript;
  const fileName = isNeon ? 'neon-setup.sql' : 'supabase-setup.sql';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({
        title: 'Could not copy',
        description: `Open sql/${fileName} in the Keyper repo instead.`,
        variant: 'destructive',
      });
    }
  };

  if (provider === 'sqlite') {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" aria-hidden="true" />
            Database Setup
          </CardTitle>
          <CardDescription>
            SQLite mode creates and updates its own schema. There is nothing to run
            here.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" aria-hidden="true" />
          Database Setup Script
        </CardTitle>
        <CardDescription>
          For setting up a brand new {isNeon ? 'Neon' : 'Supabase'} database.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <strong>New installs only.</strong> If you already have credentials
            stored, do not run this. It refuses to run on a database that contains
            data, but upgrading an existing vault uses the{' '}
            <a
              href={APP_LINKS.migrationGuide}
              target="_blank"
              rel="noreferrer noopener"
              className="underline underline-offset-4"
            >
              migration guide
            </a>{' '}
            instead.
          </AlertDescription>
        </Alert>

        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void copy()}>
            {copied ? (
              <>
                <Check className="mr-2 h-4 w-4" aria-hidden="true" />
                Copied
              </>
            ) : (
              <>
                <ClipboardCopy className="mr-2 h-4 w-4" aria-hidden="true" />
                Copy {fileName}
              </>
            )}
          </Button>

          <Button variant="ghost" onClick={() => setShowScript((shown) => !shown)}>
            {showScript ? 'Hide script' : 'View script'}
          </Button>

          {!isNeon && (
            <Button asChild variant="ghost">
              <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer noopener">
                <ExternalLink className="mr-2 h-4 w-4" aria-hidden="true" />
                Open Supabase
              </a>
            </Button>
          )}
        </div>

        {showScript && (
          <div className="max-h-80 overflow-auto rounded-lg border bg-muted/40 p-3">
            <pre className="whitespace-pre-wrap text-xs text-foreground">{script}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
