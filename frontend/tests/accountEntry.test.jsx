/** Verify account forms, route gates, navigation, and activation-only session changes. */
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import App from '../src/App';
import ProtectedRoute from '../src/components/ProtectedRoute';
import AdminRoute from '../src/components/AdminRoute';
import Navbar from '../src/components/Navbar';
import FormField from '../src/components/FormField';
import LoginPage from '../src/pages/LoginPage';
import RegisterPage from '../src/pages/RegisterPage';
import { getSession, setSession } from '../src/utils/auth';
import { getUsers, saveUsers } from '../src/utils/storage';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';

const regular = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };
const stored = {
  id: 'u1', username: 'mina', displayName: 'Mina', password: 'demo-only', role: 'user', createdAt: '2026-01-15T00:00:00.000Z',
};
const protectedPaths = ['/blogs', '/blog/p1', '/write', '/edit/p1'];
const adminPaths = ['/admin', '/users'];

/** Render real components with destination markers confined to the unit test boundary. */
function EntryShell({ entry }) {
  const { pathname } = useLocation();
  const session = getSession();
  return (
    <>
      <output aria-label="Current route">{pathname}</output>
      {session && <Navbar session={session} />}
      <Routes>
        <Route path="/login" element={<LoginPage session={session} />} />
        <Route path="/register" element={<RegisterPage session={session} />} />
        <Route path="/" element={<h1>Public home</h1>} />
        <Route path="*" element={<h1>{entry} destination</h1>} />
      </Routes>
    </>
  );
}

/** Mount the account flow without inventing application pages scheduled for later slices. */
function renderEntry(path = '/login') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <EntryShell entry={path} />
    </MemoryRouter>,
  );
}

/** Fill the registration form through its accessible field labels. */
async function fillRegistration(actor, username = 'mina', confirmation = 'demo-only') {
  await actor.type(screen.getByLabelText('Display name'), 'Mina');
  await actor.type(screen.getByLabelText('Username'), username);
  await actor.type(screen.getByLabelText('Password'), 'demo-only');
  await actor.type(screen.getByLabelText('Confirm password'), confirmation);
}

/** Fill credentials through controlled inputs before activating submit. */
async function fillLogin(actor, username = 'mina', password = 'demo-only') {
  await actor.type(screen.getByLabelText('Username'), username);
  await actor.type(screen.getByLabelText('Password'), password);
}

