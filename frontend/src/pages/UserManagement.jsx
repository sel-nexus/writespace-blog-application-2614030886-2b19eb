/** Manage local demo accounts through explicit creation and confirmed deletion. */
import { useState } from 'react';
import { UserPlus } from '@phosphor-icons/react';
import FormField from '../components/FormField';
import UserRow from '../components/UserRow';
import { DEFAULT_ADMIN } from '../utils/accountEntry';
import { getSession } from '../utils/auth';
import { getUsers } from '../utils/storage';
import { adminCreateUser, adminDeleteUser, isCompleteUser, userDeletionReason as protection } from '../utils/adminUsers';
import { buttonStyles, focusRing, headingFont, isSession } from '../utils/ui';

const emptyForm = { displayName: '', username: '', password: '', role: 'user' };

/**
 * Project public account fields without copying credentials into component state or props.
 * Returns:
 *   Array: Fixed Admin with no invented date, followed by complete local account projections.
 */
function accounts() {
  return [{ id: DEFAULT_ADMIN.userId, displayName: DEFAULT_ADMIN.displayName,
    username: DEFAULT_ADMIN.username, role: DEFAULT_ADMIN.role },
  ...getUsers().filter(isCompleteUser).filter(row => row.id !== DEFAULT_ADMIN.userId)
    .map(({ id, displayName, username, role, createdAt }) => ({ id, displayName, username, role, createdAt }))];
}

/** Render complete creation and equivalent responsive listings.
 * Returns: JSX.Element: Safe errors and persistence-gated feedback.
 * Notes: Re-read identity on activation; never write on render or switch sessions.
 */
export default function UserManagement() {
  const [rows, setRows] = useState(accounts);
  const [current, setCurrent] = useState(getSession);
  const [form, setForm] = useState({ ...emptyForm });
  const [fields, setFields] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  /** Reject stale non-Admin identity before workflow or confirmation.
   * Returns: Object|null: Current Admin identity or null with safe feedback.
   */
  function actor() {
    const fresh = getSession();
    setCurrent(fresh);
    setSuccess('');
    setError('');
    if (isSession(fresh) && fresh.role === 'admin') return fresh;
    setError('Only an Admin can manage accounts.');
    return null;
  }

  /** Persist only on submit; retain input on failure.
   * Args: event (Event): Explicit form submission.
   * Returns: void: Refresh and clear only after successful storage.
   */
  function create(event) {
    event.preventDefault();
    setFields({});
    const session = actor();
    if (!session) return;
    const result = adminCreateUser(form, session);
    if (!result.ok) {
      setFields(result.fields || (result.error.field ? { [result.error.field]: result.error.message } : {}));
      setError(result.error.message);
      return;
    }
    setRows(accounts());
    setForm({ ...emptyForm });
    setSuccess('Account created. The current session has not changed.');
  }

  /** Confirm eligible targets using fresh identity.
   * Args: id (string): Selected public account identifier.
   * Returns: void: Retain on cancel/failure; refresh only after saved removal.
   */
  function remove(id) {
    const session = actor();
    if (!session) return;
    const reason = protection(id, session);
    if (reason) { setError(reason); return; }
    if (!window.confirm('Delete this demo account? This cannot be undone.')) return;
    const fresh = getSession();
    const result = adminDeleteUser(id, fresh, true);
    setCurrent(fresh);
    if (!result.ok) { setError(result.error.message); return; }
    setRows(accounts());
    setSuccess('Account deleted.');
  }

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-5 py-10 sm:px-8">
      <h1 className={`text-4xl text-slate-900 ${headingFont}`}>User Management</h1>
      <section aria-labelledby="create-account-heading" className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 id="create-account-heading" className="mb-4 text-xl font-semibold">Create account</h2>
        <p className="mb-6 text-sm text-slate-600">
          Demo only: passwords are stored in plaintext in this browser’s local storage. Roles are client-side
          and can be altered. Do not enter real passwords or sensitive data. Creation does not sign in the new account.
        </p>
        <form noValidate onSubmit={create} className="grid gap-5 sm:grid-cols-2">
          {['displayName', 'username', 'password'].map(key => (
            <FormField
              key={key} id={`create-${key}`} label={{ displayName: 'Display name', username: 'Username', password: 'Demo password' }[key]}
              type={key === 'password' ? 'password' : 'text'} value={form[key]} error={fields[key]}
              onChange={event => setForm({ ...form, [key]: event.target.value })}
            />
          ))}
          <div className="space-y-2">
            <label htmlFor="create-role" className="block text-sm font-medium">Role</label>
            <select
              id="create-role" value={form.role} required aria-required="true" aria-invalid={Boolean(fields.role)}
              aria-describedby={fields.role ? 'create-role-error' : undefined}
              onChange={event => setForm({ ...form, role: event.target.value })}
              className={`min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 ${focusRing}`}
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            {fields.role && <p id="create-role-error" role="alert" className="text-sm text-red-700">{fields.role}</p>}
          </div>
          <button type="submit" className={`${buttonStyles.primary} sm:col-span-2 sm:justify-self-start`}>
            <UserPlus size={20} aria-hidden="true" />
            Create account
          </button>
        </form>
      </section>
      {error && <p role="alert" className="text-red-700">{error}</p>}
      {success && <p role="status" className="text-emerald-700">{success}</p>}
      <section aria-labelledby="accounts-heading">
        <h2 id="accounts-heading" className="mb-4 text-2xl font-semibold">Accounts</h2>
        <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white sm:block">
          <table className="w-full text-sm">
            <caption className="p-4 text-left text-slate-600">Local demo accounts, including the fixed Admin</caption>
            <thead>
              <tr>
                {['Avatar', 'Display name', 'Username', 'Role', 'Created', 'Action'].map(label => (
                  <th key={label} scope="col" className="p-4 text-left font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(account => (
                <UserRow key={account.id} account={account} disabledReason={protection(account.id, current)} onDelete={remove} />
              ))}
            </tbody>
          </table>
        </div>
        <ul aria-label="Account cards" className="space-y-4 sm:hidden">
          {rows.map(account => (
            <UserRow key={account.id} account={account} mobile disabledReason={protection(account.id, current)} onDelete={remove} />
          ))}
        </ul>
      </section>
    </main>
  );
}
