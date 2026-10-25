/** Show browser-local Admin metrics and delegate any-author post deletion. */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Article, Users, ShieldCheck, Question, PenNib, PencilSimple, Trash } from '@phosphor-icons/react';
import StatCard from '../components/StatCard';
import { getPosts, getUsers } from '../utils/storage';
import { getSession } from '../utils/auth';
import { deletePost } from '../utils/posts';
import { buttonStyles, focusRing, formatDate, headingFont, isSession, newestFirst } from '../utils/ui';

/**
 * Check complete stored account fields without repairing browser records.
 * Args:
 *   row (unknown): Candidate stored account.
 * Returns:
 *   boolean: Whether all required fields and the supported role are usable.
 */
function isCompleteAccount(row) {
  return row !== null && typeof row === 'object' && !Array.isArray(row)
    && ['id', 'displayName', 'username', 'password', 'createdAt'].every(
      key => typeof row[key] === 'string' && row[key].trim().length > 0,
    )
    && ['admin', 'user'].includes(row.role)
    && Number.isFinite(Date.parse(row.createdAt));
}

/**
 * Render four approved metrics, two shortcuts, and up to five newest posts.
 * Returns:
 *   JSX.Element: Admin overview with all-post access and truthful deletion feedback.
 * Notes:
 *   AdminRoute owns access. Only successful deletion refreshes the local post view;
 *   every deletion checks fresh identity and records through the shared helper.
 */
export default function AdminDashboard() {
  const [posts, setPosts] = useState(() => newestFirst(getPosts()));
  const [error, setError] = useState('');
  const usersCount = getUsers().filter(isCompleteAccount).length + 1;

  /**
   * Confirm a selected post removal and persist with current local identity.
   * Args:
   *   id (string): Selected post identifier.
   * Returns:
   *   void: Refresh only after persistence; retain the view on cancel or failure.
   */
  function remove(id) {
    if (window.confirm('Delete this post? This cannot be undone.') !== true) {
      setError('Deletion cancelled. No changes were made.');
      return;
    }
    const current = getSession();
    if (!isSession(current) || current.role !== 'admin') {
      setError('Sign in as Admin to manage posts. No changes were made.');
      return;
    }
    const result = deletePost(id, current, true);
    if (!result.ok) {
      setError(result.error.message);
      return;
    }
    setPosts(newestFirst(getPosts()));
    setError('');
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <header className="rounded-xl bg-gradient-to-r from-violet-700 to-indigo-700 p-6 text-white sm:p-10">
        <h1 className={`text-4xl leading-tight sm:text-5xl ${headingFont}`}>Admin Dashboard</h1>
        <p className="mt-4 max-w-2xl leading-relaxed">An overview of this browser’s posts and local demo accounts.</p>
      </header>

      <section aria-label="Dashboard statistics" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard value={posts.length} label="Total Posts" icon={<Article size={24} />} />
        <StatCard value={usersCount} label="Total Users" icon={<Users size={24} />} />
        <StatCard value="—" label="Total Admins" icon={<ShieldCheck size={24} />} />
        <StatCard value="—" label="Total users" icon={<Question size={24} />} />
      </section>
      <p className="mt-4 text-sm leading-relaxed text-slate-600">
        Total Posts counts valid displayed posts. Total Users counts complete stored accounts plus the fixed Admin.
        {' '}Total Admins and Total users are undefined in the approved scope, so they show — rather than invented counts.
      </p>

      <section aria-labelledby="quick-actions-heading" className="mt-10">
        <h2 id="quick-actions-heading" className={`text-2xl text-slate-900 ${headingFont}`}>Quick Actions</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <Link to="/write" className={buttonStyles.primary}>
            <PenNib size={20} aria-hidden="true" /> Write New Post
          </Link>
          <Link to="/users" className={buttonStyles.secondary}>
            <Users size={20} aria-hidden="true" /> Manage Users
          </Link>
        </div>
      </section>

      <section aria-labelledby="recent-posts-heading" className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-posts-heading" className={`text-3xl text-slate-900 ${headingFont}`}>Recent Posts</h2>
          <Link to="/blogs" className={buttonStyles.secondary}>All Blogs</Link>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        {posts.length === 0 ? (
          <p className="mt-6 rounded-xl bg-white p-6 text-slate-600">No posts yet.</p>
        ) : (
          <ul className="mt-6 divide-y divide-slate-100 rounded-xl bg-white">
            {posts.slice(0, 5).map(post => (
              <li key={post.id} className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className={`break-words text-xl text-slate-900 ${headingFont}`}>
                    <Link to={`/blog/${encodeURIComponent(post.id)}`} className={`rounded hover:text-indigo-700 ${focusRing}`}>
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-2 break-words text-sm text-slate-600">
                    {post.authorName} · <time dateTime={post.createdAt}>{formatDate(post.createdAt)}</time>
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Link to={`/edit/${encodeURIComponent(post.id)}`} className={buttonStyles.secondary}>
                    <PencilSimple size={20} aria-hidden="true" /> Edit
                  </Link>
                  <button type="button" onClick={() => remove(post.id)} className={buttonStyles.destructive}>
                    <Trash size={20} aria-hidden="true" /> Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