describe('FormField', () => {
  it('associates label, required input and alert, then removes stale error association', () => {
    const change = vi.fn();
    const { rerender } = render(<FormField id="name" label="Name" value="Mina" onChange={change} error="Required" />);
    const field = screen.getByLabelText('Name');
    expect(field).toBeRequired();
    expect(field).toHaveAttribute('aria-required', 'true');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Required');
    expect(screen.getByRole('alert')).toHaveAttribute('id', 'name-error');
    fireEvent.change(field, { target: { value: 'New' } });
    expect(change).toHaveBeenCalled();
    rerender(<FormField id="name" label="Name" value="New" onChange={change} />);
    expect(screen.getByLabelText('Name')).toBe(field);
    expect(field).toHaveValue('New');
    expect(field).toHaveAttribute('aria-invalid', 'false');
    expect(field).not.toHaveAttribute('aria-describedby');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('registration form', () => {
  it('shows all required errors without writes and retains stable controlled inputs during typing', async () => {
    const actor = userEvent.setup();
    renderEntry('/register');
    const name = screen.getByLabelText('Display name');
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getAllByRole('alert')).toHaveLength(4);
    for (const label of ['Display name', 'Username', 'Password', 'Confirm password']) {
      expect(screen.getByLabelText(label)).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByLabelText(label)).toHaveAccessibleDescription(/required/);
    }
    await actor.type(name, 'Mina');
    expect(screen.getByLabelText('Display name')).toBe(name);
    expect(name).toHaveFocus();
    expect(name).toHaveValue('Mina');
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });
  it.each([
    ['mina', 'different', 'Passwords do not match.', 'Confirm password'],
    ['admin', 'demo-only', 'This username is reserved.', 'Username'],
    ['taken', 'demo-only', 'This username is already taken.', 'Username'],
  ])('shows %s rejection inline without navigation or session', async (username, confirmation, message, label) => {
    saveUsers([{ ...stored, username: 'taken' }]);
    const actor = userEvent.setup();
    renderEntry('/register');
    await fillRegistration(actor, username, confirmation);
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByRole('alert')).toHaveTextContent(message);
    expect(screen.getByLabelText(label)).toHaveAccessibleDescription(message);
    expect(getUsers()).toHaveLength(1);
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
  });
  it('creates complete browser records and navigates only after successful submit', async () => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('new-user');
    const actor = userEvent.setup();
    renderEntry('/register');
    await fillRegistration(actor);
    expect(getUsers()).toEqual([]);
    expect(getSession()).toBeNull();
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession()).toEqual({ ...regular, userId: 'new-user' });
    expect(getUsers()[0]).toEqual({ ...stored, id: 'new-user', createdAt: getUsers()[0].createdAt });
    expect(new Date(getUsers()[0].createdAt).toISOString()).toBe(getUsers()[0].createdAt);
  });
  it.each(['account', 'session', 'UUID'])('retains form with truthful %s failure and no redirect', async boundary => {
    const actor = userEvent.setup();
    renderEntry('/register');
    await fillRegistration(actor);
    const original = Storage.prototype.setItem;
    if (boundary === 'UUID') vi.stubGlobal('crypto', {});
    else vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (boundary === 'account' || key === 'writespace_session') throw new Error('Denied');
      original.call(this, key, value);
    });
    await actor.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(screen.getByRole('alert')).toHaveTextContent(boundary === 'session'
      ? /account may exist.*sign-in did not complete.*Sign in later/
      : boundary === 'UUID' ? /browser cannot create an account/ : /Could not save your account/);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/register');
    expect(screen.getByLabelText('Username')).toHaveValue('mina');
    expect(getUsers()).toHaveLength(boundary === 'session' ? 1 : 0);
    expect(getSession()).toBeNull();
  });
  it('links to sign-in and displays the truthful local demo limitation', async () => {
    const actor = userEvent.setup();
    renderEntry('/register');
    expect(screen.getByLabelText('Local demo limitations')).toHaveTextContent(/plaintext credentials/);
    await actor.click(screen.getByRole('link', { name: 'Sign in' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });
});

describe('login form', () => {
  it('associates both required errors and does not submit empty credentials', async () => {
    const actor = userEvent.setup();
    renderEntry();
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(screen.getByLabelText('Username')).toHaveAccessibleDescription('Username is required.');
    expect(screen.getByLabelText('Password')).toHaveAccessibleDescription('Password is required.');
    expect(getSession()).toBeNull();
  });
  it.each(['Username', 'Password'])('rejects whitespace-only %s and clears stale errors on corrected submit', async label => {
    saveUsers([stored]);
    const actor = userEvent.setup();
    renderEntry();
    await fillLogin(actor);
    await actor.clear(screen.getByLabelText(label));
    await actor.type(screen.getByLabelText(label), '   ');
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByRole('alert')).toHaveTextContent(`${label} is required.`);
    await actor.clear(screen.getByLabelText(label));
    await actor.type(screen.getByLabelText(label), label === 'Username' ? 'mina' : 'demo-only');
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession()).toEqual(regular);
  });
  it('shows exact invalid credentials and preserves input nodes until correction', async () => {
    saveUsers([stored]);
    const actor = userEvent.setup();
    renderEntry();
    const password = screen.getByLabelText('Password');
    await fillLogin(actor, 'mina', 'wrong');
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/^Invalid username or password\.$/);
    expect(getSession()).toBeNull();
    expect(screen.getByLabelText('Password')).toBe(password);
    await actor.clear(password);
    await actor.type(password, 'demo-only');
    expect(password).toHaveFocus();
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(getSession()).toEqual(regular);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it.each(['user', 'admin'])('persists %s session and navigates to role destination', async role => {
    saveUsers([stored]);
    const actor = userEvent.setup();
    renderEntry();
    await fillLogin(actor, role === 'admin' ? 'admin' : 'mina', role === 'admin' ? 'admin' : 'demo-only');
    expect(getSession()).toBeNull();
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
    expect(getSession()).toEqual(role === 'admin' ? DEFAULT_ADMIN : regular);
  });
  it('keeps the sign-in form when session persistence fails', async () => {
    const actor = userEvent.setup();
    renderEntry();
    await fillLogin(actor, 'admin', 'admin');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    await actor.click(screen.getByRole('button', { name: 'Sign In' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not sign in/);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/login');
    expect(getSession()).toBeNull();
  });
  it('links to registration', async () => {
    const actor = userEvent.setup();
    renderEntry();
    await actor.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
  });
});

describe('guards and auth-page redirects', () => {
  for (const path of [...protectedPaths, ...adminPaths]) {
    it.each(['guest', 'user', 'admin'])(`${path} enforces the complete %s access decision`, async role => {
      const session = role === 'guest' ? null : role === 'admin' ? DEFAULT_ADMIN : regular;
      const Guard = adminPaths.includes(path) ? AdminRoute : ProtectedRoute;
      render(
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path={path} element={<Guard session={session}><h1>Authorized content</h1></Guard>} />
            <Route path="/login" element={<h1>Guest login destination</h1>} />
            <Route path="/blogs" element={<h1>Regular-user destination</h1>} />
          </Routes>
        </MemoryRouter>,
      );
      const expected = role === 'guest' ? 'Guest login destination'
        : adminPaths.includes(path) && role === 'user' ? 'Regular-user destination' : 'Authorized content';
      expect(await screen.findByRole('heading', { name: expected })).toBeInTheDocument();
      expect(localStorage.getItem('writespace_session')).toBeNull();
    });
  }
  it.each([ProtectedRoute, AdminRoute])('treats invalid session as guest in %s', async Guard => {
    render(
      <MemoryRouter initialEntries={['/protected']}>
        <Routes>
          <Route path="/protected" element={<Guard session={{ role: 'admin' }}><h1>Denied content</h1></Guard>} />
          <Route path="/login" element={<h1>Login destination</h1>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', { name: 'Login destination' })).toBeInTheDocument();
    expect(screen.queryByText('Denied content')).not.toBeInTheDocument();
  });
  for (const path of ['/login', '/register']) {
    it.each(['user', 'admin'])(`${path} redirects existing %s identity without mutation`, role => {
      const session = role === 'admin' ? DEFAULT_ADMIN : regular;
      setSession(session);
      const raw = localStorage.getItem('writespace_session');
      const write = vi.spyOn(Storage.prototype, 'setItem');
      const remove = vi.spyOn(Storage.prototype, 'removeItem');
      renderEntry(path);
      expect(screen.getByLabelText('Current route')).toHaveTextContent(role === 'admin' ? '/admin' : '/blogs');
      expect(localStorage.getItem('writespace_session')).toBe(raw);
      expect(write).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });
  }
});

describe('authenticated navigation', () => {
  it.each(['user', 'admin'])('renders only %s links and toggles account and mobile disclosures', async role => {
    setSession(role === 'admin' ? DEFAULT_ADMIN : regular);
    const actor = userEvent.setup();
    renderEntry('/blogs');
    expect(screen.getByRole('link', { name: 'All Blogs' })).toHaveAttribute('href', '/blogs');
    expect(screen.getByRole('link', { name: 'Write' })).toHaveAttribute('href', '/write');
    if (role === 'admin') expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
    else expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'WriteSpace' })).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
    const account = screen.getByRole('button', { name: /Account for/ });
    expect(account).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await actor.click(account);
    expect(account).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: 'Dashboard' })).toHaveAttribute('href', role === 'admin' ? '/admin' : '/blogs');
    await actor.keyboard('{Escape}');
    expect(account).toHaveAttribute('aria-expanded', 'false');
    await actor.click(account);
    await actor.click(account);
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument();
    await actor.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await actor.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(getSession().role).toBe(role);
  });
  it('closes disclosures on navigation without changing session', async () => {
    setSession(regular);
    const actor = userEvent.setup();
    renderEntry('/blogs');
    await actor.click(screen.getByRole('button', { name: 'Open menu' }));
    await actor.click(screen.getByRole('button', { name: /Account for/ }));
    await actor.click(screen.getByRole('link', { name: 'Write' }));
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/write');
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: /Account for/ })).toHaveAttribute('aria-expanded', 'false');
    expect(getSession()).toEqual(regular);
  });
  it('logs out only on activation, removes only session, and navigates home', async () => {
    setSession(regular);
    saveUsers([stored]);
    localStorage.setItem('writespace_posts', '[{"id":"p1"}]');
    const actor = userEvent.setup();
    renderEntry('/blogs');
    expect(getSession()).toEqual(regular);
    await actor.click(screen.getByRole('button', { name: /Account for/ }));
    expect(getSession()).toEqual(regular);
    await actor.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('heading', { name: 'Public home' })).toBeInTheDocument();
    expect(getSession()).toBeNull();
    expect(getUsers()).toEqual([stored]);
    expect(localStorage.getItem('writespace_posts')).toBe('[{"id":"p1"}]');
  });
  it('rereads current identity on logout failure, stays signed in, and allows later retry', async () => {
    setSession(regular);
    const actor = userEvent.setup();
    renderEntry('/blogs');
    await actor.click(screen.getByRole('button', { name: /Account for/ }));
    setSession(DEFAULT_ADMIN);
    const remove = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    await actor.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not sign out Admin.*still signed in/);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(getSession()).toEqual(DEFAULT_ADMIN);
    remove.mockRestore();
    await actor.click(screen.getByRole('button', { name: 'Logout' }));
    expect(getSession()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Public home' })).toBeInTheDocument();
  });
  it('uses the displayed identity for failure copy when current session is no longer readable', async () => {
    setSession(regular);
    const actor = userEvent.setup();
    renderEntry('/blogs');
    await actor.click(screen.getByRole('button', { name: /Account for/ }));
    localStorage.setItem('writespace_session', 'broken');
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('Denied'); });
    await actor.click(screen.getByRole('button', { name: 'Logout' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/Could not sign out Mina/);
    expect(screen.getByLabelText('Current route')).toHaveTextContent('/blogs');
    expect(localStorage.getItem('writespace_session')).toBe('broken');
  });
});

