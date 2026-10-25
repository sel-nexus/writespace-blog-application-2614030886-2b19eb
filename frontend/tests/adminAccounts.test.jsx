/** Exercise real account forms, safe responsive projections, guards and deletion outcomes. */
import { StrictMode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../src/App';
import { DEFAULT_ADMIN } from '../src/utils/accountEntry';
import { getSession, setSession } from '../src/utils/auth';
import { getUsers, saveUsers } from '../src/utils/storage';
const seen = vi.hoisted(() => []);
vi.mock('../src/components/UserRow', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, default: props => { seen.push(props.account); return <actual.default {...props} />; } };
});
const record = { id: 'mina', displayName: 'Mina Reader', username: 'mina', password: 'NEVER-RENDER-THIS',
  role: 'user', createdAt: '2026-01-15T12:00:00.000Z' };
const otherAdmin = { ...DEFAULT_ADMIN, userId: 'local-admin', username: 'local-admin', displayName: 'Local Admin' };

/** Seed once before mounting; render must never change browser records. */
function mount(rows = [record], session = DEFAULT_ADMIN, beforeRender = () => {}) {
  seen.length = 0; saveUsers(rows); if (session) setSession(session); beforeRender();
  return render(
    <StrictMode>
      <MemoryRouter initialEntries={['/users']}>
        <App />
      </MemoryRouter>
    </StrictMode>,
  );
}
/** Fill the complete form through accessible labels. */
async function fill(user, role = 'user', username = 'new-account') {
  await user.type(screen.getByLabelText('Display name'), 'New Writer');
  await user.type(screen.getByLabelText('Username'), username);
  await user.type(screen.getByLabelText('Demo password'), 'demo-new');
  await user.selectOptions(screen.getByLabelText('Role'), role);
}
/** Resolve desktop deletion; mobile equivalence is asserted separately. */
function remove(username = 'mina') { return within(screen.getByRole('table')).getByRole('button', { name: `Delete ${username}` }); }
/** Assert failed actions retain input/view and never announce success. */
function failed(message) {
  expect(screen.getAllByRole('alert').some(node => node.textContent.includes(message))).toBe(true);
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'User Management' })).toBeInTheDocument();
}

describe('listing and access', () => {
  it('projects safe props and equivalent scoped table/mobile fields without render mutations', () => {
    let write;
    mount([record, null, {}, { ...record, id: 'bad', createdAt: 'bad' }], DEFAULT_ADMIN, () => { write = vi.spyOn(Storage.prototype, 'setItem'); });
    const before = getUsers();
    fireEvent.change(screen.getByLabelText('Display name'), { target: { value: 'draft' } });
    const table = screen.getByRole('table'); const cards = screen.getByRole('list', { name: 'Account cards' });
    expect(table.parentElement).toHaveClass('hidden', 'sm:block'); expect(cards).toHaveClass('sm:hidden');
    expect(within(table).getByText('Local demo accounts, including the fixed Admin').tagName).toBe('CAPTION');
    expect(within(table).getAllByRole('columnheader').every(node => node.getAttribute('scope') === 'col')).toBe(true);
    for (const container of [table, cards]) {
      const scope = within(container);
      for (const text of ['Mina Reader', 'mina', 'User', 'Jan 15, 2026', 'Date unavailable']) expect(scope.getByText(text)).toBeInTheDocument();
      expect(scope.getByRole('img', { name: 'User avatar' })).toBeInTheDocument();
      expect(scope.getByRole('img', { name: 'Admin avatar' })).toBeInTheDocument();
      expect(scope.getByRole('button', { name: 'Delete admin' })).toBeDisabled();
    }
    expect(document.body.textContent).not.toContain(record.password);
    expect(seen.length).toBeGreaterThan(0); expect(seen.every(account => !('password' in account))).toBe(true);
    expect(seen.find(account => account.id === DEFAULT_ADMIN.userId)).not.toHaveProperty('createdAt');
    expect(getUsers()).toEqual(before); expect(write).not.toHaveBeenCalled();
  });
  it.each([null, { ...DEFAULT_ADMIN, role: 'user' }])('guards identity %s without writes', session => {
    mount([], session); expect(screen.queryByRole('heading', { name: 'User Management' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(session ? 'All Blogs' : 'Welcome back');
    expect(getUsers()).toEqual([]);
  });
  it.each(['{broken', '{}', 'null'])('does not repair malformed storage %s on entry', raw => {
    localStorage.setItem('writespace_users', raw); setSession(DEFAULT_ADMIN);
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<MemoryRouter initialEntries={['/users']}><App /></MemoryRouter>);
    expect(localStorage.getItem('writespace_users')).toBe(raw); expect(write).not.toHaveBeenCalled();
    expect(within(screen.getByRole('table')).getAllByRole('row')).toHaveLength(2);
  });
});

describe('creation form', () => {
  it.each(['user', 'admin'])('creates complete %s, refreshes/clears and retains current identity', async role => {
    mount(); const user = userEvent.setup(); await fill(user, role); const before = getSession();
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    const saved = getUsers()[1]; expect(saved).toMatchObject({ displayName: 'New Writer', username: 'new-account', password: 'demo-new', role });
    expect(saved.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt); expect(getSession()).toEqual(before);
    expect(remove('new-account')).toBeEnabled(); expect(screen.getByRole('status')).toHaveTextContent('Account created');
    for (const label of ['Display name', 'Username', 'Demo password']) expect(screen.getByLabelText(label)).toHaveValue('');
    expect(document.body.textContent).not.toContain('demo-new');
  });
  it('associates inline required errors and labels the role select and demo notice', async () => {
    mount(); await userEvent.setup().click(screen.getByRole('button', { name: 'Create account' }));
    for (const label of ['Display name', 'Username', 'Demo password']) {
      const field = screen.getByLabelText(label); expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(document.getElementById(field.getAttribute('aria-describedby'))).toHaveTextContent(`${label} is required.`);
    }
    expect(screen.getByLabelText('Role')).toHaveAttribute('aria-required', 'true');
    expect(screen.getByText(/Demo only:/)).toHaveTextContent(/plaintext.*local storage.*sensitive data/);
    expect(getUsers()).toEqual([record]); failed('required');
  });
  it.each(['mina', 'admin'])('retains form for duplicate/reserved %s', async username => {
    mount(); const user = userEvent.setup(); await fill(user, 'user', username);
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByLabelText('Username')).toHaveValue(username); expect(screen.getByLabelText('Username')).toHaveAttribute('aria-invalid', 'true');
    expect(getUsers()).toEqual([record]); failed(username === 'admin' ? 'reserved' : 'taken');
  });
  it('retains form and fresh unrelated accounts on failure then successful retry', async () => {
    mount(); const user = userEvent.setup(); await fill(user); saveUsers([record, { ...record, id: 'extra', username: 'extra' }]);
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error('quota'); });
    await user.click(screen.getByRole('button', { name: 'Create account' })); failed('Could not save');
    expect(screen.getByLabelText('Demo password')).toHaveValue('demo-new'); expect(getUsers()).toHaveLength(2); write.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Create account' })); expect(getUsers()).toHaveLength(3);
  });
});

