/** Resolve a protected post and render its complete content as escaped plain text. */
import PropTypes from 'prop-types';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PencilSimple } from '@phosphor-icons/react';
import Avatar from '../components/Avatar';
import { authorRole, canEditPost } from '../components/BlogCard';
import { getPosts } from '../utils/storage';
import { buttonStyles, focusRing, formatDate, headingFont, isPost } from '../utils/ui';

/**
 * Render exact-id detail or an actionable missing-record view.
 * Args:
 *   props (Object): Local identity supplied by the protected route shell.
 * Returns:
 *   JSX.Element: Full escaped text, attribution, and authorized edit link, or not found.
 * Notes:
 *   Read operations never write; deletion belongs to the later writing workflow.
 */
export default function ReadBlog({ session = null }) {
  const { id } = useParams();
  const post = getPosts().find(row => isPost(row) && row.id === id);
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <Link to="/blogs" className={`inline-flex min-h-11 items-center gap-2 rounded text-indigo-700 ${focusRing}`}>
        <ArrowLeft size={20} aria-hidden="true" /> Back to All Blogs
      </Link>
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
            <Link to={`/edit/${encodeURIComponent(post.id)}`} className={`mt-8 ${buttonStyles.secondary}`}>
              <PencilSimple size={20} aria-hidden="true" /> Edit
            </Link>
          )}
        </article>
      ) : (
        <h1 className={`mt-8 text-4xl text-slate-900 ${headingFont}`}>Post not found</h1>
      )}
    </main>
  );
}

ReadBlog.propTypes = { session: PropTypes.object };
