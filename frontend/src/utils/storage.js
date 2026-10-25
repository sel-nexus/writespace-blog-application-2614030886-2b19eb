/** Read and explicitly save browser-local arrays without repairing stored data. */

/**
 * Read an array without changing its original stored representation.
 *
 * Args:
 *   key (string): Exact browser storage key to read.
 * Returns:
 *   Array: Parsed rows, or an empty array for missing or unusable storage.
 * Notes:
 *   Never raises and never writes; row validation belongs to projections.
 */
function readArray(key) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return [];
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

/**
 * Persist an explicitly supplied array and report completion truthfully.
 *
 * Args:
 *   key (string): Exact browser storage key to write.
 *   value (Array): Rows supplied by an accepted operation.
 * Returns:
 *   boolean: True only after serialization and storage both succeed.
 * Notes:
 *   Never raises; reject serialization that does not preserve an array shape.
 */
function writeArray(key, value) {
  if (!Array.isArray(value)) return false;
  try {
    const raw = JSON.stringify(value);
    if (typeof raw !== 'string' || !Array.isArray(JSON.parse(raw))) return false;
    localStorage.setItem(key, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read local posts without repairing malformed storage.
 * Returns:
 *   Array: Stored rows or an empty fallback; never raises.
 */
export function getPosts() {
  return readArray('writespace_posts');
}

/**
 * Save posts only on an explicit operation.
 * Args:
 *   posts (Array): Post records to serialize.
 * Returns:
 *   boolean: Whether the browser accepted the write; never raises.
 */
export function savePosts(posts) {
  return writeArray('writespace_posts', posts);
}

/**
 * Read local accounts without exposing or repairing credentials.
 * Returns:
 *   Array: Stored rows or an empty fallback; never raises.
 * Notes:
 *   Demo passwords are plaintext and must not contain real secrets.
 */
export function getUsers() {
  return readArray('writespace_users');
}

/**
 * Save local demo accounts on an explicit operation.
 * Args:
 *   users (Array): Account records with demo-only plaintext credentials.
 * Returns:
 *   boolean: Whether the browser accepted the write; never raises.
 */
export function saveUsers(users) {
  return writeArray('writespace_users', users);
}
