/** Author full real-browser Admin account journeys; execution belongs to the parent verification phase. */
import { test, expect } from './fixtures';

/** Seed a fresh context once; reloads must not erase user-created records. */
async function seed(page) {
  await page.addInitScript(() => {
    if (localStorage.getItem('admin-accounts-seeded')) return;
    localStorage.setItem('writespace_users', '[]');
    localStorage.setItem('writespace_posts', '[]');
    localStorage.removeItem('writespace_session');
    localStorage.setItem('admin-accounts-seeded', 'true');
  });
}
/** Sign in only through the visible application form. */
async function login(page, username, password) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}
/** Open responsive navigation when needed and then the Users destination. */
async function users(page) {
  const manage = page.getByRole('link', { name: 'Manage Users', exact: true });
  if (await manage.isVisible()) await manage.click();
  else {
    const menu = page.getByRole('button', { name: 'Open menu', exact: true });
    if (await menu.isVisible()) await menu.click();
    await page.getByRole('link', { name: 'Users', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'User Management' })).toBeVisible();
}
/** Log out through the account disclosure, preserving local users. */
async function logout(page, displayName) {
  const menu = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: `Account for ${displayName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await records(page)).session).toBeNull();
}
/** Submit all approved creation fields, never generating accounts by test-side writes. */
async function create(page, username, role) {
  await page.getByLabel('Display name', { exact: true }).fill(`${username} Writer`);
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Demo password', { exact: true }).fill('demo-only');
  await page.getByLabel('Role', { exact: true }).selectOption(role);
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Account created');
  await expect(page.getByLabel('Display name', { exact: true })).toHaveValue('');
}
/** Select the visible desktop row or equivalent mobile card by its delete action. */
function deletion(page, username) {
  return page.getByRole('button', { name: `Delete ${username}`, exact: true }).and(page.locator('button:visible'));
}
/** Read exact canonical records and identity from browser storage. */
async function records(page) {
  return page.evaluate(() => ({ users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')) }));
}

 test('Admin creates both roles with full metadata and logs in each without creation switching session', async ({ page }) => {
  await seed(page); await page.goto('/');
  await login(page, 'admin', 'admin'); await users(page);
  const before = (await records(page)).session;
  await create(page, 'reader-demo', 'user'); await create(page, 'editor-demo', 'admin');
  const saved = await records(page); expect(saved.session).toEqual(before); expect(saved.users).toHaveLength(2);
  for (const [index, role] of ['user', 'admin'].entries()) {
    const account = saved.users[index];
    expect(Object.keys(account).sort()).toEqual(['createdAt', 'displayName', 'id', 'password', 'role', 'username']);
    expect(account).toMatchObject({ username: index ? 'editor-demo' : 'reader-demo', role, password: 'demo-only' });
    expect(account.displayName).toBe(`${account.username} Writer`);
    expect(account.id).toMatch(/^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i);
    expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  }
  expect(saved.users.some(account => account.id === 'writespace-admin')).toBe(false);
  await expect(page.getByText('demo-only', { exact: true })).toHaveCount(0);
  await page.reload(); expect(await records(page)).toEqual(saved);
  await logout(page, 'Admin'); await login(page, 'reader-demo', 'demo-only');
  await expect(page).toHaveURL(/\/blogs$/);
  expect((await records(page)).session).toEqual({ userId: saved.users[0].id, displayName: 'reader-demo Writer',
    username: 'reader-demo', role: 'user' });
  await logout(page, 'reader-demo Writer'); await login(page, 'editor-demo', 'demo-only');
  await expect(page).toHaveURL(/\/admin$/); await users(page);
  await expect(deletion(page, 'admin')).toBeDisabled();
  await expect(deletion(page, 'admin')).toHaveAttribute('title', 'Default admin cannot be deleted.');
  await expect(deletion(page, 'editor-demo')).toBeDisabled();
  await expect(deletion(page, 'editor-demo')).toHaveAttribute('title', 'Active accounts cannot be deleted.');
  expect((await records(page)).users).toEqual(saved.users);
});

 test('Admin cancels then confirms eligible deletion while protected identities remain intact', async ({ page }) => {
  await seed(page); await page.goto('/');
  await login(page, 'admin', 'admin'); await users(page);
  await create(page, 'temporary-demo', 'user'); await create(page, 'keeper-demo', 'admin');
  const before = await records(page);
  page.once('dialog', async dialog => { expect(dialog.type()).toBe('confirm'); await dialog.dismiss(); });
  await deletion(page, 'temporary-demo').click(); expect(await records(page)).toEqual(before);
  await expect(deletion(page, 'temporary-demo')).toBeEnabled();
  page.once('dialog', async dialog => { expect(dialog.message()).toContain('Delete this demo account?'); await dialog.accept(); });
  await deletion(page, 'temporary-demo').click(); await expect(page.getByRole('status')).toHaveText('Account deleted.');
  await expect(deletion(page, 'temporary-demo')).toHaveCount(0);
  expect(await records(page)).toEqual({ session: before.session, users: [before.users[1]] });
  await page.reload(); expect((await records(page)).users).toEqual([before.users[1]]);
  await logout(page, 'Admin'); await login(page, 'keeper-demo', 'demo-only'); await users(page);
  await expect(deletion(page, 'keeper-demo')).toBeDisabled(); await expect(deletion(page, 'admin')).toBeDisabled();
  expect((await records(page)).session.userId).toBe(before.users[1].id);
  await logout(page, 'keeper-demo Writer'); await login(page, 'temporary-demo', 'demo-only');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  expect((await records(page)).session).toBeNull();
});
