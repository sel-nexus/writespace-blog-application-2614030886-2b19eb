/** Validate explicit browser-local post changes and persist before reporting success. */
import { getPosts, savePosts } from './storage';
import { isPost, isSession } from './ui';

/** @typedef {{ok: true, value: Object|null, persisted: true, navigateTo: string}|{ok: false, error: Object, fields?: Object, persisted: false, navigateTo: null}} Result */

/**
 * Describe a rejected operation without claiming a durable change.
 * Args:
 *   code (string): Failure category.
 *   message (string): Safe recovery message.
 * Returns:
 *   Result: Failure with no destination.
 */
function failure(code, message) {
  return { ok: false, error: { code, message }, persisted: false, navigateTo: null };
}

/**
 * Validate both required text fields without imposing a length limit.
 * Args:
 *   input (unknown): Submitted title and content.
 * Returns:
 *   Result|null: Associated errors, or null when valid.
 */
function validate(input) {
  const fields = {};
  for (const field of ['title', 'content']) {
    if (typeof input?.[field] !== 'string' || !input[field].trim()) {
      fields[field] = `${field === 'title' ? 'Title' : 'Content'} is required.`;
    }
  }
  const field = Object.keys(fields)[0];
  return field ? {
    ...failure('REQUIRED_FIELD', fields[field]), error: { code: 'REQUIRED_FIELD', message: fields[field], field }, fields,
  } : null;
}

/**
 * Check the shared owner-or-Admin rule against validated local records.
 * Args:
 *   post (unknown): Candidate post.
 *   session (unknown): Candidate public identity.
 * Returns:
 *   boolean: Whether the actor may edit or delete this post; performs no writes.
 */
export function canEditPost(post, session) {
  return isPost(post) && isSession(session)
    && (session.role === 'admin' || post.authorId === session.userId);
}

/**
 * Persist an accepted array, catching both false returns and thrown failures.
 * Args:
 *   rows (Array): Fresh rows with only the intended change.
 *   save (Function): Browser writer or optional test boundary.
 * Returns:
 *   Result|null: Failure, or null after a successful boolean write.
 */
function persist(rows, save) {
  try {
    if (save(rows) === true) return null;
  } catch {
    // A thrown writer is never a successful save.
  }
  return failure('STORAGE_WRITE_FAILED', 'Could not save this change in this browser. Please try again.');
}

/**
 * Create a post with identity from the current actor and append to fresh raw rows.
 * Args:
 *   input (unknown): Required title and content; extra fields are ignored.
 *   session (unknown): Valid public identity supplied at the action boundary.
 *   deps (Object): Optional getPosts, savePosts, uuid, and now functions for tests.
 * Returns:
 *   Result: Saved post and detail destination, or validation/capability/write error.
 */
export function createPost(input, session, deps = {}) {
  if (!isSession(session)) return failure('UNAUTHORIZED', 'Sign in to change posts.');
  const invalid = validate(input);
  if (invalid) return invalid;
  let id;
  let createdAt;
  try {
    id = (deps.uuid ?? (() => globalThis.crypto.randomUUID()))();
    if (typeof id !== 'string' || !id.trim()) throw new Error('Unavailable UUID');
  } catch {
    return failure('UUID_UNAVAILABLE', 'This browser cannot create a post. UUID support is unavailable.');
  }
  try {
    createdAt = (deps.now ?? (() => new Date().toISOString()))();
    if (typeof createdAt !== 'string' || !Number.isFinite(Date.parse(createdAt))) throw new Error('Invalid time');
  } catch {
    return failure('TIME_UNAVAILABLE', 'Could not determine the creation time. Please try again.');
  }
  const post = {
    id, title: input.title, content: input.content, createdAt,
    authorId: session.userId, authorName: session.displayName,
  };
  const rows = (deps.getPosts ?? getPosts)();
  const failed = persist([...rows, post], deps.savePosts ?? savePosts);
  return failed ?? { ok: true, value: post, persisted: true, navigateTo: `/blog/${encodeURIComponent(id)}` };
}

/**
 * Edit the first valid exact-id record, preserving all other rows and metadata.
 * Args:
 *   id (unknown): Exact stored post identifier.
 *   patch (unknown): Required replacement title/content; extra fields are ignored.
 *   session (unknown): Current public identity.
 *   deps (Object): Optional getPosts and savePosts test boundaries.
 * Returns:
 *   Result: Saved post, or missing/authorization/validation/write error.
 */
export function editPost(id, patch, session, deps = {}) {
  if (!isSession(session)) return failure('UNAUTHORIZED', 'Sign in to change posts.');
  const rows = (deps.getPosts ?? getPosts)();
  const index = rows.findIndex(row => isPost(row) && row.id === id);
  if (index < 0) return failure('NOT_FOUND', 'Post not found');
  const original = rows[index];
  if (!canEditPost(original, session)) return failure('UNAUTHORIZED', 'You cannot change this post.');
  const invalid = validate(patch);
  if (invalid) return invalid;
  const post = { ...original, title: patch.title, content: patch.content };
  const updated = rows.map((row, position) => position === index ? post : row);
  const failed = persist(updated, deps.savePosts ?? savePosts);
  return failed ?? { ok: true, value: post, persisted: true, navigateTo: `/blog/${encodeURIComponent(post.id)}` };
}

/**
 * Delete an authorized exact-id post only after explicit boolean confirmation.
 * Args:
 *   id (unknown): Exact stored identifier.
 *   session (unknown): Current public identity.
 *   confirmed (unknown): Must be the boolean true, never a truthy substitute.
 *   deps (Object): Optional getPosts and savePosts test boundaries.
 * Returns:
 *   Result: Persisted removal and list destination, or rejection without a write.
 */
export function deletePost(id, session, confirmed, deps = {}) {
  if (confirmed !== true) return failure('CONFIRMATION_REQUIRED', 'Confirm deletion before removing this post.');
  if (!isSession(session)) return failure('UNAUTHORIZED', 'Sign in to change posts.');
  const rows = (deps.getPosts ?? getPosts)();
  const post = rows.find(row => isPost(row) && row.id === id);
  if (!post) return failure('NOT_FOUND', 'Post not found');
  if (!canEditPost(post, session)) return failure('UNAUTHORIZED', 'You cannot change this post.');
  const failed = persist(rows.filter(row => row?.id !== id), deps.savePosts ?? savePosts);
  return failed ?? { ok: true, value: null, persisted: true, removedId: id, navigateTo: '/blogs' };
}
