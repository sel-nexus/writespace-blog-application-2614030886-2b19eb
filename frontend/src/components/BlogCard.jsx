/** Project safe plain-text cards and shared read-only author/ownership cues. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowRight, PencilSimple } from '@phosphor-icons/react';
import Avatar from './Avatar';
import { DEFAULT_ADMIN } from '../utils/accountEntry';
import { getUsers } from '../utils/storage';
import {
  excerpt, focusRing, formatDate, headingFont, isPost, isSession, postAccents,
} from '../utils/ui';

/**
 * Resolve an author's visual role without copying account credentials.
 * Args:
 *   authorId (string): Attribution identity from a valid post.
 * Returns:
 *   string: Admin for the fixed Admin or a matching stored Admin; otherwise user.
 */
export function authorRole(authorId) {
  if (authorId === DEFAULT_ADMIN.userId) return 'admin';
  const account = getUsers().find(row => row && typeof row === 'object' && row.id === authorId);
  return account?.role === 'admin' ? 'admin' : 'user';
}

/**
 * Check whether the local actor may see an edit destination.
 * Args:
 *   post (unknown): Candidate publication record.
 *   session (unknown): Candidate local identity.
 * Returns:
 *   boolean: True only for a valid post and an Admin or its owner.
 * Notes:
 *   This presentation rule is not trusted authorization and performs no writes.
 */
export function canEditPost(post, session) {
  return isPost(post) && isSession(session)
    && (session.role === 'admin' || post.authorId === session.userId);
}

/**
 * Render a validated card with bounded text and a cycling accent.
 * Args:
 *   props (Object): Post, ordered index, local session, and public preview mode.
 * Returns:
 *   JSX.Element|null: A card, or nothing for a malformed record.
 * Notes:
 *   Public previews use level-three headings and never expose edit controls.
 */
export default function BlogCard({ post, index = 0, session = null, preview = false }) {
  if (!isPost(post)) return null;
  const position = Number.isInteger(index) && index >= 0 ? index : 0;
  const Heading = preview ? 'h3' : 'h2';
  return (
    <article className={`flex flex-col rounded-xl border-t-4 bg-white ${postAccents[position % 4]}`}>
      <Link
        to={`/blog/${encodeURIComponent(post.id)}`}
        className={`block flex-1 rounded-xl p-6 hover:bg-indigo-50 motion-safe:transition-colors ${focusRing}`}
      >
        <time dateTime={post.createdAt} className="text-sm text-slate-600">
          {formatDate(post.createdAt)}
        </time>
        <Heading className={`mt-3 break-words text-2xl text-slate-900 ${headingFont}`}>
          {post.title}
        </Heading>
        <p className="mt-4 break-words leading-relaxed text-slate-600">{excerpt(post.content)}</p>
        <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-700">
          Read post <ArrowRight size={16} aria-hidden="true" />
        </span>
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-6 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar role={authorRole(post.authorId)} />
          <span className="break-words text-sm text-slate-600">{post.authorName}</span>
        </div>
        {!preview && canEditPost(post, session) && (
          <Link
            to={`/edit/${encodeURIComponent(post.id)}`}
            className={`inline-flex min-h-11 items-center gap-2 rounded px-2 text-sm font-medium text-indigo-700 ${focusRing}`}
          >
            <PencilSimple size={18} aria-hidden="true" /> Edit
          </Link>
        )}
      </div>
    </article>
  );
}

BlogCard.propTypes = {
  // Accept unknown records deliberately: validation renders malformed data as nothing.
  post: PropTypes.any,
  index: PropTypes.number,
  session: PropTypes.object,
  preview: PropTypes.bool,
};
