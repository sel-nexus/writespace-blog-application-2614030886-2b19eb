# WriteSpace

A browser-local reading and plain-text writing demo. Built with React 18, JavaScript JSX, Vite, React Router v6 and Tailwind CSS 3. There is no backend, application API or database.

## Important demo limits

Use **demo passwords only**. Passwords are stored in plaintext in this browser. Roles and the session are editable client-side records, not trusted authorization. Do not enter real passwords, secrets or sensitive personal data. Data is isolated to this origin/browser profile; there is no synchronization, backup or recovery. Clearing browser storage can permanently remove writing and accounts.

The fixed Admin signs in with username `admin` and password `admin`. It is hard-coded, always present, and not an ordinary deletable record. Usernames are case-sensitive; lowercase `admin` is reserved. The fixed Admin identifier is `writespace-admin`.

## Run locally

Requirements: Node 20 and npm.

```sh
cd frontend
npm ci --no-bin-links
cp .env.example .env
npm run dev
```

Open the development origin printed by Vite (default port 5173). Environment values configure development/preview/test tooling only; there is no secret or API URL in the application. Static bundles cannot be reconfigured by a runtime `.env` file.

## Test and build

From `frontend/`:

```sh
npm test
NODE_ENV=production npm run build
node node_modules/@playwright/test/cli.js install chromium
npm run test:e2e
```

Playwright starts a production preview of the built bundle. Tests run isolated browser profiles on desktop and mobile; they assert real localStorage data, route behavior and browser errors. Run the build before E2E. Unit tests use Vitest, jsdom and React Testing Library. Tests and package scripts use Node entry paths so they also work on filesystems with npm bin links disabled.

## Product journeys

- `/`: public introduction, recent local post previews, and account-entry actions.
- `/login`, `/register`: explicit local account entry with field errors and a visible demo notice.
- `/blogs`, `/blog/:id`: newest-first list and full escaped plain-text reading.
- `/write`, `/edit/:id`: required title/content, character counter, ownership-scoped editing.
- `/admin`: Admin-only post oversight, recent five posts, all-post access and account shortcuts.
- `/users`: Admin account list, complete account creation with either role, and confirmed deletion of eligible accounts.

Regular users may modify only their own posts; Admin may modify any post. These are client workflow controls, not security guarantees. Destructive operations require browser confirmation. A failed write does not show saved-success feedback or navigate as though saved. Registration spans two storage keys: if account save succeeds but session save fails, the account remains available for a later login.

Dashboard `Total Posts` counts valid displayed posts; `Total Users` counts local accounts plus the fixed Admin. `Total Admins` and `Total users` display `—` with an explanation because those source metrics are undefined. Account updates are out of scope.

## Verification outcome

The final unit suite passed 815 tests. All 70 distinct desktop/mobile browser journeys passed across the full run and a targeted reading-spec rerun after correcting an overbroad heading selector. The actual nginx container passed syntax, root/deep-route, asset and missing-asset checks; all ten reading cases passed on nginx. Production-mode Vite build and Docker build passed. Local 1,000-post document-to-list measurements were about 689 ms desktop and 828 ms mobile viewport emulation; these are sandbox observations, not SLAs. Run `node frontend/scripts/runtime-evidence.mjs` from the repository root against a running nginx container to reproduce UI captures and timing baselines.

## Static container

```sh
docker build -t writespace ./frontend
docker run --rm -p 8080:80 writespace
```

The two-stage Dockerfile builds `frontend/dist` then serves it with nginx on `0.0.0.0:80`. `/` serves the SPA entry. Browser deep routes use nginx history fallback; missing `/assets/` files return 404 instead of HTML. The container never stores posts, credentials or sessions.

The approved assembled target is AWS frontend-container delivery (ECR/ECS behind the pipeline ALB/CloudFront). AWS provisioning and rollout are downstream DevOps work; this repository does not claim an AWS deployment has occurred. The repository-root `vercel.json` retains the source's exact rewrite-only artifact for compatibility. It does not configure AWS. If using Vercel independently, set its project root to `frontend` and install the rewrite configuration in that root externally; no forbidden build/output keys are included in the source artifact.

## Organization

`frontend/src/pages` owns user journeys; `components` owns shared presentation; `utils` owns browser storage, projections, account and post rules. One BrowserRouter is mounted in `main.jsx`; `App.jsx` composes routes. No Context or external state store is used. Exact browser keys: `writespace_posts`, `writespace_users`, `writespace_session`.

Source versions are resolved by `frontend/package-lock.json`. React, Router, Vite and Tailwind dependency ranges preserve the specified compatible baseline. The generated code graph is `graphify-out/graph.json`; later specification stages own derived docs/specification artifacts.
