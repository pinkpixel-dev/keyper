/**
 * Start over: delete the vault key and everything it protects.
 *
 * This is the honest replacement for the old "reset your passphrase" flow. There
 * is no way to recover a forgotten passphrase, so the only real option is to
 * start again, and that costs you the credentials. Saying so plainly is better
 * than implying a recovery path that does not exist.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { vaultManager } from '@/services/VaultManager';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';

const CONFIRM_PHRASE = 'DELETE MY VAULT';

export default function ResetVaultCard() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);

  const { toast } = useToast();

  const handleReset = async () => {
    if (confirmation !== CONFIRM_PHRASE) return;

    setBusy(true);
    try {
      await vaultManager.resetVault();
      toast({
        title: 'Vault deleted',
        description: 'Set a new master passphrase to start again.',
      });
      window.location.reload();
    } catch (error) {
      toast({
        title: 'Could not delete vault',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setBusy(false);
    }
  };

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-5 w-5 text-destructive" aria-hidden="true" />
          Forgotten your passphrase?
        </CardTitle>
        <CardDescription>
          The only option is to start over, and it costs you the credentials.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <p>
              Your credentials are encrypted with a key that only your master
              passphrase can unlock. Nothing stored in the database, and nothing we
              hold, can open it without that passphrase. That is the point of the
              design, and it means a forgotten passphrase cannot be recovered by
              anyone.
            </p>
            <p className="pt-2">
              If you still know your current passphrase and simply want a different
              one, use <strong>Change Master Passphrase</strong> above. That keeps
              all your credentials.
            </p>
          </AlertDescription>
        </Alert>

        {!open ? (
          <Button variant="outline" onClick={() => setOpen(true)}>
            I have lost my passphrase and want to start over
          </Button>
        ) : (
          <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/5 p-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>
                This deletes your vault key. Every stored credential becomes
                permanently unreadable. It cannot be undone.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="reset-confirm">
                Type <code className="font-mono">{CONFIRM_PHRASE}</code> to confirm
              </Label>
              <Input
                id="reset-confirm"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                placeholder={CONFIRM_PHRASE}
                autoComplete="off"
                disabled={busy}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={confirmation !== CONFIRM_PHRASE || busy}
                onClick={() => void handleReset()}
              >
                {busy ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Deleting...
                  </>
                ) : (
                  'Delete my vault'
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  setConfirmation('');
                }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
