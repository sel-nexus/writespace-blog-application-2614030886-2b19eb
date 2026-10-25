/** Specify real account-entry journeys and the route gates wired by later feature slices. */
import { test, expect } from './fixtures.js';

const user = {
  id: 'e2e-mina', displayName: 'Mina Browser', username: 'mina-browser', password: 'demo-only',
  role: 'user', createdAt: '2026-01-15T12:00:00.000Z',
};
const userSession = { userId: user.id, username: user.username, displayName: user.displayName, role: 'user' };
const adminSession = { userId: 'writespace-admin', username: 'admin', displayName: 'Admin', role: 'admin' };

/** Open responsive navigation only when its mobile toggle is visible. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

/** Enter credentials through the visible login form and submit explicitly. */
async function signIn(page, username, password) {
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
}

/** Activate local logout through the account disclosure rather than changing storage. */
async function signOut(page) {
  await openNavigation(page);
  await page.getByRole('button', { name: /Account for/ }).click();
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Reread durable browser records rather than asserting only static UI. */
async function records(page) {
  return page.evaluate(() => ({
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
    posts: localStorage.getItem('writespace_posts'),
  }));
}

test('UI registration, reload, logout, later sign-in and logout preserve the saved account', async ({ page }, testInfo) => {
  await page.goto('/');
  await openNavigation(page);
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  await page.getByLabel('Display name', { exact: true }).fill(user.displayName);
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  const saved = await records(page);
  expect(saved.users).toHaveLength(1);
  expect(saved.users[0]).toEqual({ ...user, id: saved.users[0].id, createdAt: saved.users[0].createdAt });
  expect(saved.users[0].id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(saved.users[0].createdAt).toISOString()).toBe(saved.users[0].createdAt);
  expect(saved.session).toEqual({ ...userSession, userId: saved.users[0].id });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  expect(await records(page)).toEqual(saved);
  await signOut(page);
  expect((await records(page)).session).toBeNull();
  expect((await records(page)).users).toEqual(saved.users);
  expect((await records(page)).posts).toBe(saved.posts);
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await signIn(page, user.username, user.password);
  await expect(page).toHaveURL(/\/blogs$/);
  expect((await records(page)).session).toEqual(saved.session);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
  await openNavigation(page);
  await page.getByRole('button', { name: /Account for Mina Browser/ }).click();
  await page.screenshot({ path: testInfo.outputPath('account-menu.png'), fullPage: true });
  await page.getByRole('button', { name: 'Logout', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  expect((await records(page)).users).toEqual(saved.users);
  expect((await records(page)).session).toBeNull();
});

test('invalid credentials show the exact error and correction signs in fixed Admin first', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('writespace_users', JSON.stringify([{
      id: 'collision', username: 'admin', password: 'admin', displayName: 'Collision',
      role: 'user', createdAt: '2026-01-15T00:00:00.000Z',
    }]));
  });
  await page.goto('/login');
  await signIn(page, 'admin', 'wrong');
  await expect(page.getByRole('alert')).toHaveText('Invalid username or password.');
  await expect(page).toHaveURL(/\/login$/);
  expect((await records(page)).session).toBeNull();
  const before = (await records(page)).users;
  await signIn(page, 'admin', 'admin');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  expect((await records(page)).session).toEqual(adminSession);
  expect((await records(page)).users).toEqual(before);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Admin Dashboard', exact: true })).toBeVisible();
  expect((await records(page)).session).toEqual(adminSession);
  await signOut(page);
  expect((await records(page)).session).toBeNull();
  expect((await records(page)).users).toEqual(before);
});

test('registration required, mismatch, reserved and duplicate errors retain the form and stored records', async ({ page }) => {
  await page.addInitScript(account => { localStorage.setItem('writespace_users', JSON.stringify([account])); }, user);
  await page.goto('/register');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(4);
  await page.getByLabel('Display name', { exact: true }).fill(user.displayName);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByLabel('Confirm password', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Passwords do not match.');
  await page.getByLabel('Confirm password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is reserved.');
  await page.getByLabel('Username', { exact: true }).fill(user.username);
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('This username is already taken.');
  await expect(page).toHaveURL(/\/register$/);
  expect((await records(page)).users).toEqual([user]);
  expect((await records(page)).session).toBeNull();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
});

// Each direct-route gate gets a fresh initial entry; later reading/writing/Admin slices wire these routes.
for (const route of ['/blogs', '/blog/e2e-post', '/write', '/edit/e2e-post', '/admin', '/users']) {
  test(`guest initial entry ${route} redirects to login without creating storage`, async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
    expect(await records(page)).toEqual({ users: null, session: null, posts: null });
    await page.getByRole('link', { name: 'Create an account', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Create your account', exact: true })).toBeVisible();
  });
}

for (const route of ['/admin', '/users']) {
  test(`regular-user initial entry ${route} is denied and preserves browser identity`, async ({ page }) => {
    await page.addInitScript(({ account, session }) => {
      localStorage.setItem('writespace_users', JSON.stringify([account]));
      localStorage.setItem('writespace_session', JSON.stringify(session));
    }, { account: user, session: userSession });
    await page.goto(route);
    await expect(page).toHaveURL(/\/blogs$/);
    await expect(page.getByRole('heading', { name: 'All Blogs', exact: true })).toBeVisible();
    expect((await records(page)).session).toEqual(userSession);
    expect((await records(page)).users).toEqual([user]);
    await openNavigation(page);
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
  });
}

for (const route of ['/login', '/register']) {
  for (const role of ['user', 'admin']) {
    test(`${role} initial entry ${route} redirects by role without changing storage`, async ({ page }) => {
      const session = role === 'admin' ? adminSession : userSession;
      await page.addInitScript(identity => { localStorage.setItem('writespace_session', JSON.stringify(identity)); }, session);
      await page.goto(route);
      await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
      await expect(page.getByRole('heading', {
        name: role === 'admin' ? 'Admin Dashboard' : 'All Blogs', exact: true,
      })).toBeVisible();
      expect((await records(page)).session).toEqual(session);
      expect((await records(page)).users).toBeNull();
    });
  }
}
