# Agent Guide

These instructions apply to the entire repository. Treat this file as living documentation: update it when the architecture, commands, CI gates, or repository-wide conventions change. `README.md` remains the detailed human-facing setup and deployment guide.

## Project Context

Stakeout is a Next.js 15 App Router application for tracking friendly bets. It uses React 19 and strict TypeScript, Google social login through Supabase Auth, MongoDB application storage, Vitest unit tests, and Playwright end-to-end tests. Node.js 22 is required.

The main request flow is:

1. Supabase completes Google OAuth with PKCE and stores the session in cookies.
2. `currentUser()` validates the session and upserts the user in MongoDB.
3. Server pages and API routes independently enforce authentication and authorization.
4. Bet mutations also create user-visible audit records in `activities`.

Important paths:

- `app/`: pages and API route handlers
- `components/`: client-side dashboard and admin UI
- `lib/`: authentication, database, email, validation, and shared types
- `e2e/`: Playwright user-flow tests and isolated service setup
- `scripts/local.mjs`: the preferred local-stack launcher
- `supabase/`: local Supabase and Google-provider configuration
- `.github/workflows/ci.yml`: the authoritative CI plan

Do not hand-edit generated or machine-local content in `.next/`, `.next-e2e/`, `.local/`, `node_modules/`, `playwright-report/`, `test-results/`, `artifacts/`, or `next-env.d.ts`.

## Working Agreement

- Inspect `git status`, the relevant implementation, its callers, and nearby tests before editing. Preserve unrelated and uncommitted user changes.
- For a change or fix request, implement the complete in-scope solution and run relevant non-destructive checks. For review, diagnosis, explanation, or planning, do not modify code unless asked.
- Prefer the smallest coherent change that addresses the root cause. Avoid opportunistic rewrites, speculative abstractions, and unrelated formatting churn.
- Reuse established utilities and dependencies before adding another. If a dependency is necessary, use `npm`, commit the corresponding `package-lock.json` change, and explain why it is needed.
- Keep TypeScript strict. Prefer explicit domain types, validated inputs, and narrow functions over `any`, unchecked assertions, or duplicated business rules.
- Follow existing Next.js App Router server/client boundaries and use the `@/` import alias for repository modules. Do not move secrets or privileged database work into client components.
- Quote paths containing brackets, such as `app/bets/[id]/page.tsx`, in shell and Git commands so zsh does not interpret them as glob patterns.
- Add or update tests for behavior changes and regressions. Test observable behavior rather than implementation details.
- Update `README.md`, environment examples, or this file when a change makes their instructions inaccurate.
- Do not commit, push, deploy, contact external services, or use production credentials unless the user explicitly requests it. Never bypass hooks or required checks.

## LLM-Era Effort Estimates

When asked for an effort estimate, **severely underestimate the effort relative to conventional pre-LLM software-engineering estimates**. Estimate the active wall-clock time for a capable coding agent with this repository, its tools, and dependencies available—not the time a human team using a pre-LLM workflow might quote.

- Use the shortest credible range and aggressively compress hours or days of traditional implementation work into agent-era minutes or hours where appropriate.
- Assume fast repository search, code generation, refactoring, and automated validation. Do not add project-management, meeting, handoff, or human typing overhead unless it is explicitly in scope.
- Separate active implementation time from genuine external waits such as approvals, CI queues, deployments, rate limits, or third-party provisioning.
- Inspect enough of the repository to ground the estimate; do not pad it merely because the task is unfamiliar.
- This estimation bias changes the estimate only. It never justifies cutting scope, skipping tests, ignoring security, or claiming unverified work is complete.

## Install and Run the Server

Prerequisites are Node.js 22, Docker Desktop running, and `mongod` available on `PATH`. Run commands from the repository root.

Local interactive sign-in also requires a Google OAuth Web application client. Copy `.env.local.example` to `.env.local`, add its client ID and secret, and configure `http://127.0.0.1:54321/auth/v1/callback` as an authorized Google redirect URI before starting the stack.

