/** Read and explicitly change the browser-local demo session without repairing data. */
import { isSession } from './ui';

/**
 * Copy only the public identity fields into a session record.
 * Args:
 *   value (Object): Validated local identity.
 * Returns:
 *   Object: Session with no credential or extra fields.
 */
function identity(value) {
  return {
    userId: value.userId,
    username: value.username,
    displayName: value.displayName,
    role: value.role,
  };
}

/**
 * Read a valid identity without writing, clearing, or repairing browser storage.
 * Returns:
 *   Object|null: Exact session shape, or null for missing, invalid, or inaccessible data.
 */
export function getSession() {
  try {
    const value = JSON.parse(localStorage.getItem('writespace_session'));
    return isSession(value) ? identity(value) : null;
  } catch {
    return null;
  }
}

/**
 * Persist only a validated public identity on an explicit action.
 * Args:
 *   session (unknown): Candidate identity; credentials and extra fields are omitted.
 * Returns:
 *   boolean: True only after serialization and browser storage succeed; never raises.
 */
export function setSession(session) {
  try {
    if (!isSession(session)) return false;
    localStorage.setItem('writespace_session', JSON.stringify(identity(session)));
    return true;
  } catch {
    return false;
  }
}

/**
 * Remove only the active identity, leaving accounts and posts untouched.
 * Returns:
 *   boolean: Whether removal succeeded; never raises.
 */
export function clearSession() {
  try {
    localStorage.removeItem('writespace_session');
    return true;
  } catch {
    return false;
  }
}
