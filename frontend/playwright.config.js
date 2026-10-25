/** Exercise built static assets through real browser journeys. */
import { defineConfig } from '@playwright/test';
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:4173';
export default defineConfig({ testDir: './e2e', workers: 1, retries: 0, timeout: 30000, use: { baseURL, trace: 'retain-on-failure', screenshot: 'only-on-failure' }, projects: [{ name: 'desktop', use: { viewport: { width: 1280, height: 800 } } }, { name: 'mobile', use: { viewport: { width: 390, height: 844 } } }], webServer: { command: 'node node_modules/vite/bin/vite.js preview --host 0.0.0.0', url: baseURL, reuseExistingServer: !process.env.CI, timeout: 30000 } });
