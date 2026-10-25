/** Exercise real reading journeys with persistent browser storage and automatic console capture. */
import { test, expect } from './fixtures';

const regular = { userId: 'u1', username: 'mina', displayName: 'Mina', role: 'user' };
const body = 'First line of the story.\n\n  An indented second line.\n'
  + 'Full writing beyond the card preview. '.repeat(8)
  + '\n<script>This is plain text, not executable.</script>';
const posts = [
  {
    id: 'older', title: 'An earlier page', content: 'A quieter earlier entry.',
    createdAt: '2026-01-01T12:00:00Z', authorId: 'another', authorName: 'Another Writer',
  },
  {
    id: 'reading', title: 'A page to return to', content: body,
    createdAt: '2026-01-15T12:00:00Z', authorId: 'u1', authorName: 'Mina',
  },
  {
    id: 'tie', title: 'A companion page', content: 'Written at the same moment.',
    createdAt: '2026-01-15T12:00:00Z', authorId: 'another', authorName: 'Another Writer',
  },
];

/**
 * Register a once-only seed before the initial browser document executes.
 * Args:
 *   page (Page): Fresh test browser context.
 *   session (Object|null): Local identity, or guest when null.
 * Returns:
 *   Promise<void>: Initialization registered without reseeding subsequent reloads.
 * Notes:
 *   A sessionStorage marker survives reload in this tab; each test receives a fresh context.
 */
async function seed(page, session = regular) {
  await page.addInitScript(({ records, identity }) => {
    if (sessionStorage.getItem('reading-fixture-seeded') === 'yes') return;
    localStorage.setItem('writespace_posts', JSON.stringify(records));
    localStorage.setItem('writespace_users', JSON.stringify([
      { id: 'u1', displayName: 'Mina', username: 'mina', password: 'demo-only', role: 'user', createdAt: '2026-01-01T00:00:00Z' },
    ]));
    if (identity) localStorage.setItem('writespace_session', JSON.stringify(identity));
    else localStorage.removeItem('writespace_session');
    sessionStorage.setItem('reading-fixture-seeded', 'yes');
  }, { records: posts, identity: session });
}

/** Read the exact persisted domain keys for before/after comparison. */
async function stored(page) {
  return page.evaluate(() => ({
    posts: localStorage.getItem('writespace_posts'),
    users: localStorage.getItem('writespace_users'),
    session: localStorage.getItem('writespace_session'),
  }));
}

test('opens the newest post, reads full multiline text, returns and refreshes without reseeding', async ({ page, consoleGuard }) => {
  expect(consoleGuard).toEqual([]);
  await seed(page);
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
  const collection = page.getByRole('region', { name: 'Blog collection' });
  await expect(collection.getByRole('heading', { level: 2 })).toHaveText([
    'A page to return to', 'A companion page', 'An earlier page',
  ]);
  const newest = collection.getByRole('article').first();
  await expect(newest.getByText(body.slice(0, 120), { exact: true })).toBeVisible();
  await expect(newest.getByText('Jan 15, 2026')).toBeVisible();
  await expect(newest.getByText('Mina', { exact: true })).toBeVisible();
  await expect(newest.getByRole('link', { name: 'Edit', exact: true })).toHaveAttribute('href', '/edit/reading');
  await expect(collection.getByRole('article').nth(1).getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  const before = await stored(page);
  await newest.getByRole('link', { name: /Read post/ }).click();
  await expect(page).toHaveURL(/\/blog\/reading$/);
  await expect(page.getByRole('heading', { level: 1, name: 'A page to return to' })).toBeVisible();
  const content = page.locator('article .whitespace-pre-wrap');
  await expect(content).toBeVisible();
  expect(await content.textContent()).toBe(body);
  await expect(content).toHaveCSS('white-space', 'pre-wrap');
  await expect(content).toHaveCSS('overflow-wrap', 'break-word');
  await expect(page.locator('article script')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'A page to return to' })).toBeVisible();
  expect(await content.textContent()).toBe(body);
  expect(await stored(page)).toEqual(before);
  await page.getByRole('link', { name: 'Back to All Blogs' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
  await page.reload();
  await expect(collection.getByRole('heading', { level: 2 })).toHaveText([
    'A page to return to', 'A companion page', 'An earlier page',
  ]);
  expect(await stored(page)).toEqual(before);
});

test('shows an exact missing-record state from a separate initial entry and returns to real posts', async ({ page, consoleGuard }) => {
  expect(consoleGuard).toEqual([]);
  await seed(page);
  await page.goto('/blog/missing');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Post not found');
  await expect(page.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  const before = await stored(page);
  await page.getByRole('link', { name: 'Back to All Blogs' }).click();
  await expect(page).toHaveURL(/\/blogs$/);
  await expect(page.getByRole('region', { name: 'Blog collection' }).getByRole('heading')).toHaveText([
    'A page to return to', 'A companion page', 'An earlier page',
  ]);
  expect(await stored(page)).toEqual(before);
});

test('guest previews redirect to real login and never expose full post or protected edits', async ({ page, consoleGuard }) => {
  expect(consoleGuard).toEqual([]);
  await seed(page, null);
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText([
    'A page to return to', 'A companion page', 'An earlier page',
  ]);
  await expect(latest.getByRole('link', { name: 'Edit', exact: true })).toHaveCount(0);
  const before = await stored(page);
  await latest.getByRole('link', { name: /Read post/ }).first().click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Username' })).toBeVisible();
  await expect(page.locator('.whitespace-pre-wrap')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
});

test('guest collection entry is protected and its login home link returns to actual previews', async ({ page, consoleGuard }) => {
  expect(consoleGuard).toEqual([]);
  await seed(page, null);
  await page.goto('/blogs');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Blog collection' })).toHaveCount(0);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'WriteSpace' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Latest from the Blog' }).getByRole('heading')).toHaveText([
    'A page to return to', 'A companion page', 'An earlier page',
  ]);
  expect((await stored(page)).session).toBeNull();
});

test('computes one, two, and three collection columns at mobile, medium, and desktop widths', async ({ page, consoleGuard }) => {
  expect(consoleGuard).toEqual([]);
  await seed(page);
  await page.goto('/blogs');
  await expect(page.getByRole('heading', { level: 1, name: 'All Blogs' })).toBeVisible();
  const collection = page.getByRole('region', { name: 'Blog collection' });
  await expect(collection.getByRole('article')).toHaveCount(3);
  for (const [width, columns] of [[390, 1], [768, 2], [1280, 3]]) {
    await page.setViewportSize({ width, height: 844 });
    await expect.poll(() => collection.evaluate(node => getComputedStyle(node).gridTemplateColumns.split(' ').length)).toBe(columns);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await expect(collection.getByRole('heading').first()).toHaveText('A page to return to');
  }
  await collection.getByRole('article').last().getByRole('link', { name: /Read post/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'An earlier page' })).toBeVisible();
  await expect(page.locator('article .whitespace-pre-wrap')).toHaveText('A quieter earlier entry.');
});
