# Stakeout

Stakeout is a small web app for tracking friendly bets. Users add one-way friends by username, select those friends when creating bets, optionally invite people who have not joined yet by email, set deadlines, record outcomes, and review recent activity. Admins can manage roles and cancel bets.

## Stack

- Next.js 15 App Router, React 19, and TypeScript
- Google social login through Supabase Auth
- MongoDB application storage
- Resend invitation email in production and Mailpit locally
- Vitest unit tests and Playwright end-to-end tests

## Local development

Requirements: Node.js 22, Docker Desktop running, MongoDB (`mongod`) on `PATH`, and a Google OAuth 2.0 web client.

1. Copy `.env.local.example` to `.env.local`.
2. In Google Cloud, create an OAuth **Web application** client. Add `http://127.0.0.1:3000` as an authorized JavaScript origin and `http://127.0.0.1:54321/auth/v1/callback` as an authorized redirect URI.
3. Put the client ID and client secret in `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` and `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET`. Set `ADMIN_EMAIL` to a Google account you can use locally if you need the admin UI.
4. Start the stack:

```bash
test -f supabase/config.toml
npm ci
npm run local
```

`npm run local` checks that ports 3000 and 27017 are free, loads `.env.local`, verifies Docker and MongoDB, clears the Next.js development cache, and starts local Supabase, MongoDB, and Next.js. Wait for **Stakeout is ready**, then open [the login page](http://127.0.0.1:3000/login).

Add registered users from the Friends page using the exact username they share with you; Stakeout does not expose a user directory or autocomplete account search. Friend lists are private and one-way. Unregistered addresses can still be included when a bet is confirmed. The invitation contains a private bet link and tells the recipient to continue with the Google account for the invited email address. Local invitations are captured by [Mailpit](http://127.0.0.1:54324) and never leave the machine.

Press Ctrl+C in the launcher terminal to stop Next.js and MongoDB. Run `npx supabase stop` when you also want to stop the local Supabase containers. If port 3000 is occupied, identify the exact listener with `lsof -nP -iTCP:3000 -sTCP:LISTEN` before stopping it.

For separate terminals, export the two `SUPABASE_AUTH_EXTERNAL_GOOGLE_*` variables before starting Supabase. Copy `API_URL` and `ANON_KEY` from `npx supabase status -o env` into the matching `NEXT_PUBLIC_` variables in `.env.local`, start MongoDB, and run `npm run dev`.

## Code map

| Path | Purpose |
| --- | --- |
| `app/` | Pages, the OAuth callback, and API route handlers |
| `components/` | Client-side dashboard and admin UI |
| `lib/` | Auth, database, email, validation, and shared types |
| `supabase/` | Local Supabase and Google-provider configuration |
| `scripts/local.mjs` | Local service launcher |
| `e2e/` | Playwright user-flow tests and isolated service setup |

## Authentication and data flow

1. The login page asks Supabase to start Google OAuth with a PKCE callback to `/auth/callback`.
2. Google returns through Supabase; the application callback exchanges the one-time code for an HTTP-only cookie session and links the stable Supabase user ID, normalized email, and Google display name to an application user in MongoDB.
3. New accounts choose a visible name and unique username on `/profile`; safe invitation destinations resume after setup. Both fields can be changed later.
4. `currentUser()` validates subsequent sessions. Server pages protect `/`, `/bets/[id]`, `/admin`, and `/profile`; API routes independently repeat authentication and authorization checks.
5. The Friends page performs exact username lookups and stores one-way relationships by immutable application user ID, so a later username or email change does not break the relationship.
6. The dashboard calls `/api/bets`, `/api/friends`, and `/api/activities`. Friend IDs are authorized again during bet review and creation. Bet changes create records in the `activities` collection.

MongoDB uses four collections:

- `appUsers`: stable Supabase identity, email, unique username, visible name, role, and onboarding state
- `friendships`: one-way owner and friend user IDs
- `bets`: creator, participants, terms, deadline, status, and outcome note
- `activities`: user-visible audit entries for bet and admin actions

The creator can change an open bet. Participants can view it. Admins can view and change all bets. A bet can end as `completed`, `cancelled`, or `unresolved`.

## Configuration

Copy `.env.local.example` for local setup or `.env.example` for hosted environments.

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string and database |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-safe Supabase publishable/anonymous key |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` | Local Supabase Google OAuth client ID; configure the hosted value in the Supabase dashboard |
| `SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET` | Local Supabase Google OAuth secret; configure the hosted value in the Supabase dashboard |
| `APP_ORIGIN` | Exact public application origin used in private invitation links |
| `ADMIN_EMAIL` | Email that always receives the admin role |
| `INVITE_EMAIL_PROVIDER` | `mailpit` locally or `resend` when hosted |
| `INVITE_EMAIL_FROM` | Sender identity for invitation messages |
| `RESEND_API_KEY` | Server-only Resend credential for hosted invitations |

Do not commit `.env.local`, OAuth secrets, Supabase service-role keys, or Resend keys. The Google client secret belongs in Supabase—not Vercel—and the application does not need a service-role key in production.

## Development workflow

Before opening a pull request, run:

```bash
npm run ci
npm run e2e
```

`npm run ci` runs lint, strict TypeScript, unit tests, and a production build. Add unit tests beside modules as `*.test.ts`; add browser flows under `e2e/`.

## Continuous integration and deployment gates

GitHub Actions runs two required-quality candidates for every pull request and push to `main`:

- **Quality** installs from the lockfile, audits production dependencies for critical vulnerabilities, then runs lint, TypeScript, unit tests, and a production build.
- **E2E** starts isolated local Supabase, Mailpit, and Next.js services, uses a MongoDB service container, and runs the Playwright suite in Chromium. Tests create synthetic local Supabase sessions through a secret-gated route that is unavailable in production; they never automate or receive a real Google account. The visible login test still verifies the Google authorization request and callback destination.

Failure screenshots, traces, and reports are retained as workflow artifacts when available. Protect `main` by requiring `Quality` and `E2E`, requiring the branch to be current, and blocking direct and force pushes. Add those statuses as required Vercel Deployment Checks so production promotion waits for CI.

CI uses disposable local services and placeholder build-time values. It never receives production MongoDB, Supabase, Google, or Resend credentials. Keep Vercel preview and production variables separate and use non-production data services for previews.

## Production authentication and invitations

1. Create separate Supabase projects for staging and production.
2. In Google Cloud, configure the OAuth consent screen and a Web application client. Add each application origin to **Authorized JavaScript origins** and add `https://<project-ref>.supabase.co/auth/v1/callback` to **Authorized redirect URIs**.
3. In Supabase **Authentication → Providers → Google**, enable Google and add that client ID and secret. In **URL Configuration**, set the exact application Site URL and allow its `/auth/callback` URL. Use narrowly scoped preview entries or a dedicated preview project rather than a broad production wildcard.
4. In Vercel, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `MONGODB_URI`, `APP_ORIGIN`, `ADMIN_EMAIL`, `INVITE_EMAIL_PROVIDER=resend`, `INVITE_EMAIL_FROM`, and `RESEND_API_KEY`. Do not add the Google secret or a Supabase service-role key.
5. In Resend, verify a dedicated invitation-sending domain and publish SPF, DKIM, and DMARC records. Resend is used for bet invitations only; Google and Supabase handle authentication.

Before release, test Google consent and callback behavior against each environment, an invited user with the matching Google email, a user who chooses the wrong Google account, refresh and sign-out, rejected external redirects, and invitation delivery to representative mailbox providers.
