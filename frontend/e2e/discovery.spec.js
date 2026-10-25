/** Cover discovery through browser-local fixtures and activated navigation only. */
import { test as guardedTest, expect } from './fixtures';

// Extend the existing automatic console guard; request it explicitly before navigation too.
const test = guardedTest.extend({
  discoverySeed: async ({ page }, use) => {
    /**
     * Seed exact storage keys before the initial document executes.
     * Args:
     *   values (Object): Optional posts, session and raw post representation.
     * Returns:
     *   Promise<void>: Completion of the browser initialization script registration.
     */
    async function seed(values = {}) {
      await page.addInitScript(({ posts, session, rawPosts }) => {
        localStorage.setItem('writespace_posts', rawPosts ?? JSON.stringify(posts ?? []));
        localStorage.setItem('writespace_users', '[]');
        if (session) localStorage.setItem('writespace_session', JSON.stringify(session));
        else localStorage.removeItem('writespace_session');
      }, values);
    }
    await use(seed);
  },
});

/**
 * Build a complete, deterministic browser-local post.
 * Args:
 *   id (string): Demo identity and title suffix.
 *   day (number): January creation day for ordering.
 * Returns:
 *   Object: Complete publication record without sensitive content.
 */
function post(id, day) {
  return {
    id, title: `Story ${id}`, content: `Browser-local writing for ${id}.`,
    createdAt: `2026-01-${String(day).padStart(2, '0')}T12:00:00.000Z`,
    authorId: 'demo-writer', authorName: 'Demo Writer',
  };
}

/**
 * Save text-based UI evidence and a screenshot for human inspection.
 * Args:
 *   page (Page): Loaded discovery view.
 *   testInfo (TestInfo): Per-project artifact destination.
 *   state (string): Meaningful view state to identify artifacts.
 * Returns:
 *   Promise<void>: Completion of text attachments and screenshot.
 */
