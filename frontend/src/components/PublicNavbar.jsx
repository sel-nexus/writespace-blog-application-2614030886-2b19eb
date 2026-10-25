/** Offer activation-only public navigation with a responsive role-aware menu. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation } from 'react-router-dom';
import { List, X, PenNib } from '@phosphor-icons/react';
import Avatar from './Avatar';
import { buttonStyles, dashboardHref, focusRing, headingFont } from '../utils/ui';

/**
 * Render guest entry links or a local session's dashboard action.
 * Args:
 *   props (Object): Optional validated demo session, defaulting to a guest.
 * Returns:
 *   JSX.Element: Sticky public header with a keyboard-operable mobile toggle.
 */
export default function PublicNavbar({ session = null }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Public navigation" className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex min-h-20 items-center justify-between gap-4">
          <Link to="/" className={`flex items-center gap-2 rounded text-2xl text-slate-900 ${headingFont} ${focusRing}`}>
            <PenNib size={28} className="text-indigo-600" aria-hidden="true" />
            WriteSpace
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="public-menu"
            onClick={() => setOpen(!open)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg sm:hidden ${focusRing}`}
          >
            {open ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
          </button>
          <div
            id="public-menu"
            className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-20 flex-col gap-3 border-b
              border-slate-100 bg-white p-5 shadow-sm sm:static sm:flex sm:flex-row sm:items-center
              sm:border-0 sm:p-0 sm:shadow-none`}
          >
            {session ? (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar role={session.role} />
                  <span className="max-w-48 truncate font-medium">{session.displayName}</span>
                </span>
                <Link to={dashboardHref(session)} className={buttonStyles.primary}>
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/login" className={buttonStyles.ghost}>Login</Link>
                <Link to="/register" className={buttonStyles.primary}>Get Started</Link>
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}

PublicNavbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }),
};
