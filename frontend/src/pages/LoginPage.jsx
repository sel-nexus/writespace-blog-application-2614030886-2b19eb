/** Offer explicit demo sign-in with truthful persistence and credential feedback. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { SignIn } from '@phosphor-icons/react';
import FormField from '../components/FormField';
import DemoNotice from '../components/DemoNotice';
import { login } from '../utils/accountEntry';
import { buttonStyles, dashboardHref, focusRing, headingFont, isSession } from '../utils/ui';

/**
 * Render stable controlled credentials or redirect an existing identity by role.
 * Args:
 *   props (Object): Optional session read by the route shell.
 * Returns:
 *   JSX.Element: Login form or role-appropriate redirect.
 */
export default function LoginPage({ session = null }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /**
   * Validate required inputs and establish identity only on submit.
   * Args:
   *   event (Object): Form submission to prevent native navigation.
   * Returns:
   *   void: Show errors or navigate after successful session persistence.
   */
  function submit(event) {
    event.preventDefault();
    const nextFields = {};
    if (!username.trim()) nextFields.username = 'Username is required.';
    if (!password.trim()) nextFields.password = 'Password is required.';
    setFields(nextFields);
    setError('');
    if (Object.keys(nextFields).length) return;
    const result = login(username, password);
    if (result.ok) navigate(result.navigateTo);
    else setError(result.error.message);
  }

  if (isSession(session)) return <Navigate to={dashboardHref(session)} replace />;
  return (
    <main className="mx-auto max-w-lg px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-700">Your writing space</p>
        <h1 className={`text-4xl text-slate-900 ${headingFont}`}>Welcome back</h1>
        <p className="mt-3 text-slate-600">Sign in to read, write, and share your next story.</p>
      </div>
      <form noValidate onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <FormField
          id="username"
          label="Username"
          value={username}
          onChange={event => setUsername(event.target.value)}
          autoComplete="username"
          error={fields.username}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={event => setPassword(event.target.value)}
          autoComplete="current-password"
          error={fields.password}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        )}
        <button type="submit" className={`w-full ${buttonStyles.primary}`}>
          <SignIn size={20} aria-hidden="true" />
          Sign In
        </button>
        <p className="text-center text-sm text-slate-600">
          New to WriteSpace?{' '}
          <Link to="/register" className={`rounded font-medium text-indigo-700 underline ${focusRing}`}>Create an account</Link>
        </p>
      </form>
      <p className="my-6 text-sm text-slate-600">Try the demo Admin: username <strong>admin</strong>, password <strong>admin</strong>.</p>
      <DemoNotice />
    </main>
  );
}

LoginPage.propTypes = { session: PropTypes.object };
