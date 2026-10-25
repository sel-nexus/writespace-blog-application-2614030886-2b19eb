/** Introduce the browser-local publication and project up to three real posts. */
import PropTypes from 'prop-types';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, PenNib, Desktop, Lightning } from '@phosphor-icons/react';
import DemoNotice from '../components/DemoNotice';
import { getPosts } from '../utils/storage';
import {
  buttonStyles, dashboardHref, excerpt, focusRing, formatDate, headingFont, newestFirst, postAccents,
} from '../utils/ui';

const features = [
  { title: 'Write Freely', Icon: PenNib, text: 'Plain-text writing, without distractions. Give your ideas room to breathe.' },
  { title: 'Private & Local', Icon: Desktop, text: 'Your data lives in this browser, not on a shared server. Local does not mean confidential.' },
  { title: 'Instant & Fast', Icon: Lightning, text: 'No application server to wait for. Move simply between reading and writing.' },
];

/**
 * Render editorial discovery using only real local post previews.
 * Args:
 *   props (Object): Optional validated local session for reading and dashboard destinations.
 * Returns:
 *   JSX.Element: Hero, three features, latest posts or exact empty state, notice and footer.
 * Notes:
 *   Projection validates records and never mutates or repairs stored data.
 */
export default function LandingPage({ session = null }) {
  const previews = newestFirst(getPosts()).slice(0, 3);
  return (
    <>
      <main>
        <section aria-labelledby="hero-title" className="bg-white">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-8 sm:py-28 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="mb-6 text-xs font-semibold uppercase tracking-[0.25em] text-indigo-700">
                A little room for big ideas
              </p>
              <h1 id="hero-title" className={`text-5xl leading-tight tracking-tight text-slate-900 sm:text-7xl ${headingFont}`}>
                WriteSpace
              </h1>
              <p className={`mt-6 max-w-2xl text-3xl leading-snug text-slate-800 sm:text-4xl ${headingFont}`}>
                Your thoughts. Your space. Beautifully simple.
              </p>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
                A simple place to read, write and return to your ideas. Start with a story,
                or a blank page. Keep it all in this browser.
              </p>
              <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
                <Link to={session ? '/blogs' : '/login'} className={buttonStyles.primary}>
                  Start Reading <ArrowRight size={20} aria-hidden="true" />
                </Link>
                <Link
                  to={session ? dashboardHref(session) : '/register'}
                  className={buttonStyles.secondary}
                >
                  {session ? 'Go to Dashboard' : 'Get Started Free'}
                </Link>
              </div>
            </div>
            <div aria-hidden="true" className="hidden border-l border-indigo-200 pl-8 lg:col-span-4 lg:block">
              <PenNib size={64} weight="duotone" className="text-indigo-600" />
              <p className={`mt-8 text-3xl leading-relaxed text-slate-700 ${headingFont}`}>
                Space to think.<br />Words to keep.
              </p>
              <div className="mt-8 h-1 w-16 bg-violet-600" />
              <p className="mt-4 text-xs uppercase tracking-widest text-slate-500">Your browser. Your pages.</p>
            </div>
          </div>
        </section>

        <section aria-label="Features" className="mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid gap-8 lg:grid-cols-3">
            {features.map(({ title, Icon, text }) => (
              <article key={title} className="border-t border-slate-200 pt-6">
                <Icon size={28} className="mb-4 text-indigo-600" aria-hidden="true" />
                <h2 className={`text-2xl text-slate-900 ${headingFont}`}>{title}</h2>
                <p className="mt-3 leading-relaxed text-slate-600">{text}</p>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="latest-title" className="mx-auto max-w-6xl px-5 pb-16 sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-700">The local collection</p>
          <h2 id="latest-title" className={`mb-8 mt-3 text-3xl text-slate-900 sm:text-4xl ${headingFont}`}>
            Latest from the Blog
          </h2>
          {previews.length ? (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {previews.map((post, index) => (
                <article key={`${post.id}-${index}`} className={`rounded-xl border-t-4 bg-white ${postAccents[index]}`}>
                  <Link
                    to={`/blog/${encodeURIComponent(post.id)}`}
                    className={`block h-full rounded-xl p-6 hover:bg-indigo-50 motion-safe:transition-colors ${focusRing}`}
                  >
                    <time dateTime={post.createdAt} className="text-sm text-slate-600">{formatDate(post.createdAt)}</time>
                    <h3 className={`mt-3 break-words text-2xl text-slate-900 ${headingFont}`}>{post.title}</h3>
                    <p className="mt-4 break-words leading-relaxed text-slate-600">{excerpt(post.content)}</p>
                    <span className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-indigo-700">
                      Read post <ArrowRight size={16} aria-hidden="true" />
                    </span>
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-start gap-4 rounded-xl bg-white p-8 sm:flex-row sm:items-center">
              <BookOpen size={32} className="shrink-0 text-indigo-600" aria-hidden="true" />
              <p className="text-lg text-slate-600">No posts yet — check back soon!</p>
            </div>
          )}
          <div className="mt-10"><DemoNotice /></div>
        </section>
      </main>
      <footer className="bg-slate-900 text-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <p className="text-sm">© {new Date().getFullYear()} WriteSpace</p>
          <nav aria-label="Footer navigation" className="flex flex-wrap gap-5 text-sm">
            <Link to="/" className={`rounded hover:text-white ${focusRing}`}>Home</Link>
            <Link to="/blogs" className={`rounded hover:text-white ${focusRing}`}>All Blogs</Link>
            <Link to="/login" className={`rounded hover:text-white ${focusRing}`}>Login</Link>
            <Link to="/register" className={`rounded hover:text-white ${focusRing}`}>Register</Link>
          </nav>
        </div>
      </footer>
    </>
  );
}

LandingPage.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
