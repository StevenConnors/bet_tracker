# Stakeout

Stakeout is a small web app for tracking friendly bets. Users can create bets with registered friends, set deadlines, record outcomes, and review recent activity. Admins can manage roles and cancel bets.

## Stack

- Next.js 15 App Router, React 19, and TypeScript
- Supabase passwordless authentication
- MongoDB application storage
- Vitest unit tests and Playwright end-to-end tests

Login emails contain a six-digit code and a scanner-safe link. Opening the link shows a review page; the token is used only after the user clicks **Continue**.

## Local development

Requirements: Node.js 22, Docker Desktop running, and MongoDB (`mongod`) available on `PATH`.

Run these commands from the checkout containing this README **and** `supabase/config.toml`. If you also have an older `bet_tracker` checkout, do not start the app there; that checkout does not contain this Supabase authentication work.

```bash
test -f supabase/config.toml
npm ci
npm run local
```

`npm run local` first checks that ports 3000 and 27017 are free, verifies Docker and MongoDB, clears the generated Next.js development cache, and then starts local Supabase, MongoDB, and Next.js in order. Do not open the browser until it prints **Stakeout is ready**. The launcher owns the processes it creates, so Ctrl+C terminates the complete Next.js and MongoDB process groups rather than leaving child processes behind.

Request a login at [http://127.0.0.1:3000/login](http://127.0.0.1:3000/login), then inspect the captured message in Mailpit at [http://127.0.0.1:54324](http://127.0.0.1:54324). Exercise both the six-digit code and the review-link path. Creating a bet with an unregistered email also sends its invitation to Mailpit. Local messages never leave the machine.

Registered participants can join immediately. Unregistered addresses can be invited during the confirmation step and gain private access after signing in with the invited email. Sign in as `admin@example.test` to create the default local admin account.

Press Ctrl+C in the `npm run local` terminal to stop Next.js and MongoDB. Run `npx supabase stop` when you also want to stop the local Supabase containers. Supabase configuration and the shared auth-email template live under `supabase/`.

If startup reports that port 3000 is occupied, identify the exact old process with `lsof -nP -iTCP:3000 -sTCP:LISTEN`; stop that process and rerun `npm run local`. The script will not start a second Next.js process against the same cache or port.

For separate terminals, run `npx supabase start -x studio,imgproxy,storage-api,realtime,edge-runtime,logflare,vector`, copy `API_URL` and `ANON_KEY` from `npx supabase status -o env` into the matching `NEXT_PUBLIC_` variables in `.env.local`, start MongoDB, and run `npm run dev`.

## Code map

| Path | Purpose |
| --- | --- |
| `app/` | Pages and API route handlers |
| `components/` | Client-side dashboard and admin UI |
| `lib/` | Auth, database, API, and shared types |
| `supabase/` | Local Supabase config and email template |
| `scripts/local.mjs` | Local service launcher |
| `e2e/` | Playwright user-flow tests |

## Request and data flow

1. Supabase verifies the login code or link and stores the session in cookies.
2. `currentUser()` validates the session and upserts the user in MongoDB.
3. Server pages protect `/` and `/admin`; API routes repeat authorization checks.
4. The dashboard calls `/api/bets` and `/api/activities`.
5. Bet changes create records in the `activities` collection.

MongoDB uses three collections:

- `appUsers`: email, display name, and role
- `bets`: creator, participants, terms, deadline, status, and outcome note
- `activities`: user-visible audit entries for bet and admin actions

The creator can change an open bet. Participants can view it. Admins can view and change all bets. A bet can end as `completed`, `cancelled`, or `unresolved`.

## Configuration

Copy `.env.local.example` for manual local setup or `.env.example` for hosted environments.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string and database |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase key |
| `ADMIN_EMAIL` | Email that always receives the admin role |

Do not commit `.env.local` or any service-role key.

## Development workflow

Before opening a pull request, run:

```bash
npm test
npm run lint
npm run build
```

Run `npm run e2e` after changes to authentication, APIs, or user flows. Add unit tests beside the module as `*.test.ts`; add browser flows under `e2e/`.

## Continuous integration and deployment gates

GitHub Actions runs two required-quality candidates for every pull request and every push to `main`:

- **Quality** installs from the lockfile, then runs lint, TypeScript, all unit tests, and a production Next.js build.
- **E2E** starts isolated local Supabase/Mailpit and Next.js services, uses a MongoDB service container, and runs the complete Playwright suite in Chromium. Failure screenshots, traces, and reports are retained as workflow artifacts when available.

The repository and Vercel builds use Node.js 22. Before merging, configure a GitHub ruleset for `main` that requires the `Quality` and `E2E` checks, requires the branch to be up to date, and prevents direct pushes or force-pushes. In Vercel, configure all production environment variables listed below and add the GitHub `Quality` and `E2E` statuses as required Deployment Checks so a successful build is not promoted to the production domain before CI passes. Vercel can also run the checked-in `lint` and `typecheck` scripts as native Deployment Checks.

CI intentionally uses local disposable services and placeholder build-time values; it never receives production database, Supabase, or Resend credentials. Keep Vercel preview and production variables separate, and use a non-production Supabase project/database for preview deployments.

## Production authentication

1. Create separate Supabase projects for staging and production. Configure each Site URL and an exact allow list containing its `/login/verify` URL. Preview URLs should only be added as narrowly scoped entries when required.
2. Set email OTP length to 6, expiry to 600 seconds, and minimum send interval to 60 seconds. The checked-in local config uses one second only so automated reruns are deterministic; the UI still enforces 60 seconds. Apply `supabase/templates/magic_link.html` to the Magic Link template in each hosted project.
3. In Resend, verify a dedicated sending subdomain and publish its SPF and DKIM records plus a DMARC policy. Connect Resend to Supabase as the custom SMTP provider. The application also uses the Resend HTTPS API for bet invitations. Disable open and link tracking so authentication URLs are not rewritten.
4. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MONGODB_URI`, `APP_ORIGIN`, `ADMIN_EMAIL`, `INVITE_EMAIL_PROVIDER=resend`, `INVITE_EMAIL_FROM`, and `RESEND_API_KEY` in the deployment environment. `APP_ORIGIN` must be the exact public origin and is used for private bet links. The publishable/anonymous key is safe for the browser; never expose a Supabase service-role or Resend key.
5. Monitor Resend deliveries, bounces, and complaints, but never log OTPs, token hashes, magic URLs, access tokens, or refresh tokens.

Before release, smoke-test Gmail, Outlook, and another mailbox provider; verify SPF/DKIM/DMARC alignment; test both code and link flows; confirm link-prefetch GETs do not create a session; and confirm refresh and sign-out behavior.

The end-to-end suite starts local Supabase and reads captured mail through Mailpit. It requires Docker and MongoDB and uses an isolated `.next-e2e` directory.