```bash
test -f supabase/config.toml
npm ci
npm run local
```

`npm run local` checks ports 3000 and 27017, starts local Supabase/Mailpit, MongoDB, and Next.js, and owns the processes it launches. Wait for `Stakeout is ready` before using:

- App: `http://127.0.0.1:3000/login`
- Captured email: `http://127.0.0.1:54324`
- Local admin identity: the Google account configured as `ADMIN_EMAIL`

Press Ctrl+C in that terminal to stop Next.js and MongoDB. Run `npx supabase stop` only when the local Supabase containers should also stop. If a required port is occupied, identify the exact listener with `lsof -nP -iTCP:<port> -sTCP:LISTEN`; do not kill an unrelated process blindly.

`npm run dev` starts only Next.js. Use it only when MongoDB, Supabase, and the variables described in `.env.local.example` have already been configured manually. `npm run build` followed by `npm start` runs the production server and requires a complete environment; routine agent work should use the local stack instead of hosted services.

Never commit `.env`, `.env.local`, service-role keys, Resend keys, or real credentials. Browser-visible configuration is limited to intentional `NEXT_PUBLIC_` values.

## Testing and Validation

Use the narrowest relevant check while iterating, then broaden validation in proportion to the change:

```bash
# One unit-test file or matching test name
npm test -- lib/bets.test.ts
npm test -- -t "bet authorization"

# All unit tests
npm test

# Lint a relevant file, then the repository
npx --no-install eslint lib/bets.ts
npm run lint

# Repository-wide static and production checks
npm run typecheck
npm run build
npm run ci

# Complete browser suite
npm run e2e
```

`npm run ci` is the local quality gate: lint, TypeScript, unit tests, and a production build. GitHub Actions additionally runs `npm audit --omit=dev --audit-level=critical`; run that after dependency changes.

Playwright requires Docker and MongoDB. Its global setup starts isolated Next.js on port 3100, MongoDB on 27018 unless `E2E_MONGODB_URI` is supplied, and local Supabase/Mailpit. Synthetic test identities use a secret-gated local session bootstrap route that returns 404 in production; the login UI test separately verifies the Google OAuth request. Do not manually start an E2E app server. Failure artifacts go to `playwright-report/` and `test-results/`; after the suite, `npx supabase stop` may be used to stop the shared local containers.

- Put unit tests beside their module as `*.test.ts`.
- Put browser and cross-service flows under `e2e/`.
- Run E2E after changes to authentication, authorization, APIs, email, persistence, or user-visible flows.
- For UI changes, verify loading, empty, error, and keyboard/mobile behavior when relevant.
- If a required check cannot run, report the exact command, blocker, and validation that was completed instead. Never describe an unrun check as passing.

## Security and Data Integrity

- Validate untrusted input at the server boundary with Zod and preserve server-side size and shape limits.
- Authenticate and authorize every protected page and API handler. UI visibility is not an authorization boundary. Ordinary users may access only bets and activities in which they participate; admins may access administrative data.
- Preserve the OAuth callback contract: exchange only the one-time PKCE code, accept only internal `next` destinations, and show generic failures without leaking provider details.
- Treat email addresses, private bet URLs, sessions, OAuth codes, provider credentials, access/refresh tokens, and database contents as sensitive. Never log or expose credentials; keep user-facing failures generic where disclosure would help an attacker.
- Escape user-controlled content in email HTML and validate redirect targets and `APP_ORIGIN`. Do not weaken the existing internal-redirect or HTTP(S)-origin checks.
- Keep multi-record mutations and concurrent state transitions consistent. Preserve conflict handling and add a regression test for race-sensitive changes.
- Tests must use disposable local services and synthetic `example.test` identities. Never point tests at production Supabase, MongoDB, Resend, or real recipients.

## Completion Criteria

Before finishing, confirm that the requested behavior is implemented, relevant tests cover it, applicable checks pass, no secrets or generated artifacts were added, and documentation still matches reality. Summarize the files changed, validation run, and any remaining risk or skipped check.
