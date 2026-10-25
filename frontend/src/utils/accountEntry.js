/** Validate explicit demo account submissions and persist before reporting success. */
import { getUsers, saveUsers } from './storage';
import { setSession } from './auth';
import { dashboardHref, isSession } from './ui';

export const DEFAULT_ADMIN = Object.freeze({
  userId: 'writespace-admin', username: 'admin', displayName: 'Admin', role: 'admin',
});

const labels = {
  displayName: 'Display name', username: 'Username', password: 'Password', confirmPassword: 'Confirm password',
};

/**
 * Describe a rejection without claiming navigation or successful writes.
 * Args:
 *   code (string): Machine-readable failure category.
 *   message (string): Non-secret recovery copy.
 *   field (string|undefined): Optional input association.
 *   accountWritten (boolean): Whether registration already saved an account.
 * Returns:
 *   Object: Failed workflow result with explicit persistence flags.
 */
function failure(code, message, field, accountWritten = false) {
  return {
    ok: false, error: { code, message, ...(field ? { field } : {}) },
    accountWritten, sessionWritten: false, navigateTo: null,
  };
}

/**
 * Build a public session from a stored account without copying its password.
 * Args:
 *   user (Object): Candidate local account.
 * Returns:
 *   Object: Public identity fields, validated by the caller.
 */
function sessionFor(user) {
  return { userId: user.id, username: user.username, displayName: user.displayName, role: user.role };
}

/**
 * Establish a matched identity and choose its role destination only after persistence.
 * Args:
 *   session (Object): Validated identity.
 *   accountWritten (boolean): Whether a new account was saved first.
 * Returns:
 *   Object: Success with destination, or a truthful storage failure.
 */
function signIn(session, accountWritten = false) {
  if (!setSession(session)) {
    return failure('STORAGE_WRITE_FAILED', accountWritten
      ? 'Your account may exist, but sign-in did not complete. Sign in later; do not register again.'
      : 'Could not sign in in this browser. Please try again.', undefined, accountWritten);
  }
  return { ok: true, value: session, accountWritten, sessionWritten: true, navigateTo: dashboardHref(session) };
}

/**
 * Register a unique regular account after collecting all required-field errors.
 * Args:
 *   input (unknown): Display name, case-sensitive username, and matching demo passwords.
 * Returns:
 *   Object: Structured result; failures never redirect, and partial saves remain available.
 * Notes:
 *   Preserve submitted text and password case; whitespace-only values are invalid.
 *   UUID capability failures occur before either browser write.
 */
export function registerUser(input) {
  const fields = {};
  for (const field of Object.keys(labels)) {
    if (typeof input?.[field] !== 'string' || !input[field].trim()) {
      fields[field] = `${labels[field]} is required.`;
    }
  }
  const first = Object.keys(fields)[0];
  if (first) return { ...failure('REQUIRED_FIELD', fields[first], first), fields };
  if (input.password !== input.confirmPassword) {
    return failure('PASSWORD_MISMATCH', 'Passwords do not match.', 'confirmPassword');
  }
  if (input.username === 'admin') {
    return failure('RESERVED_USERNAME', 'This username is reserved.', 'username');
  }
  const users = getUsers();
  if (users.some(user => user?.username === input.username)) {
    return failure('USERNAME_TAKEN', 'This username is already taken.', 'username');
  }
  let user;
  try {
    const id = globalThis.crypto.randomUUID();
    if (typeof id !== 'string' || !id.trim()) throw new Error('Unavailable UUID');
    user = {
      id, displayName: input.displayName, username: input.username, password: input.password,
      role: 'user', createdAt: new Date().toISOString(),
    };
  } catch {
    return failure('UUID_UNAVAILABLE', 'This browser cannot create an account. Use a browser with UUID support.');
  }
  if (users.some(row => row?.id === user.id)) {
    return failure('DUPLICATE_ID', 'Could not generate a unique account ID. Please try again.');
  }
  if (!saveUsers([...users, user])) {
    return failure('STORAGE_WRITE_FAILED', 'Could not save your account in this browser. Please try again.');
  }
  return signIn(sessionFor(user), true);
}

/**
 * Match exact demo credentials, giving the fixed Admin precedence over stored collisions.
 * Args:
 *   username (unknown): Case-sensitive submitted username.
 *   password (unknown): Exact demo password; never included in feedback or sessions.
 * Returns:
 *   Object: Persisted session and role destination, or exact invalid-credential feedback.
 * Notes:
 *   Invalid input and unmatched credentials leave any existing session unchanged.
 */
export function login(username, password) {
  if (typeof username !== 'string' || !username.trim() || typeof password !== 'string' || !password.trim()) {
    return failure('INVALID_CREDENTIALS', 'Invalid username or password.');
  }
  if (username === 'admin' && password === 'admin') return signIn({ ...DEFAULT_ADMIN });
  const user = getUsers().find(row => row !== null && typeof row === 'object'
    && row.username === username && row.password === password && isSession(sessionFor(row)));
  if (!user) return failure('INVALID_CREDENTIALS', 'Invalid username or password.');
  return signIn(sessionFor(user));
}