async function capturePreflight(page, testInfo, state) {
  const accessibility = await page.accessibility.snapshot({ interestingOnly: false });
  const html = await page.content();
  const styles = await page.evaluate(() => {
    const heading = document.querySelector('h1');
    const hero = document.querySelector('main section');
    return {
      bodyFont: getComputedStyle(document.body).fontFamily,
      headingFont: heading ? getComputedStyle(heading).fontFamily : null,
      heroBackground: hero ? getComputedStyle(hero).backgroundColor : null,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  expect(styles.horizontalOverflow).toBe(false);
  if (styles.headingFont) expect(styles.headingFont).toContain('Georgia');
  if (styles.heroBackground) expect(styles.heroBackground).toBe('rgb(255, 255, 255)');
  await testInfo.attach(`${state}-preflight`, {
    body: JSON.stringify({ accessibility, styles }, null, 2), contentType: 'application/json',
  });
  await testInfo.attach(`${state}-html`, { body: html, contentType: 'text/html' });
  await page.screenshot({ path: testInfo.outputPath(`${state}.png`), fullPage: true });
}

/**
 * Expose the public actions at the mobile breakpoint when needed.
 * Args:
 *   page (Page): Loaded public header.
 * Returns:
 *   Promise<void>: Completion of the menu activation, if visible.
 */
async function openPublicMenu(page) {
  const toggle = page.getByRole('button', { name: 'Open menu' });
  if (await toggle.isVisible()) await toggle.click();
}

test('projects at most three newest real previews and preserves storage through clicks', async (
  { page, discoverySeed, consoleGuard }, testInfo,
) => {
  expect(consoleGuard).toEqual([]);
  const posts = [post('old', 1), null, post('newest', 20), post('tie', 20), post('middle', 10), {}];
  await discoverySeed({ posts });
  await page.goto('/');
  const latest = page.getByRole('region', { name: 'Latest from the Blog' });
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Story newest', 'Story tie', 'Story middle']);
  await expect(latest.getByRole('link')).toHaveCount(3);
  await expect(page.getByText('Your thoughts. Your space. Beautifully simple.')).toBeVisible();
  await capturePreflight(page, testInfo, 'populated');
  await expect(latest.getByRole('link').first()).toHaveAttribute('href', '/blog/newest');
  await latest.getByRole('link').first().click();
  // Discovery activates the real detail URL; the next auth slice adds its guest login redirect.
  await expect(page).toHaveURL(/\/(?:blog\/newest|login)$/);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_posts')));
  expect(stored).toEqual(posts);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
  await expect(latest.getByRole('heading', { level: 3 })).toHaveText(['Story newest', 'Story tie', 'Story middle']);
  expect(await page.evaluate(() => localStorage.getItem('writespace_session'))).toBeNull();
});

test('shows the empty collection and navigates entry and footer links only by click', async (
  { page, discoverySeed, consoleGuard }, testInfo,
) => {
  expect(consoleGuard).toEqual([]);
  await discoverySeed();
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  await expect(page.getByRole('complementary')).toContainText('plaintext credentials');
  await capturePreflight(page, testInfo, 'empty');
  await page.getByRole('link', { name: 'Start Reading' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
  await page.getByRole('link', { name: 'Get Started Free' }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.getByRole('navigation', { name: 'Public navigation' }).getByRole('link', { name: 'WriteSpace' }).click();
  await page.getByRole('navigation', { name: 'Footer navigation' }).getByRole('link', { name: 'Register' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test('toggles the mobile menu with accessible state and closes it on navigation', async (
  { page, discoverySeed, consoleGuard }, testInfo,
) => {
  expect(consoleGuard).toEqual([]);
  await discoverySeed();
  await page.goto('/');
  const toggle = page.getByRole('button', { name: 'Open menu' });
  const nav = page.getByRole('navigation', { name: 'Public navigation' });
  if (testInfo.project.name === 'mobile') {
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(nav.getByRole('link', { name: 'Login' })).toBeHidden();
    await toggle.click();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    await capturePreflight(page, testInfo, 'menu-open');
    await page.getByRole('button', { name: 'Close menu' }).click();
    await expect(nav.getByRole('link', { name: 'Login' })).toBeHidden();
    await toggle.click();
  } else {
    await expect(toggle).toBeHidden();
  }
  await nav.getByRole('link', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await nav.getByRole('link', { name: 'WriteSpace' }).click();
  if (testInfo.project.name === 'mobile') await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await openPublicMenu(page);
  await nav.getByRole('link', { name: 'Get Started' }).click();
  await expect(page).toHaveURL(/\/register$/);
});

for (const role of ['admin', 'user']) {
  test(`${role} session uses the role dashboard destination`, async ({ page, discoverySeed, consoleGuard }) => {
    expect(consoleGuard).toEqual([]);
    const session = { userId: 'demo-id', username: 'demo', displayName: 'Demo Writer', role };
    await discoverySeed({ session });
    await page.goto('/');
    await openPublicMenu(page);
    const nav = page.getByRole('navigation', { name: 'Public navigation' });
    await expect(nav.getByText('Demo Writer')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start Reading' })).toHaveAttribute('href', '/blogs');
    await expect(nav.getByRole('link', { name: 'Go to Dashboard' })).toHaveAttribute(
      'href', role === 'admin' ? '/admin' : '/blogs',
    );
    await nav.getByRole('link', { name: 'Go to Dashboard' }).click();
    await expect(page).toHaveURL(role === 'admin' ? /\/admin$/ : /\/blogs$/);
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('writespace_session')))).toEqual(session);
  });
}

test('leaves malformed raw storage intact while rendering the exact empty message', async (
  { page, discoverySeed, consoleGuard }, testInfo,
) => {
  expect(consoleGuard).toEqual([]);
  const rawPosts = '{broken';
  await discoverySeed({ rawPosts });
  await page.goto('/');
  await expect(page.getByText('No posts yet — check back soon!')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('writespace_posts'))).toBe(rawPosts);
  await capturePreflight(page, testInfo, 'malformed-empty');
});
