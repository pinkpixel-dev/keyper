/**
 * Authentication and row ownership.
 *
 * Keyper supports three storage providers and they do not share a security
 * model, so ownership is resolved per provider rather than assumed:
 *
 *   supabase  Real accounts. Ownership is auth.uid() from the session JWT, and
 *             every RLS policy scopes on it. The anon key alone reads nothing.
 *   sqlite    A local file on the user's own machine. The filesystem is the
 *             boundary; a login prompt would add nothing. Ownership is a local
 *             label.
 *   neon      The browser holds a full Postgres connection string, which is a
 *             complete database credential. RLS cannot constrain it and neither
 *             can a login prompt. Ownership is a local label, and this mode is
 *             documented as single-operator only.
 *
 * Made with ❤️ by Pink Pixel ✨
 */

import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import {
  getAuthClient,
  getDatabaseProvider,
  getCurrentUsername,
  saveCurrentUsername,
} from './client';

/** Ownership label used by the local-only providers. */
export const LOCAL_OWNER_ID = 'self-hosted-user';

/**
 * Whether this provider authenticates users at all.
 * Only Supabase has a server-side security boundary worth gating.
 */
export function isAuthRequired(): boolean {
  return getDatabaseProvider() === 'supabase';
}

/**
 * The column that carries ownership for the active provider.
 *
 * Supabase uses owner_id, a real uuid tied to auth.users and enforced by RLS.
 * The local providers still use the original user_id text column; there is no
 * server to enforce anything, so renaming it would be churn without benefit.
 */
export function ownerColumn(): 'owner_id' | 'user_id' {
  return isAuthRequired() ? 'owner_id' : 'user_id';
}

/**
 * Current session, or null. Never throws.
 */
export async function getSession(): Promise<Session | null> {
  if (!isAuthRequired()) return null;

  const { data, error } = await getAuthClient().auth.getSession();
  if (error) {
    console.error('Error reading auth session:', error);
    return null;
  }
  return data.session;
}

/**
 * Current user, or null.
 */
export async function getCurrentUser(): Promise<User | null> {
  if (!isAuthRequired()) return null;

  const { data, error } = await getAuthClient().auth.getUser();
  if (error) {
    // A missing session is normal, not worth logging as an error.
    return null;
  }
  return data.user;
}

/**
 * Resolve the owner id for the active provider, or null if not signed in.
 */
export async function getOwnerId(): Promise<string | null> {
  if (!isAuthRequired()) {
    return getCurrentUsername() || LOCAL_OWNER_ID;
  }

  const session = await getSession();
  return session?.user?.id ?? null;
}

/**
 * Resolve the owner id, throwing if there is no session.
 *
 * Every read and write goes through this. Throwing rather than falling back to
 * a default is deliberate: a silent fallback is exactly how the old code ended
 * up treating unauthenticated requests as a valid user.
 */
export async function requireOwnerId(): Promise<string> {
  const ownerId = await getOwnerId();

  if (!ownerId) {
    throw new Error('Not signed in. Please sign in to access your vault.');
  }

  return ownerId;
}

/**
 * Ownership fields to stamp onto a row being written.
 *
 * On Supabase this sets owner_id, which is the column RLS enforces, plus
 * user_id as a human-readable label. On the local providers only user_id
 * exists. Every insert goes through here so no call site has to remember which
 * column carries authority.
 */
export async function ownershipFields(): Promise<Record<string, string>> {
  const ownerId = await requireOwnerId();

  if (ownerColumn() === 'owner_id') {
    return { owner_id: ownerId, user_id: await getDisplayName() };
  }

  return { user_id: ownerId };
}

/**
 * Human-readable label for the current account. Display only.
 */
export async function getDisplayName(): Promise<string> {
  if (!isAuthRequired()) {
    return getCurrentUsername() || LOCAL_OWNER_ID;
  }

  const user = await getCurrentUser();
  const metadataName = user?.user_metadata?.display_name;

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }

  return user?.email ?? LOCAL_OWNER_ID;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
  /** True when the project requires email confirmation before first sign-in. */
  needsEmailConfirmation: boolean;
}

/**
 * Create an account.
 */
export async function signUp(
  email: string,
  password: string,
  displayName?: string,
): Promise<AuthResult> {
  const { data, error } = await getAuthClient().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: displayName?.trim() ? { display_name: displayName.trim() } : undefined,
    },
  });

  if (error) {
    throw new Error(translateAuthError(error.message));
  }

  if (data.user && displayName?.trim()) {
    saveCurrentUsername(displayName.trim());
  }

  return {
    user: data.user,
    session: data.session,
    // Supabase returns a user with no session when confirmations are on.
    needsEmailConfirmation: Boolean(data.user) && !data.session,
  };
}

/**
 * Sign in to an existing account.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await getAuthClient().auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) {
    throw new Error(translateAuthError(error.message));
  }

  return { user: data.user, session: data.session, needsEmailConfirmation: false };
}

/**
 * Sign out and drop the local session.
 */
export async function signOut(): Promise<void> {
  const { error } = await getAuthClient().auth.signOut();
  if (error) {
    throw new Error(`Sign out failed: ${error.message}`);
  }
}

/**
 * Send a password reset email.
 *
 * Worth being clear about what this does and does not do: it resets the
 * ACCOUNT password, which controls access to the rows. It does not touch the
 * master passphrase, which is what actually decrypts the vault and cannot be
 * reset by anyone.
 */
export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await getAuthClient().auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) {
    throw new Error(translateAuthError(error.message));
  }
}

/**
 * Subscribe to sign-in and sign-out. Returns an unsubscribe function.
 */
export function onAuthStateChange(
  callback: (event: AuthChangeEvent, session: Session | null) => void,
): () => void {
  if (!isAuthRequired()) {
    return () => undefined;
  }

  const { data } = getAuthClient().auth.onAuthStateChange(callback);
  return () => data.subscription.unsubscribe();
}

/**
 * Turn Supabase's auth errors into something a user can act on.
 */
function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (normalized.includes('email not confirmed')) {
    return 'Check your inbox and confirm your email address first.';
  }
  if (normalized.includes('already registered') || normalized.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (normalized.includes('password should be at least')) {
    return 'That password is too short. Use at least 6 characters.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many requests')) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (normalized.includes('signups not allowed') || normalized.includes('signup is disabled')) {
    return 'Sign-ups are disabled on this Supabase project. Enable them under Authentication > Providers.';
  }

  return message;
}
