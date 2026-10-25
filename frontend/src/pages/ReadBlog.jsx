/** Resolve a protected post and render its complete content as escaped plain text. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PencilSimple, Trash } from '@phosphor-icons/react';
import Avatar from '../components/Avatar';
import { authorRole } from '../components/BlogCard';
import { canEditPost, deletePost } from '../utils/posts';
import { getSession } from '../utils/auth';
import { getPosts } from '../utils/storage';
import { buttonStyles, focusRing, formatDate, headingFont, isPost } from '../utils/ui';

/**
 * Render exact-id detail or an actionable missing-record view.
 * Args:
 *   props (Object): Local identity supplied by the protected route shell.
 * Returns:
 *   JSX.Element: Full escaped text, attribution, and authorized edit link, or not found.
 * Notes:
 *   Reads never write; confirmed deletion rechecks current identity and persisted posts.
 */
export default function ReadBlog({ session = null }) {
  const { id } = useParams();
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const post = getPosts().find(row => isPost(row) && row.id === id);

  /**
   * Confirm an explicit deletion and recheck the current storage-backed policy.
   * Returns:
   *   void: Navigate only after persistence, retaining failure feedback otherwise.
   */
  function remove() {
    if (window.confirm('Delete this post? This cannot be undone.') !== true) return;
    const result = deletePost(id, getSession(), true);
    if (result.ok) navigate(result.navigateTo);
    else setError(result.error.message);
  }
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <Link to="/blogs" className={`inline-flex min-h-11 items-center gap-2 rounded text-indigo-700 ${focusRing}`}>
        <ArrowLeft size={20} aria-hidden="true" /> Back to All Blogs
      </Link>
      {error && <p role="alert" className="mt-6 text-sm text-red-700">{error}</p>}
      {post ? (
        <article className="mx-auto mt-8 max-w-3xl rounded-xl bg-white p-6 sm:p-10">
          <h1 className={`break-words text-4xl leading-tight text-slate-900 sm:text-5xl ${headingFont}`}>
            {post.title}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-3 border-b border-slate-100 pb-6">
            <Avatar role={authorRole(post.authorId)} />
            <span className="break-words font-medium text-slate-700">{post.authorName}</span>
            <time dateTime={post.createdAt} className="text-sm text-slate-600">
              {formatDate(post.createdAt)}
            </time>
          </div>
          <div className="mt-8 whitespace-pre-wrap break-words text-lg leading-relaxed text-slate-700">
            {post.content}
          </div>
          {canEditPost(post, session) && (
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={`/edit/${encodeURIComponent(post.id)}`} className={buttonStyles.secondary}>
                <PencilSimple size={20} aria-hidden="true" /> Edit
              </Link>
              <button type="button" onClick={remove} className={buttonStyles.destructive}>
                <Trash size={20} aria-hidden="true" /> Delete
              </button>
            </div>
          )}
        </article>
      ) : (
        <h1 className={`mt-8 text-4xl text-slate-900 ${headingFont}`}>Post not found</h1>
      )}
    </main>
  );
}

ReadBlog.propTypes = { session: PropTypes.object };
