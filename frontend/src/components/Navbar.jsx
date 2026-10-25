/** Provide role-aware navigation and activation-only local logout. */
import { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CaretDown, List, X, PenNib, SignOut } from '@phosphor-icons/react';
import Avatar from './Avatar';
import { clearSession, getSession } from '../utils/auth';
import { buttonStyles, dashboardHref, focusRing, headingFont } from '../utils/ui';

/**
 * Render authenticated links and a keyboard-operable account disclosure.
 * Args:
 *   props (Object): Valid session supplied by the route shell.
 * Returns:
 *   JSX.Element: Responsive navigation and explicit failed-logout feedback.
 * Notes:
 *   Logout re-reads identity at activation; failed removal never claims success.
 */
export default function Navbar({ session }) {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [error, setError] = useState('');
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
    setError('');
  }, [pathname]);

  /**
   * Clear only the current session after account-menu activation.
   * Returns:
   *   void: Navigate home on success or retain the signed-in view with an alert.
   */
  function logout() {
    const current = getSession();
    if (!clearSession()) {
      setError(`Could not sign out ${current?.displayName || session.displayName}. You are still signed in. Please try again.`);
      return;
    }
    navigate('/');
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-100 bg-white shadow-sm">
      <nav aria-label="Account navigation" className="mx-auto max-w-6xl px-5 sm:px-8">
        <div className="flex min-h-20 items-center justify-between gap-4">
          <Link
            to={dashboardHref(session)}
            className={`flex items-center gap-2 rounded text-2xl text-slate-900 ${headingFont} ${focusRing}`}
          >
            <PenNib size={28} className="text-indigo-600" aria-hidden="true" />
            WriteSpace
          </Link>
          <button
            type="button"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="authenticated-menu"
            onClick={() => setOpen(!open)}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg sm:hidden ${focusRing}`}
          >
            {open ? <X size={24} aria-hidden="true" /> : <List size={24} aria-hidden="true" />}
          </button>
          <div
            id="authenticated-menu"
            className={`${open ? 'flex' : 'hidden'} absolute left-0 right-0 top-20 flex-col gap-3 border-b
              border-slate-100 bg-white p-5 shadow-sm sm:static sm:flex sm:flex-row sm:items-center
              sm:border-0 sm:p-0 sm:shadow-none`}
          >
            <Link to="/blogs" className={buttonStyles.ghost}>All Blogs</Link>
            <Link to="/write" className={buttonStyles.ghost}>Write</Link>
            {session.role === 'admin' && (
              <>
                <Link to="/admin" className={buttonStyles.ghost} aria-current={pathname === '/admin' ? 'page' : undefined}>
                  Dashboard
                </Link>
                <Link to="/users" className={buttonStyles.ghost}>Users</Link>
              </>
            )}
            <div className="relative" onKeyDown={event => { if (event.key === 'Escape') setAccountOpen(false); }}>
              <button
                type="button"
                aria-label={`Account for ${session.displayName}`}
                aria-expanded={accountOpen}
                aria-controls="account-dropdown"
                onClick={() => setAccountOpen(!accountOpen)}
                className={`flex min-h-11 items-center gap-2 rounded-lg px-2 ${focusRing}`}
              >
                <Avatar role={session.role} />
                <span className="max-w-48 truncate font-medium">{session.displayName}</span>
                <CaretDown size={18} aria-hidden="true" />
              </button>
              {accountOpen && (
                <div
                  id="account-dropdown"
                  className="mt-2 flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-sm sm:absolute sm:right-0 sm:w-52"
                >
                  {session.role !== 'admin' && (
                    <Link to={dashboardHref(session)} className={buttonStyles.ghost}>Dashboard</Link>
                  )}
                  <button type="button" onClick={logout} className={buttonStyles.destructive}>
                    <SignOut size={20} aria-hidden="true" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="pb-4 text-sm text-red-700">{error}</p>
        )}
      </nav>
    </header>
  );
}

Navbar.propTypes = {
  session: PropTypes.shape({
    userId: PropTypes.string.isRequired,
    username: PropTypes.string.isRequired,
    displayName: PropTypes.string.isRequired,
    role: PropTypes.oneOf(['admin', 'user']).isRequired,
  }).isRequired,
};
