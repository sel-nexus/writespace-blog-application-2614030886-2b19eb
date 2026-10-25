/** Run isolated component and business-rule tests in a browser-like DOM. */
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()], test: { environment: 'jsdom', setupFiles: ['./tests/setup.js'], include: ['tests/**/*.test.{js,jsx}'], pool: 'forks', maxWorkers: 1, minWorkers: 1 } });
