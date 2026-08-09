/**
 * UserRegistration - create a Keyper account
 *
 * This used to register a username with no authentication behind it, which is
 * why one user could reach another user's rows. Registration now creates a real
 * account; the master passphrase is set separately, after first sign-in, so the
 * two secrets never get entered on the same screen and confused for each other.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { signUp } from '@/integrations/supabase/auth';
import { AlertTriangle, Eye, EyeOff, Info, Loader2, UserPlus } from 'lucide-react';

interface UserRegistrationProps {
  /**
   * Called when an account was created but cannot be used yet because the
   * project requires email confirmation. The success path needs no callback:
   * AuthGate is subscribed to auth state and picks up the new session itself.
   */
  onNeedsConfirmation?: (email: string) => void;
  onSwitchToSignIn: () => void;
}

const MIN_PASSWORD_LENGTH = 8;

export default function UserRegistration({
  onNeedsConfirmation,
  onSwitchToSignIn,
}: UserRegistrationProps) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const validate = (): string | null => {
    if (!email.trim()) return 'Enter an email address.';
    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Account password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }
    if (password !== confirmPassword) return 'Passwords do not match.';
    return null;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const result = await signUp(email, password, displayName);

      if (result.needsEmailConfirmation) {
        onNeedsConfirmation?.(email.trim());
      }
    } catch (signUpError) {
      setError(signUpError instanceof Error ? signUpError.message : 'Registration failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" aria-hidden="true" />
          Create your account
        </CardTitle>
        <CardDescription>
          One account, one vault. You will set your master passphrase right after
          this.
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
            <Label htmlFor="signup-name">Display name (optional)</Label>
            <Input
              id="signup-name"
              type="text"
              autoComplete="nickname"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="What should we call you?"
              disabled={busy}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-email">Email</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              disabled={busy}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="signup-password">Account password</Label>
            <div className="relative">
              <Input
                id="signup-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
                disabled={busy}
                className="pr-10"
                required
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

          <div className="space-y-2">
            <Label htmlFor="signup-confirm">Confirm account password</Label>
            <Input
              id="signup-confirm"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Type it again"
              disabled={busy}
              required
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" aria-hidden="true" />
            <AlertDescription className="text-sm">
              This password controls access to your account. The master passphrase
              you set next is what actually encrypts your credentials, and it is
              never sent anywhere.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Creating account...
              </>
            ) : (
              <>
                <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                Create account
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              Sign in
            </button>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
