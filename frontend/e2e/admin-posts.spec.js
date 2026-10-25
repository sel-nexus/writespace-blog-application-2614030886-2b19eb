/** Specify click-driven Admin post oversight; do not execute in this implementation slice. */
import { test, expect } from './fixtures.js';

const users = [{
  id: 'writer', displayName: 'Writer', username: 'writer', password: 'demo-only', role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
}, {
  id: 'stored-admin', displayName: 'Local Admin', username: 'local-admin', password: 'demo-only', role: 'admin',
  createdAt: '2026-01-02T00:00:00.000Z',
}];
const admin = { userId: 'writespace-admin', username: 'admin', displayName: 'Admin', role: 'admin' };
const posts = Array.from({ length: 6 }, (_, index) => ({
  id: `admin-story-${index + 1}`, title: `Admin review story ${index + 1}`,
  content: `Original body ${index + 1}\nSecond line`,
  createdAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
  authorId: 'writer', authorName: 'Writer',
}));
const rawPosts = [posts[0], null, ...posts.slice(1), { id: 'raw-row' }];

/** Seed canonical arrays once, before the first document, without resetting changes on reload. */
async function seed(page, session = null) {
  await page.addInitScript(state => {
    if (sessionStorage.getItem('admin-posts-seeded') === 'true') return;
    localStorage.setItem('writespace_posts', JSON.stringify(state.posts));
    localStorage.setItem('writespace_users', JSON.stringify(state.users));
    if (state.session) localStorage.setItem('writespace_session', JSON.stringify(state.session));
    sessionStorage.setItem('admin-posts-seeded', 'true');
  }, { posts: rawPosts, users, session });
}

/** Read complete persisted arrays and identity without calling application helpers. */
async function records(page) {
  return page.evaluate(() => ({
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
}

/** Open the real responsive navigation when the mobile disclosure is visible. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

/** Assert exact metrics, explanation, and newest-first titles rather than just page presence. */
async function dashboard(page, expectedPosts) {
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Admin Dashboard', exact: true })).toBeVisible();
  const stats = page.getByRole('region', { name: 'Dashboard statistics' });
  await expect(stats.locator('dt')).toHaveText(['Total Posts', 'Total Users', 'Total Admins', 'Total users']);
  await expect(stats.locator('dd')).toHaveText([String(expectedPosts.length), '3', '—', '—']);
  await expect(page.getByText(/Total Admins and Total users are undefined/)).toContainText('rather than invented counts');
  const recent = page.getByRole('region', { name: 'Recent Posts' });
  await expect(recent.getByRole('heading', { level: 3 })).toHaveText(
    expectedPosts.slice().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))
      .slice(0, 5).map(post => post.title),
  );
  await expect(recent.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(Math.min(5, expectedPosts.length));
  const quick = page.getByRole('region', { name: 'Quick Actions' });
  await expect(quick.getByRole('link')).toHaveCount(2);
  await expect(quick.getByRole('link', { name: 'Write New Post', exact: true })).toHaveAttribute('href', '/write');
  await expect(quick.getByRole('link', { name: 'Manage Users', exact: true })).toHaveAttribute('href', '/users');
}

/** Verify canonical records before and after a real reload at the current route. */
async function durable(page, expected, heading) {
  expect(await records(page)).toEqual(expected);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
  expect(await records(page)).toEqual(expected);
}

/** Locate the exact recent post's list item and its inline controls. */
function recentRow(page, title) {
  return page.getByRole('region', { name: 'Recent Posts' }).getByRole('listitem')
    .filter({ has: page.getByRole('heading', { level: 3, name: title, exact: true }) });
}

test('Admin login, recent five, all-post older edit/read/save, return and any-author delete persist', async ({ page }) => {
  await seed(page);
  await page.goto('/');
  expect(await records(page)).toEqual({ posts: rawPosts, users, session: null });
  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await dashboard(page, posts);
  const initial = { posts: rawPosts, users, session: admin };
  await durable(page, initial, 'Admin Dashboard');
  await dashboard(page, posts);
  await expect(page.getByRole('region', { name: 'Recent Posts' })
    .getByRole('heading', { name: posts[0].title, exact: true })).toHaveCount(0);

  await page.getByRole('region', { name: 'Recent Posts' }).getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('article')).toHaveCount(6);
  const older = page.getByRole('article').filter({ has: page.getByRole('heading', { name: posts[0].title, exact: true }) });
  await older.getByRole('link', { name: /Read post/ }).click();
  await expect(page).toHaveURL(/\/blog\/admin-story-1$/);
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(posts[0].content);
  await durable(page, initial, posts[0].title);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(/\/edit\/admin-story-1$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(posts[0].title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(posts[0].content);
  const revised = { ...posts[0], title: 'Admin revised older story', content: 'Admin revised line\n<script>literal body</script>' };
  await page.getByLabel('Title', { exact: true }).fill(revised.title);
  await page.getByLabel('Content', { exact: true }).fill(revised.content);
  expect(await records(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page).toHaveURL(/\/blog\/admin-story-1$/);
  const edited = { ...initial, posts: rawPosts.map(post => post?.id === revised.id ? revised : post) };
  await durable(page, edited, revised.title);
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(revised.content);
  await expect(page.getByRole('article')).toContainText('Writer');
  expect((await records(page)).posts[0]).toEqual(revised);

  await openNavigation(page);
  await page.getByRole('navigation', { name: 'Account navigation' }).getByRole('link', { name: 'Dashboard', exact: true }).click();
  const validEdited = [revised, ...posts.slice(1)];
  await dashboard(page, validEdited);
  const target = posts[5];
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.dismiss();
  });
  await recentRow(page, target.title).getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText('Deletion cancelled. No changes were made.');
  await dashboard(page, validEdited);
  await durable(page, edited, 'Admin Dashboard');
  await dashboard(page, validEdited);

  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.accept();
  });
  await recentRow(page, target.title).getByRole('button', { name: 'Delete', exact: true }).click();
  const deleted = { ...edited, posts: edited.posts.filter(post => post?.id !== target.id) };
  await dashboard(page, validEdited.filter(post => post.id !== target.id));
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByRole('status')).toHaveCount(0);
  await expect(recentRow(page, target.title)).toHaveCount(0);
  await expect(recentRow(page, revised.title)).toBeVisible();
  await durable(page, deleted, 'Admin Dashboard');
  await dashboard(page, validEdited.filter(post => post.id !== target.id));
  await page.getByRole('region', { name: 'Recent Posts' }).getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page.getByRole('article')).toHaveCount(5);
  await expect(page.getByRole('heading', { name: target.title, exact: true })).toHaveCount(0);
  await durable(page, deleted, 'All Blogs');
});