describe('App composition and render safety', () => {
  it('composes guest login/register through public activation and does not invent unfinished pages', async () => {
    const actor = userEvent.setup();
    render(<MemoryRouter><App /></MemoryRouter>);
    await actor.click(within(screen.getByRole('navigation', { name: 'Public navigation' })).getByRole('link', { name: 'Login' }));
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    await actor.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(screen.getByRole('heading', { name: 'Create your account' })).toBeInTheDocument();
    expect(getSession()).toBeNull();
  });
  it.each(['/login', '/register', '/blogs'])('does not write or remove storage when rendering %s in StrictMode', path => {
    if (path === '/blogs') setSession(regular);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const remove = vi.spyOn(Storage.prototype, 'removeItem');
    const clear = vi.spyOn(Storage.prototype, 'clear');
    render(
      <StrictMode>
        <MemoryRouter initialEntries={[path]}><App /></MemoryRouter>
      </StrictMode>,
    );
    expect(write).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(clear).not.toHaveBeenCalled();
    if (path === '/blogs') expect(getSession()).toEqual(regular);
  });
  it('reads malformed session without repairing it when composing login', () => {
    localStorage.setItem('writespace_session', 'broken');
    render(<MemoryRouter initialEntries={['/login']}><App /></MemoryRouter>);
    expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(localStorage.getItem('writespace_session')).toBe('broken');
  });
});
