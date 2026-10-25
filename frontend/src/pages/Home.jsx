/** Present the authenticated browser-local collection without mutating records. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { BookOpen, PenNib } from '@phosphor-icons/react';
import BlogCard from '../components/BlogCard';
import { getPosts } from '../utils/storage';
import { buttonStyles, headingFont, newestFirst } from '../utils/ui';

/**
 * Render all usable posts in stable newest-first order.
 * Args:
 *   props (Object): Validated identity supplied by the protected route shell.
 * Returns:
 *   JSX.Element: Responsive collection or the exact empty message and write link.
 * Notes:
 *   Storage is read on entry/render and never repaired or changed here.
 */
export default function Home({ session = null }) {
  const posts = newestFirst(getPosts());
  return (
    <main className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">The local collection</p>
      <h1 className={`mb-8 mt-3 text-4xl text-slate-900 sm:text-5xl ${headingFont}`}>All Blogs</h1>
      {posts.length ? (
        <section aria-label="Blog collection" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post, index) => (
            <BlogCard key={`${post.id}-${index}`} post={post} index={index} session={session} />
          ))}
        </section>
      ) : (
        <section aria-label="Empty collection" className="rounded-xl bg-white p-8 sm:p-12">
          <BookOpen size={36} className="text-indigo-600" aria-hidden="true" />
          <p className={`mt-5 text-2xl text-slate-800 ${headingFont}`}>
            No blogs yet. Be the first to write one!
          </p>
          <Link to="/write" className={`mt-6 ${buttonStyles.primary}`}>
            <PenNib size={20} aria-hidden="true" /> Write a Blog
          </Link>
        </section>
      )}
    </main>
  );
}

Home.propTypes = { session: PropTypes.object };
