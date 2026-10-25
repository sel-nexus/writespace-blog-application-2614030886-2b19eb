/** Create browser-local demo accounts through a stable, accessible controlled form. */
import { useState } from 'react';
import PropTypes from 'prop-types';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from '@phosphor-icons/react';
import FormField from '../components/FormField';
import DemoNotice from '../components/DemoNotice';
import { registerUser } from '../utils/accountEntry';
import { buttonStyles, dashboardHref, focusRing, headingFont, isSession } from '../utils/ui';

/**
 * Render registration feedback without claiming completion after a partial save.
 * Args:
 *   props (Object): Optional session from the route shell.
 * Returns:
 *   JSX.Element: Registration form or existing-session role redirect.
 */
export default function RegisterPage({ session = null }) {
  const [values, setValues] = useState({ displayName: '', username: '', password: '', confirmPassword: '' });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const navigate = useNavigate();

  /**
   * Submit current values to the registration workflow on explicit activation.
   * Args:
   *   event (Object): Form submission to prevent native navigation.
   * Returns:
   *   void: Display associated failures or navigate only after both writes succeed.
   */
  function submit(event) {
    event.preventDefault();
    const result = registerUser(values);
    setFields({});
    setError('');
    if (result.ok) {
      navigate(result.navigateTo);
      return;
    }
    if (result.fields) setFields(result.fields);
    else if (result.error.field) setFields({ [result.error.field]: result.error.message });
    else setError(result.error.message);
  }

  /**
   * Update one controlled field without replacing the rendered input node.
   * Args:
   *   event (Object): Input change carrying its stable field name and text.
   * Returns:
   *   void: Replace only the edited value in component state.
   */
  function change(event) {
    setValues({ ...values, [event.target.name]: event.target.value });
  }

  if (isSession(session)) return <Navigate to={dashboardHref(session)} replace />;
  return (
    <main className="mx-auto max-w-lg px-5 py-12 sm:px-8 sm:py-16">
      <div className="mb-8">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-indigo-700">Begin a new chapter</p>
        <h1 className={`text-4xl text-slate-900 ${headingFont}`}>Create your account</h1>
        <p className="mt-3 text-slate-600">A place for your ideas, one story at a time.</p>
      </div>
      <form noValidate onSubmit={submit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <FormField
          id="displayName"
          label="Display name"
          value={values.displayName}
          onChange={change}
          autoComplete="nickname"
          error={fields.displayName}
        />
        <FormField
          id="username"
          label="Username"
          value={values.username}
          onChange={change}
          autoComplete="username"
          error={fields.username}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={values.password}
          onChange={change}
          autoComplete="new-password"
          error={fields.password}
        />
        <FormField
          id="confirmPassword"
          label="Confirm password"
          type="password"
          value={values.confirmPassword}
          onChange={change}
          autoComplete="new-password"
          error={fields.confirmPassword}
        />
        {error && (
          <p role="alert" className="text-sm text-red-700">{error}</p>
        )}
        <button type="submit" className={`w-full ${buttonStyles.primary}`}>
          <UserPlus size={20} aria-hidden="true" />
          Create Account
        </button>
        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className={`rounded font-medium text-indigo-700 underline ${focusRing}`}>Sign in</Link>
        </p>
      </form>
      <div className="mt-6"><DemoNotice /></div>
    </main>
  );
}

RegisterPage.propTypes = { session: PropTypes.object };
