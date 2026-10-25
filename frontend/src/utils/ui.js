/** Share Tailwind roles and pure, defensive publication projections. */

export const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2';
export const headingFont = 'font-[Georgia,serif]';
const buttonBase = `inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2 font-medium ${focusRing}`;
export const buttonStyles = {
  primary: `${buttonBase} bg-indigo-600 text-white shadow-sm hover:bg-indigo-700 motion-safe:transition-colors`,
  secondary: `${buttonBase} border border-indigo-200 bg-white text-indigo-700 hover:bg-indigo-50`,
  ghost: `${buttonBase} text-slate-600 hover:bg-slate-100`,
  destructive: `${buttonBase} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`,
};
export const postAccents = [
  'border-indigo-500',
  'border-violet-500',
  'border-pink-500',
  'border-teal-500',
];
export const sessionPropShape = {
  // Component modules attach PropTypes; keep this utility JSX- and dependency-free.
  fields: ['userId', 'username', 'displayName'],
  roles: ['admin', 'user'],
};

/**
 * Check that a post can be safely displayed by publication pages.
 * Args:
 *   row (unknown): A potentially malformed member of a stored array.
 * Returns:
 *   boolean: Whether required text, identity and date fields are usable.
 */
export function isPost(row) {
  return row !== null && typeof row === 'object' && !Array.isArray(row)
    && ['id', 'title', 'content', 'createdAt', 'authorId', 'authorName'].every(
      key => typeof row[key] === 'string' && row[key].trim().length > 0,
    )
    && Number.isFinite(Date.parse(row.createdAt));
}

/**
 * Project valid posts in stable newest-first order without mutating input.
 * Args:
 *   rows (unknown): Browser records to validate at the projection boundary.
 * Returns:
 *   Array: Valid posts ordered by recency, preserving input order on date ties.
 */
export function newestFirst(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter(isPost).map((post, index) => ({ post, index }))
    .sort((left, right) => Date.parse(right.post.createdAt) - Date.parse(left.post.createdAt)
      || left.index - right.index)
    .map(({ post }) => post);
}

/**
 * Format a stored date consistently without throwing on malformed values.
 * Args:
 *   value (unknown): Stored creation date.
 * Returns:
 *   string: English month, two-digit day and year, or an unavailable label.
 */
export function formatDate(value) {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) return 'Date unavailable';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(value));
}

/**
 * Limit plain-text previews to the supplied character budget.
 * Args:
 *   content (unknown): Stored plain text; never interpreted as HTML.
 *   limit (number): Nonnegative integer character budget, defaulting to 120.
 * Returns:
 *   string: At most the budget's characters, without an appended ellipsis.
 */
export function excerpt(content, limit = 120) {
  if (typeof content !== 'string') return '';
  const budget = Number.isInteger(limit) && limit >= 0 ? limit : 120;
  return content.slice(0, budget);
}

/**
 * Validate the temporary local session used by discovery navigation.
 * Args:
 *   value (unknown): Decoded session data.
 * Returns:
 *   boolean: Whether all required identity fields and a supported role exist.
 */
export function isSession(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && sessionPropShape.fields.every(
      key => typeof value[key] === 'string' && value[key].trim().length > 0,
    )
    && sessionPropShape.roles.includes(value.role);
}

/**
 * Choose the public dashboard destination for a validated session.
 * Args:
 *   session (Object|null): Current demo session.
 * Returns:
 *   string: Admin dashboard for Admin, otherwise the blog list.
 */
export function dashboardHref(session) {
  return session?.role === 'admin' ? '/admin' : '/blogs';
}
