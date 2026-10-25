/** Fail every browser journey on runtime and console errors. */
import { test as base, expect } from '@playwright/test';
export const test = base.extend({ consoleGuard: [async ({ page }, use) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  await use(errors);
  expect(errors, 'Browser must not emit errors').toEqual([]);
}, { auto: true }] });
export { expect };
