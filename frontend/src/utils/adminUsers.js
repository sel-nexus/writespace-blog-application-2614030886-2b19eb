/** Create and delete local demo accounts only after explicit validated Admin actions. */
import { getUsers, saveUsers } from './storage';
import { getSession } from './auth';
import { DEFAULT_ADMIN } from './accountEntry';
import { isSession } from './ui';

const labels = { displayName: 'Display name', username: 'Username', password: 'Demo password' };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Explain protection for a displayed or freshly selected account.
 * Args:
 *   id (string): Target identifier.
 *   current (Object|null): Observable local identity.
 * Returns:
 *   string: Default/active protection reason, or empty for eligible accounts.
 */
export function userDeletionReason(id, current) {
  if (id === DEFAULT_ADMIN.userId) return 'Default admin cannot be deleted.';
  return id === current?.userId ? 'Active accounts cannot be deleted.' : '';
}

/**
 * Check a complete account before selecting it for display or removal.
 * Args:
 *   row (unknown): Candidate browser record, including demo credential metadata.
 * Returns:
 *   boolean: Whether every required field and supported role is usable.
 */
export function isCompleteUser(row) {
  return row !== null && typeof row === 'object' && !Array.isArray(row)
    && ['id', 'displayName', 'username', 'password', 'createdAt'].every(
      key => typeof row[key] === 'string' && Boolean(row[key].trim()),
    )
    && ['admin', 'user'].includes(row.role) && Number.isFinite(Date.parse(row.createdAt));
}

/**
 * Describe a rejection without echoing submitted credentials.
 * Args:
 *   code (string): Failure category.
 *   message (string): Safe recovery explanation.
 *   field (string|undefined): Optional form field association.
 * Returns:
 *   Object: Unsuccessful result with no persistence claim.
 */
function failure(code, message, field) {
  return { ok: false, error: { code, message, ...(field ? { field } : {}) } };
}

/**
 * Create a full account without changing the current session.
 * Args:
 *   input (unknown): Required display name, exact username, demo password and role.
 *   session (unknown): Caller identity, freshly read by the UI at submission.
 *   deps (Object): Optional getUsers, saveUsers, randomUUID and now boundaries.
 * Returns:
 *   Object: Saved User or safe validation/capability/storage error; never raises.
 * Notes:
 *   Preserve submitted strings and other records; generate UUID and ISO date only here.
 */
export function adminCreateUser(input, session, deps = {}) {
  if (!isSession(session) || session.role !== 'admin') {
    return failure('UNAUTHORIZED', 'Only an Admin can manage accounts.');
  }
  const fields = {};
  for (const [field, label] of Object.entries(labels)) {
    if (typeof input?.[field] !== 'string' || !input[field].trim()) fields[field] = `${label} is required.`;
  }
  if (!['admin', 'user'].includes(input?.role)) fields.role = 'Choose Admin or User.';
  const first = Object.keys(fields)[0];
  if (first) return { ...failure('INVALID_INPUT', fields[first], first), fields };
  if (input.username === DEFAULT_ADMIN.username) {
    return failure('RESERVED_USERNAME', 'This username is reserved.', 'username');
  }
  try {
    const users = (deps.getUsers || getUsers)();
    if (!Array.isArray(users)) return failure('INVALID_RECORDS', 'Could not read accounts in this browser.');
    if (users.some(row => row?.username === input.username)) {
      return failure('USERNAME_TAKEN', 'This username is already taken.', 'username');
    }
    let id;
    try {
      id = (deps.randomUUID || (() => globalThis.crypto.randomUUID()))();
      if (typeof id !== 'string' || !uuidPattern.test(id)) throw new Error('Unavailable UUID');
    } catch {
      return failure('UUID_UNAVAILABLE', 'This browser cannot generate an account UUID. Please try another browser.');
    }
    if (users.some(row => row?.id === id)) {
      return failure('DUPLICATE_ID', 'Could not generate a unique account ID. Please try again.');
    }
    let createdAt;
    try {
      createdAt = (deps.now || (() => new Date().toISOString()))();
      if (typeof createdAt !== 'string' || new Date(createdAt).toISOString() !== createdAt) {
        throw new Error('Unavailable date');
      }
    } catch {
      return failure('TIME_UNAVAILABLE', 'Could not determine the account creation date. Please try again.');
    }
    const user = { id, displayName: input.displayName, username: input.username,
      password: input.password, role: input.role, createdAt };
    if ((deps.saveUsers || saveUsers)([...users, user]) !== true) {
      return failure('STORAGE_WRITE_FAILED', 'Could not save this account in this browser. Please try again.');
    }
    return { ok: true, value: user };
  } catch {
    return failure('STORAGE_WRITE_FAILED', 'Could not save this account in this browser. Please try again.');
  }
}

/**
 * Remove one complete, unambiguous, inactive account after explicit confirmation.
 * Args:
 *   id (unknown): Exact target account identifier.
 *   session (unknown): Caller identity; its account is always protected.
 *   confirmed (unknown): Must be the boolean true, not a truthy substitute.
 *   deps (Object): Optional getUsers, saveUsers and getSession boundaries.
 * Returns:
 *   Object: Success or safe rejection; invalid targets and failed writes never mutate arrays.
 * Notes:
 *   The single named session key exposes the current account, not a session registry.
 */
export function adminDeleteUser(id, session, confirmed, deps = {}) {
  if (!isSession(session) || session.role !== 'admin') {
    return failure('UNAUTHORIZED', 'Only an Admin can manage accounts.');
  }
  if (typeof id !== 'string' || !id.trim()) return failure('INVALID_ID', 'Choose a valid account.');
  if (id === DEFAULT_ADMIN.userId) return failure('DEFAULT_ADMIN_PROTECTED', 'Default admin cannot be deleted.');
  try {
    const current = (deps.getSession || getSession)();
    if (id === session.userId || id === current?.userId) {
      return failure('ACTIVE_ACCOUNT_PROTECTED', 'Active accounts cannot be deleted.');
    }
    if (confirmed !== true) return failure('CONFIRMATION_REQUIRED', 'Confirm account deletion first.');
    const users = (deps.getUsers || getUsers)();
    if (!Array.isArray(users)) return failure('INVALID_RECORDS', 'Could not read accounts in this browser.');
    const matches = users.filter(row => row?.id === id);
    if (!matches.length) return failure('NOT_FOUND', 'Account not found.');
    if (matches.length !== 1 || !isCompleteUser(matches[0])) {
      return failure('INVALID_RECORD', 'This account record is invalid or ambiguous. No account was deleted.');
    }
    if ((deps.saveUsers || saveUsers)(users.filter(row => row?.id !== id)) !== true) {
      return failure('STORAGE_WRITE_FAILED', 'Could not delete this account in this browser. Please try again.');
    }
    return { ok: true, value: null };
  } catch {
    return failure('STORAGE_WRITE_FAILED', 'Could not delete this account in this browser. Please try again.');
  }
}