test('Admin Write New Post quick action validates, publishes and reads a durable Admin-authored post', async ({ page }) => {
  await seed(page);
  await page.goto('/login');
  expect(await records(page)).toEqual({ posts: rawPosts, users, session: null });
  await page.getByLabel('Username', { exact: true }).fill('admin');
  await page.getByLabel('Password', { exact: true }).fill('admin');
  await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  await dashboard(page, posts);
  const initial = { posts: rawPosts, users, session: admin };
  expect(await records(page)).toEqual(initial);

  await page.getByRole('region', { name: 'Quick Actions' })
    .getByRole('link', { name: 'Write New Post', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Write a Blog', exact: true })).toBeVisible();
  const title = page.getByLabel('Title', { exact: true });
  const content = page.getByLabel('Content', { exact: true });
  const publish = page.getByRole('button', { name: 'Publish Blog', exact: true });
  await expect(title).toHaveValue('');
  await expect(content).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('0 characters');
  await publish.click();
  await expect(page.getByRole('alert')).toHaveText(['Title is required.', 'Content is required.']);
  await expect(title).toHaveAttribute('aria-invalid', 'true');
  await expect(content).toHaveAttribute('aria-invalid', 'true');
  await expect(page).toHaveURL(/\/write$/);
  expect(await records(page)).toEqual(initial);

  const draft = { title: 'Admin quick-action publication', content: 'Admin-authored first line\n<script>literal new post body</script>' };
  await title.fill(draft.title);
  await content.fill('   ');
  await publish.click();
  await expect(page.getByRole('alert')).toHaveText('Content is required.');
  await expect(title).toHaveAttribute('aria-invalid', 'false');
  await expect(content).toHaveValue('   ');
  expect(await records(page)).toEqual(initial);
  await content.fill(draft.content);
  await expect(page.getByRole('status')).toHaveText(`${draft.content.length} characters`);
  expect(await records(page)).toEqual(initial);
  const beforeSave = await page.evaluate(() => Date.now());
  await publish.click();
  await expect(page).toHaveURL(/\/blog\/[^/]+$/);
  await expect(page.getByRole('heading', { level: 1, name: draft.title, exact: true })).toBeVisible();

  const saved = await records(page);
  expect(saved.posts).toHaveLength(rawPosts.length + 1);
  const created = saved.posts[rawPosts.length];
  expect(created).toEqual({
    ...draft, id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i),
    createdAt: expect.any(String), authorId: admin.userId, authorName: admin.displayName,
  });
  expect(rawPosts.some(post => post?.id === created.id)).toBe(false);
  expect(new Date(created.createdAt).toISOString()).toBe(created.createdAt);
  expect(Date.parse(created.createdAt)).toBeGreaterThanOrEqual(beforeSave);
  expect(Date.parse(created.createdAt)).toBeLessThanOrEqual(await page.evaluate(() => Date.now()));
  const expected = { ...initial, posts: [...rawPosts, created] };
  expect(saved).toEqual(expected);
  await expect(page).toHaveURL(new RegExp(`/blog/${created.id}$`));
  const article = page.getByRole('article');
  await expect(article.locator('.whitespace-pre-wrap')).toHaveText(draft.content);
  await expect(article.getByText(admin.displayName, { exact: true })).toBeVisible();
  await expect(article.getByRole('img', { name: 'Admin avatar', exact: true })).toBeVisible();
  await expect(article.locator('time')).toHaveAttribute('datetime', created.createdAt);
  await expect(article.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', `/edit/${created.id}`);
  await expect(article.locator('script')).toHaveCount(0);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await durable(page, expected, draft.title);
  await expect(article.locator('.whitespace-pre-wrap')).toHaveText(draft.content);
  await expect(article.locator('time')).toHaveAttribute('datetime', created.createdAt);
});

for (const session of [null, {
  userId: 'writer', username: 'writer', displayName: 'Writer', role: 'user',
}]) {
  test(`direct /admin rejects ${session ? 'regular user' : 'guest'} without record or identity changes`, async ({ page }) => {
    await seed(page, session);
    await page.goto('/admin');
    const expected = { posts: rawPosts, users, session };
    await expect(page).toHaveURL(session ? /\/blogs$/ : /\/login$/);
    await expect(page.getByRole('region', { name: 'Dashboard statistics' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Users', exact: true })).toHaveCount(0);
    await durable(page, expected, session ? 'All Blogs' : 'Welcome back');
  });
}
