/**
 * SignInForm - account sign-in
 *
 * This is the account password, which decides which rows the database will let
 * you read. It is not the master passphrase, which decrypts them. Two different
 * secrets doing two different jobs, and the copy here works hard to keep that
 * distinction visible rather than blurring them together.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signIn, sendPasswordReset } from '@/integrations/supabase/auth';
import { useToast } from '@/hooks/use-toast';
import { AlertTriangle, Eye, EyeOff, KeyRound, LogIn, Loader2 } from 'lucide-react';

interface SignInFormProps {
  onSwitchToSignUp: () => void;
}

// No onSignedIn callback: AuthGate subscribes to auth state changes, so a
// successful sign-in propagates on its own. An extra callback would just be a
// second path to the same state update.
export default function SignInForm({ onSwitchToSignUp }: SignInFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

  const { toast } = useToast();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      await signIn(email, password);
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then request a reset.');
      return;
    }

    setResetting(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      toast({
        title: 'Reset email sent',
        description: 'This resets your account password only. Your master passphrase is unaffected.',
      });
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not send reset email.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" />
          Sign in to Keyper
        </CardTitle>
        <CardDescription>
          Your vault is locked to your account. Signing in is what lets the database
          hand over your rows at all.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="signin-email">Email</Label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="username"
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              aria-invalid={Boolean(error)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signin-password">Account password</Label>
            <div className="relative">
              <Input
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Your account password"
                disabled={busy}
                className="pr-10"
                aria-invalid={Boolean(error)}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Signing in...
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" aria-hidden="true" />
                Sign in
              </>
            )}
          </Button>

          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={onSwitchToSignUp}
              className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              Create an account
            </button>
            <button
              type="button"
              onClick={() => void handleReset()}
              disabled={resetting}
              className="text-muted-foreground underline-offset-4 hover:underline disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              {resetting ? 'Sending...' : 'Forgot account password?'}
            </button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
