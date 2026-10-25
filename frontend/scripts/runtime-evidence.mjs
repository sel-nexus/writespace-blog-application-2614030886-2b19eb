/** Capture real nginx-served UI evidence and measured browser-local baselines. */
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.E2E_BASE_URL || 'http://127.0.0.1:8080';
const browser = await chromium.launch({ headless: true });
const evidence = { origin, browser: browser.version(), measurements: [], views: [] };
await mkdir('ui-evidence', { recursive: true });
try {
  for (const [name, width, height] of [['desktop', 1280, 800], ['mobile', 390, 844]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    for (const [state, path] of [['landing-empty', '/'], ['login-error', '/login'], ['admin', '/admin']]) {
      await page.goto(`${origin}/`);
      await page.evaluate(role => {
        localStorage.clear();
        if (role) localStorage.setItem('writespace_session', JSON.stringify({
          userId: 'writespace-admin', username: 'admin', displayName: 'Admin', role: 'admin',
        }));
      }, state === 'admin');
      await page.goto(`${origin}${path}`);
      await page.locator('h1').waitFor();
      if (state === 'login-error') await page.getByRole('button', { name: 'Sign In', exact: true }).click();
      const tree = await page.accessibility.snapshot({ interestingOnly: false });
      const styles = await page.evaluate(() => ({
        font: getComputedStyle(document.body).fontFamily,
        headingFont: getComputedStyle(document.querySelector('h1')).fontFamily,
        overflow: document.documentElement.scrollWidth > innerWidth,
      }));
      const file = `${name}-${state}`;
      await page.screenshot({ path: `ui-evidence/${file}.png`, fullPage: true });
      await writeFile(`ui-evidence/${file}.html`, await page.content());
      evidence.views.push({ name, state, tree, styles });
    }
    for (const count of [0, 100, 1000]) {
      const storage = await page.evaluate(size => {
        const posts = Array.from({ length: size }, (_, index) => ({
          id: `baseline-${index}`, title: `Baseline post ${index}`, content: 'Plain-text baseline content. '.repeat(12),
          createdAt: new Date(1767225600000 + index * 1000).toISOString(),
          authorId: 'writespace-admin', authorName: 'Admin',
        }));
        const startWrite = performance.now();
        localStorage.setItem('writespace_posts', JSON.stringify(posts));
        const writeMs = performance.now() - startWrite;
        const startRead = performance.now();
        const read = JSON.parse(localStorage.getItem('writespace_posts'));
        return { count: read.length, writeMs, readMs: performance.now() - startRead };
      }, count);
      const start = performance.now();
      await page.goto(`${origin}/blogs`);
      await page.locator('h1').waitFor();
      if (await page.getByRole('region', { name: 'Blog collection' }).getByRole('article').count() !== count) {
        throw new Error('Baseline list count does not match stored records');
      }
      evidence.measurements.push({ name, ...storage, documentToListMs: performance.now() - start });
    }
    if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);
    await context.close();
  }
  await writeFile('runtime_evidence.json', JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ browser: evidence.browser, measurements: evidence.measurements,
    views: evidence.views.map(({ name, state, styles }) => ({ name, state, styles })) }, null, 2));
} finally {
  await browser.close();
}
