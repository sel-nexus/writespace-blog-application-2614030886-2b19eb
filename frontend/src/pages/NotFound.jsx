/** Provide a safe local fallback for routes not implemented or not recognized. */
import { Link } from 'react-router-dom';
import { ArrowLeft } from '@phosphor-icons/react';
import { buttonStyles, headingFont } from '../utils/ui';

/**
 * Render a local not-found page without implying a server error.
 * Returns:
 *   JSX.Element: A clear explanation and an activated link back to discovery.
 */
export default function NotFound() {
  return (
    <main className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
      <p className="text-sm font-semibold uppercase tracking-widest text-indigo-700">WriteSpace</p>
      <h1 className={`mt-4 text-4xl text-slate-900 ${headingFont}`}>Page not found</h1>
      <p className="mb-8 mt-4 text-slate-600">This page isn’t available in this writing space.</p>
      <Link to="/" className={buttonStyles.primary}>
        <ArrowLeft size={20} aria-hidden="true" />
        Back to Home
      </Link>
    </main>
  );
}
