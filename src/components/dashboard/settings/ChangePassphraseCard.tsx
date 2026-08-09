/**
 * Change the master passphrase.
 *
 * This replaces the old "reset" instructions, which told people to generate a
 * bcrypt hash on a third-party website and paste it into their database. That
 * worked only because the vault key was stored separately in usable form, which
 * is exactly what 1.3.0 fixed. It also meant typing your new passphrase into
 * someone else's web page.
 *
 * Changing the passphrase re-wraps the same vault key, so nothing is
 * re-encrypted and every existing credential keeps working. It requires the
 * current passphrase, and there is no way around that by design.
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
import { analyzePassphrase } from '@/security/PassphraseValidator';
import { AlertTriangle, Check, Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';

const MIN_LENGTH = 8;

export default function ChangePassphraseCard() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);

  const { toast } = useToast();

  const analysis = next ? analyzePassphrase(next) : null;

  const validate = (): string | null => {
    if (!current) return 'Enter your current master passphrase.';
    if (next.trim().length < MIN_LENGTH) {
      return `New passphrase must be at least ${MIN_LENGTH} characters.`;
    }
    if (next !== confirm) return 'The new passphrase and confirmation do not match.';
    if (next === current) return 'The new passphrase is the same as the current one.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const problem = validate();
    if (problem) {
      setError(problem);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await vaultManager.changePassphrase(current, next);
      setChanged(true);
      setCurrent('');
      setNext('');
      setConfirm('');
      toast({
        title: 'Master passphrase changed',
        description: 'Use the new one next time you unlock. Keep a copy somewhere safe.',
      });
    } catch (changeError) {
      setError(changeError instanceof Error ? changeError.message : 'Could not change passphrase.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          Change Master Passphrase
        </CardTitle>
        <CardDescription>
          Your master passphrase is what decrypts your credentials. You can change
          it here as long as you know the current one.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <Alert>
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <AlertDescription>
            <strong>There is no reset.</strong> Nothing stored anywhere can recover
            this passphrase, which is what stops a copy of the database from
            decrypting your vault. If you lose it, the vault cannot be recovered.
            Keep a copy somewhere safe.
          </AlertDescription>
        </Alert>

        {changed && (
          <Alert>
            <Check className="h-4 w-4" aria-hidden="true" />
            <AlertDescription>
              Done. Your credentials were not re-encrypted, so everything still
              works. Use the new passphrase next time you unlock.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="current-passphrase">Current master passphrase</Label>
            <div className="relative">
              <Input
                id="current-passphrase"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={current}
                onChange={(event) => setCurrent(event.target.value)}
                disabled={busy}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShow((visible) => !visible)}
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                aria-label={show ? 'Hide passphrases' : 'Show passphrases'}
                tabIndex={-1}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-passphrase">New master passphrase</Label>
            <Input
              id="new-passphrase"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={next}
              onChange={(event) => setNext(event.target.value)}
              placeholder={`At least ${MIN_LENGTH} characters`}
              disabled={busy}
            />
            {analysis && (
              <p className="text-xs text-muted-foreground">
                Strength: <span className="font-medium">{analysis.strength}</span>
                {analysis.warnings.length > 0 && ` — ${analysis.warnings[0]}`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirm-passphrase">Confirm new master passphrase</Label>
            <Input
              id="confirm-passphrase"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              disabled={busy}
            />
          </div>

          <Button type="submit" disabled={busy} className="w-full sm:w-auto">
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Changing...
              </>
            ) : (
              'Change passphrase'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
