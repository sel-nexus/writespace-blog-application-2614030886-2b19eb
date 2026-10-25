/** Specify real storage-backed writing journeys; execution belongs to the parent verifier. */
import { test, expect } from './fixtures.js';

const preserved = {
  id: 'preserved-post', title: 'An existing story', content: 'Keep this body unchanged.',
  createdAt: '2026-01-15T12:00:00.000Z', authorId: 'other-author', authorName: 'Another author',
};

/** Read the real canonical browser records without calling application source APIs. */
async function records(page) {
  return page.evaluate(() => ({
    posts: JSON.parse(localStorage.getItem('writespace_posts')),
    users: JSON.parse(localStorage.getItem('writespace_users')),
    session: JSON.parse(localStorage.getItem('writespace_session')),
  }));
}

/** Open the inherited responsive navigation when its mobile toggle is visible. */
async function openNavigation(page) {
  const toggle = page.getByRole('button', { name: 'Open menu', exact: true });
  if (await toggle.isVisible()) await toggle.click();
}

/** Assert persisted records, reload, and assert the same view and records again. */
async function durable(page, expected, heading) {
  expect(await records(page)).toEqual(expected);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: heading, exact: true })).toBeVisible();
  expect(await records(page)).toEqual(expected);
}

test('register, write, read, edit-cancel, edit-save and confirmed delete persist across reloads', async ({ page }) => {
  await page.addInitScript(post => {
    if (sessionStorage.getItem('writing-seeded') === 'true') return;
    localStorage.setItem('writespace_posts', JSON.stringify([post, null, { id: 'raw-row' }]));
    sessionStorage.setItem('writing-seeded', 'true');
  }, preserved);
  await page.goto('/');
  await openNavigation(page);
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/register$/);
  const initial = await records(page);
  expect(initial).toEqual({ posts: [preserved, null, { id: 'raw-row' }], users: null, session: null });
  await page.getByLabel('Display name', { exact: true }).fill('Writing Browser');
  await page.getByLabel('Username', { exact: true }).fill('writing-browser');
  await page.getByLabel('Password', { exact: true }).fill('demo-only');
  await page.getByLabel('Confirm password', { exact: true }).fill('demo-only');
  await page.getByRole('button', { name: 'Create Account', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const registered = await records(page);
  expect(registered.users).toHaveLength(1);
  const account = registered.users[0];
  expect(account).toEqual({
    id: account.id, createdAt: account.createdAt, displayName: 'Writing Browser', username: 'writing-browser',
    password: 'demo-only', role: 'user',
  });
  expect(account.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(account.createdAt).toISOString()).toBe(account.createdAt);
  expect(registered.session).toEqual({
    userId: account.id, username: account.username, displayName: account.displayName, role: 'user',
  });
  expect(registered.posts).toEqual(initial.posts);
  await durable(page, registered, 'All Blogs');

  await openNavigation(page);
  await page.getByRole('link', { name: 'Write', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await page.getByRole('button', { name: 'Publish Blog', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveCount(2);
  expect(await records(page)).toEqual(registered);
  await page.getByLabel('Title', { exact: true }).fill('Browser writing story');
  const body = 'First browser line\nSecond browser line\n<script>literal only</script>';
  await page.getByLabel('Content', { exact: true }).fill(body);
  await expect(page.getByRole('status')).toHaveText(`${body.length} characters`);
  expect(await records(page)).toEqual(registered);
  await page.getByRole('button', { name: 'Publish Blog', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Browser writing story', exact: true })).toBeVisible();
  const created = await records(page);
  const post = created.posts.at(-1);
  expect(post).toEqual({
    id: post.id, title: 'Browser writing story', content: body, createdAt: post.createdAt,
    authorId: account.id, authorName: account.displayName,
  });
  expect(post.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(post.createdAt).toISOString()).toBe(post.createdAt);
  expect(created).toEqual({ ...registered, posts: [...registered.posts, post] });
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(body);
  await durable(page, created, post.title);

  await page.getByRole('link', { name: 'Back to All Blogs', exact: true }).click();
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: post.title, exact: true }) })
    .getByRole('link', { name: /Read post/ }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  expect(await records(page)).toEqual(created);
  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/edit/${post.id}$`));
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(post.title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(post.content);
  await page.getByLabel('Title', { exact: true }).fill('Discard this edit');
  await page.getByLabel('Content', { exact: true }).fill('Discard this body');
  await page.getByRole('link', { name: 'Cancel', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await durable(page, created, post.title);

  await page.getByRole('link', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Title', { exact: true }).fill('Revised browser story');
  await page.getByLabel('Content', { exact: true }).fill('Revised line one\nRevised line two');
  expect(await records(page)).toEqual(created);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  const revisedPost = { ...post, title: 'Revised browser story', content: 'Revised line one\nRevised line two' };
  const edited = { ...created, posts: [...registered.posts, revisedPost] };
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await durable(page, edited, revisedPost.title);
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(revisedPost.content);

  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.dismiss();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await durable(page, edited, revisedPost.title);
  page.once('dialog', async dialog => {
    expect(dialog.type()).toBe('confirm');
    expect(dialog.message()).toBe('Delete this post? This cannot be undone.');
    await dialog.accept();
  });
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await durable(page, registered, 'All Blogs');
  await expect(page.getByRole('heading', { name: revisedPost.title, exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: preserved.title, exact: true })).toBeVisible();
});

test('empty Home Write a Blog CTA creates a persisted post and collection-card Edit saves its revision through clicks', async ({ page }) => {
  const identity = { userId: 'cta-writer', username: 'cta-writer', displayName: 'CTA Writer', role: 'user' };
  await page.addInitScript(session => {
    localStorage.setItem('writespace_posts', JSON.stringify([]));
    localStorage.setItem('writespace_session', JSON.stringify(session));
  }, identity);
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { level: 1, name: 'All Blogs', exact: true })).toBeVisible();
  const initial = { posts: [], users: null, session: identity };
  expect(await records(page)).toEqual(initial);
  const empty = page.getByRole('region', { name: 'Empty collection', exact: true });
  await expect(empty).toContainText('No blogs yet. Be the first to write one!');
  await empty.getByRole('link', { name: 'Write a Blog', exact: true }).click();
  await expect(page).toHaveURL(/\/write$/);
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue('');
  await expect(page.getByRole('status')).toHaveText('0 characters');
  const body = 'Created from the empty CTA\nPersist this second line';
  await page.getByLabel('Title', { exact: true }).fill('Empty CTA story');
  await page.getByLabel('Content', { exact: true }).fill(body);
  expect(await records(page)).toEqual(initial);
  await page.getByRole('button', { name: 'Publish Blog', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Empty CTA story', exact: true })).toBeVisible();
  const created = await records(page);
  expect(created.posts).toHaveLength(1);
  const post = created.posts[0];
  expect(post).toEqual({
    id: post.id, title: 'Empty CTA story', content: body, createdAt: post.createdAt,
    authorId: identity.userId, authorName: identity.displayName,
  });
  expect(post.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  expect(new Date(post.createdAt).toISOString()).toBe(post.createdAt);
  expect(created).toEqual({ ...initial, posts: [post] });
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(body);

  await openNavigation(page);
  await page.getByRole('link', { name: 'All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  const card = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: post.title, exact: true }),
  });
  await expect(card).toHaveCount(1);
  expect(await records(page)).toEqual(created);
  await card.getByRole('link', { name: 'Edit', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/edit/${post.id}$`));
  await expect(page.getByLabel('Title', { exact: true })).toHaveValue(post.title);
  await expect(page.getByLabel('Content', { exact: true })).toHaveValue(post.content);
  await expect(page.getByRole('status')).toHaveText(`${post.content.length} characters`);
  const revised = { ...post, title: 'Card-edited CTA story', content: 'Revised through the card\nSaved second line' };
  await page.getByLabel('Title', { exact: true }).fill(revised.title);
  await page.getByLabel('Content', { exact: true }).fill(revised.content);
  expect(await records(page)).toEqual(created);
  await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: revised.title, exact: true })).toBeVisible();
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(revised.content);
  const edited = { ...initial, posts: [revised] };
  expect(await records(page)).toEqual(edited);
  await page.getByRole('link', { name: 'Back to All Blogs', exact: true }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await page.getByRole('article').filter({ has: page.getByRole('heading', { name: revised.title, exact: true }) })
    .getByRole('link', { name: /Read post/ }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${post.id}$`));
  await expect(page.getByRole('heading', { level: 1, name: revised.title, exact: true })).toBeVisible();
  await expect(page.locator('.whitespace-pre-wrap')).toHaveText(revised.content);
  expect(await records(page)).toEqual(edited);
});

test('direct other-owner edit is denied without persistence changes and offers no detail delete', async ({ page }) => {
  const identity = { userId: 'denied-user', username: 'denied-user', displayName: 'Denied Writer', role: 'user' };
  const expected = { posts: [preserved, null, { id: 'raw-row' }], users: null, session: identity };
  await page.addInitScript(state => {
    if (sessionStorage.getItem('writing-denial-seeded') === 'true') return;
    localStorage.setItem('writespace_posts', JSON.stringify(state.posts));
    localStorage.setItem('writespace_session', JSON.stringify(state.session));
    sessionStorage.setItem('writing-denial-seeded', 'true');
  }, expected);
  await page.goto(`/edit/${preserved.id}`);
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await durable(page, expected, 'All Blogs');
  await page.getByRole('article').getByRole('link', { name: /Read post/ }).click();
  await expect(page).toHaveURL(new RegExp(`/blog/${preserved.id}$`));
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
  await durable(page, expected, preserved.title);
});