describe('deletion and stale identity', () => {
  it('disables default and active accounts with exact explanations on both layouts', () => {
    mount([record, { ...record, id: otherAdmin.userId, username: otherAdmin.username, role: 'admin' }], otherAdmin);
    for (const name of ['admin', otherAdmin.username]) for (const button of screen.getAllByRole('button', { name: `Delete ${name}` })) {
      expect(button).toBeDisabled(); expect(button).toHaveAttribute('title', name === 'admin' ? 'Default admin cannot be deleted.' : 'Active accounts cannot be deleted.');
      expect(document.getElementById(button.getAttribute('aria-describedby'))).toHaveTextContent(button.title);
    }
  });
  it('cancel preserves accounts; confirmation deletes and refreshes without switching session', async () => {
    mount(); const user = userEvent.setup(); const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    await user.click(remove()); expect(getUsers()).toEqual([record]); expect(remove()).toBeEnabled();
    confirm.mockReturnValue(true); await user.click(remove()); expect(getUsers()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Delete mina' })).not.toBeInTheDocument(); expect(getSession()).toEqual(DEFAULT_ADMIN);
    expect(screen.getByRole('status')).toHaveTextContent('Account deleted');
  });
  it('retains list on failed deletion and uses a freshly read array on retry', async () => {
    mount(); vi.spyOn(window, 'confirm').mockReturnValue(true); const user = userEvent.setup();
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw Error(); });
    await user.click(remove()); failed('Could not delete'); expect(getUsers()).toEqual([record]); expect(remove()).toBeEnabled();
    write.mockRestore(); saveUsers([record, { ...record, id: 'extra', username: 'extra' }]);
    await user.click(remove()); expect(getUsers().map(row => row.id)).toEqual(['extra']); expect(remove('extra')).toBeEnabled();
  });
  it.each([['create', 'user'], ['delete', 'user'], ['create', null], ['delete', null]])('denies stale %s with %s identity', async (action, role) => {
    mount(); const user = userEvent.setup(); if (action === 'create') await fill(user);
    if (role) setSession({ ...DEFAULT_ADMIN, role }); else localStorage.removeItem('writespace_session');
    const confirm = vi.spyOn(window, 'confirm');
    await user.click(action === 'create' ? screen.getByRole('button', { name: 'Create account' }) : remove());
    failed('Only an Admin'); expect(getUsers()).toEqual([record]); expect(confirm).not.toHaveBeenCalled();
  });
  it('blocks newly active targets before confirmation', async () => {
    mount(); const confirm = vi.spyOn(window, 'confirm'); setSession({ ...DEFAULT_ADMIN, userId: record.id });
    await userEvent.setup().click(remove()); failed('Active accounts');
    expect(confirm).not.toHaveBeenCalled(); expect(getUsers()).toEqual([record]);
  });
  it.each(['user', 'admin'])('rechecks a changed %s identity after confirmation', async role => {
    mount(); vi.spyOn(window, 'confirm').mockImplementation(() => {
      setSession({ ...DEFAULT_ADMIN, userId: record.id, role }); return true;
    });
    await userEvent.setup().click(remove()); failed(role === 'user' ? 'Only an Admin' : 'Active accounts');
    expect(getUsers()).toEqual([record]);
  });
});
