# CEditor frontend

The Next.js app for CEditor: an HTML/CSS/JS editor with a live preview, timed contests and an
admin console. Deployed on Vercel. The backend (gateway and services) is described in the
[root README](../README.md).

**Stack:** Next.js 16 (App Router), React 19, Monaco editor, Tailwind CSS 4, Better Auth client.

## Design system

Dark only, monochrome with hairline borders, set in Geist Sans and Geist Mono.

- **Tokens** are defined once in `app/globals.css` (`--background`, `--card`, `--border`,
  `--muted-foreground`, ...). Components use the semantic Tailwind classes generated from them
  (`bg-card`, `border-border`, `text-muted-foreground`) rather than raw colours.
- **Colour carries meaning only:** blue for focus and links, red for errors and destructive
  actions, amber for warnings, green for success.
- **Primitives** live in `components/ui`: `Button` (primary, secondary, ghost, danger), `Input`/`Label`,
  `Badge`, `Spinner`, `Modal`, `ConfirmModal`, toasts and the `Logo`. Icons are `lucide-react`.
- **Code** uses a matching Monaco theme (`ceditor`, defined in `components/editor/CodeEditor.tsx`).

## How it talks to the backend

The browser only ever calls its own origin (`/api/...`). `app/api/[...proxy]/route.ts`
forwards each call to the API gateway (`NEXT_PUBLIC_API_URL`):

- **Session cookies stay first-party,** set on the frontend's own domain, so there are no
  cross-site cookie problems.
- **The proxy sends `BFF_SHARED_SECRET` with the client's real IP.** The gateway trusts that IP
  for rate limiting only when the secret matches.
- **Client-sent proxy headers are stripped,** so nobody can spoof an IP through the proxy.

| Area | Calls |
|---|---|
| Sign-in, sign-up, session | `/api/auth/*` (Better Auth, via `lib/auth-client.ts`) |
| Profile | `/api/v1/user/profile` |
| Projects, saves, sync | `/api/v1/code/*` |
| Contests, submissions, strikes | `/api/v1/contest/*` |
| Admin | `/api/v1/user/all`, `/api/v1/user/admin/:id/ban`, `/api/v1/code/admin/projects/:id`, `/api/v1/contest/admin/submissions/:id`, `/api/v1/contest/*` |

## Pages

| Route | What |
|---|---|
| `/` | Landing page: sign-up/log-in buttons when signed out; practice, contests and the live or next contest when signed in |
| `/login`, `/register` | Google sign-in. Existing username/password accounts can still log in; new ones sign up with Google only, unless `NEXT_PUBLIC_EMAIL_SIGN_UP=true` (local development) |
| `/practice` | Practice: your projects in the editor (Monaco, live preview, console, autosave). `/editor` redirects here |
| `/contests` | Contests: live, upcoming (with countdowns) and past ones |
| `/contests/[id]` | A contest room: join, wait for the start (countdown, how many have joined), then the live contest in full screen, then "Submitted" |
| `/profile` | The user's projects |
| `/admin` | Users (ban/unban), their projects and submissions, contest management |

`middleware.ts` sends signed-out users to `/login` and signed-in users away from it.

## Editor behaviour worth knowing

- **Saving:** edits autosave through `/api/v1/code/sync` and are also kept in IndexedDB
  (`lib/indexedDB.ts`), so a newer local copy wins on reload.
- **Preview:** each project runs in a sandboxed iframe (`components/PreviewFrame.tsx`) that loads
  `public/preview-frame.html` and receives the page built by `lib/previewDocument.ts` in a
  message. The user's script runs after the markup, and console output is forwarded to the
  editor's console panel.
- **Content-Security-Policy:** `middleware.ts` gives every page a policy with a fresh nonce
  (`lib/csp.ts`): no inline or eval'd scripts except Next.js's own. The preview frame has its own
  policy, so user code isn't affected. Violations are logged by `/api/csp-report`; set
  `CSP_REPORT_ONLY=true` to report without blocking. See ADR 0010.
- **Cold starts and busy spells:** signed-in page loads wake every backend service from the
  middleware (once a minute, `ce_woke` cookie). Practice opens the last project from this
  browser's copy immediately (`lib/session.ts` remembers whose copy it is; sign-out and the
  sign-in pages forget it) and keeps edits made before the server answers. When Render's
  Cloudflare edge challenges Vercel's servers, the `/api` proxy retries for ~5 s and then
  answers 503 `busy`; `components/BackendBusy.tsx` retries those for ~20 s more behind a
  "Server busy, retrying…" banner.
- **First load:** without a local copy, the editor shows a loading screen until projects arrive. A brand-new account's
  "Welcome" project is created asynchronously by the backend, so for accounts under 5 minutes
  old an empty project list is re-checked for up to a minute before the user is asked to create
  a project. That covers a backend service waking up on Render's free tier.
- **Editing area:** `components/editor/Workbench.tsx` (files, editor, console, preview) is
  shared by `PracticeWorkspace` and `components/contest/ContestWorkspace`. `CodeEditor` doesn't
  hand its own recent values back to Monaco, so lagging React state can't drop keystrokes.
- **Contests** run on their schedule (ADR 0012). `components/contest/ContestRoom.tsx` polls
  `/api/v1/contest/:id/room` every 5 s and counts down on the server's clock; at the start it
  switches to "live", and entering takes a click (full screen needs one). The workspace links a
  contest project (`PUT /contest/:id/project`), fetches the question, and runs the deterrents
  (`hooks/useContestSecurity.ts`): full screen, strikes recorded with contest-service (its count
  wins over a reload; the 4th submits and ends the contest), clipboard limited to the editor. It
  sends a heartbeat every 15 s (`hooks/useContestActivity.ts`) with what was typed and pasted;
  contest-service turns these into flags on the admin page (ADR 0011). Submitting (also at
  time-up, and by beacon if the window closes) goes to `/api/v1/contest/submissions` with the
  contest id. The deterrents apply in contest rooms only; practice has the normal clipboard.
  Rooms, practice and admin need a desktop-size screen; the contests list works on a phone.

## Running locally

Start the backend first (see the root README: `docker compose up -d --build --wait`). Then:

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3000, BFF_SHARED_SECRET
npm install
npm run dev                  # http://localhost:3005
```

`BFF_SHARED_SECRET` must match the gateway's `BFF_SHARED_SECRET`. Without it the app still works
locally, but rate limits use the proxy's IP.

## Checks

```bash
npm run lint
npx tsc --noEmit -p .
npm run build
```

CI runs all three on every pull request.

## Deployment (Vercel)

Set `NEXT_PUBLIC_API_URL` to the gateway's public URL, and `BFF_SHARED_SECRET` to the same value
as the gateway's. For Google sign-in, the redirect URI is
`https://<your-vercel-domain>/api/auth/callback/google`.
