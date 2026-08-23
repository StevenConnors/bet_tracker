# E2E Test Coverage To Do

This document tracks browser coverage to add or strengthen. The current suite covers a registered-friend flow and the core unregistered-invitee flow. Items below include remaining edge cases and assertions that should be preserved as the implementation evolves.

## Automation Status

The implemented Playwright suite spans `auth.spec.ts`, `bet-flow.spec.ts`, `bet-behavior.spec.ts`, and `admin.spec.ts`. It covers Google OAuth initiation and callback safety, generic callback failure, session persistence and sign-out, route protection, review/confirmation, registered and unregistered participants, mixed groups, stale reviews, private invite links, outsider isolation, lifecycle states, overdue display, validation boundaries, activity privacy/limits, admin role management and moderation, request-failure recovery, simultaneous resolution, and a mobile keyboard/overflow check.

The detailed scenarios remain because several are broader than a single test. A real Google consent-screen smoke test, externally revoked sessions, delivery-provider outages, full assistive-technology audits, and Firefox/WebKit projects still require dedicated environments or a later test-infrastructure pass. Automated identities intentionally use local Supabase session bootstrap rather than a real Google account.

## Strengthen the Existing Happy Path

### Verify completion instead of only clicking Complete

The current test clicks **Complete**, but its final assertion only confirms that the **History** tab button is visible. That button is always present and does not prove the bet was completed.

- Create a bet between two registered users.
- Complete it with an outcome note.
- Confirm it disappears from the Active list.
- Open the History tab and confirm the bet appears there.
- Confirm its status badge says **completed**.
- Open the completed bet and confirm the outcome note is displayed.
- Refresh the page and confirm the completed state persists.
- Refresh the participant's page and confirm the participant sees the same status and note.
- Confirm both users receive the appropriate recent-activity entry.

### Verify all entered bet details

- Confirm the condition is displayed exactly as submitted.
- Confirm the wager is displayed exactly as submitted.
- Confirm the deadline represents the submitted local date and time correctly.
- Confirm the other participant's email or display name is shown.
- Confirm the creator is not incorrectly listed as the other participant.

## Authentication

### Start Google OAuth

- Select **Continue with Google**.
- Confirm Supabase receives `provider=google`.
- Confirm the OAuth request carries the exact application `/auth/callback` URL.
- Confirm the original protected internal path is retained as `next`.
- Supply an external, protocol-relative, backslash, or JavaScript `next` value and confirm it is replaced with `/`.

### Complete Google OAuth

- In a staging smoke test, choose a permitted Google account and complete consent.
- Confirm Google returns through the Supabase project callback and the application exchanges the PKCE code exactly once.
- Confirm the user reaches the intended internal page with an authenticated cookie session.
- Refresh the page and confirm the session remains active.
- Confirm the Google display name and normalized email are reflected in the application user without creating a duplicate.

### Cancelled, invalid, or expired OAuth callback

- Cancel the Google chooser or consent screen.
- Open the application callback without a code and with an invalid or expired code.
- Confirm each attempt returns to login with the same generic error.
- Confirm provider error details and codes are not exposed to the user.
- Confirm no authenticated session or MongoDB application user is created.
- Confirm the login button remains usable for another attempt.

### Google account selection for an invitation

- Open an invitation for an unregistered address.
- Choose the Google account with the invited normalized email and confirm access is granted.
- Repeat with a different Google account and confirm the private bet remains hidden behind a privacy-preserving 404.
- If Google returns an alias or alternate email, confirm the product's exact matching policy is enforced and documented.

### Sign out

- Sign in and select **Sign out**.
- Confirm the browser returns to the login experience.
- Attempt to revisit `/` and `/admin` and confirm protected content is unavailable.
- Use the Back button and confirm cached authenticated content is not usable.

### Post-login redirects

- Visit a protected internal destination such as `/admin` while signed out.
- Complete Google login with an authorized account and confirm the user reaches the intended internal destination if that behavior is supported.
- Supply an external, protocol-relative, or JavaScript `next` value and confirm the user is redirected only within the application.

## Route and Session Protection

### Unauthenticated dashboard access

- Open `/` without a session.
- Confirm the browser is redirected to `/login`.
- Confirm no dashboard or user data is briefly exposed.

### Unauthenticated admin access

- Open `/admin` without a session.
- Confirm protected admin content is not displayed.
- Confirm the user is routed through the expected login flow.

### Non-admin access to the admin page

- Sign in as a regular user and open `/admin` directly.
- Confirm the user is redirected to the normal dashboard.
- Confirm no admin data or controls are visible.

### Expired or revoked session

- Begin with an authenticated browser, then invalidate its session.
- Refresh a protected page and confirm the user returns to login.
- Trigger a dashboard API request with the invalid session and confirm the UI does not expose stale privileged actions.

## Creating Bets

### Regular users can create bets

The current registered-friend flow creates the bet as a regular user. Strengthen its permission assertions.

- Sign in two regular users.
- Have one user create a bet with the other.
- Confirm both users see it.
- Confirm the creator receives resolution controls and the participant does not.

### Create a bet with multiple participants

- Register several users.
- Enter multiple comma-separated addresses, including whitespace around entries.
- Confirm creation succeeds.
- Confirm every participant can see the bet.
- Confirm the participant list is displayed correctly.

### Duplicate participant addresses

- Enter the same participant more than once, including case variants.
- Confirm the bet contains each account only once.
- Confirm the creator is not duplicated when their address is also entered.

### Invite an unregistered participant

The core version of this flow is now covered and should remain a release-critical E2E test.

- Enter an email that has never signed in.
- Confirm the application does not reject the address as an error.
- Confirm the review screen says that no account was found and asks whether the creator wants to invite the person.
- Confirm the review clearly distinguishes registered participants from invitees.
- Confirm no bet exists before the creator explicitly confirms the review.
- Confirm returning to edit the draft does not create a bet or send an invitation.
- Confirm the reviewed condition, wager, deadline, and normalized participant emails match the draft.
- Select **Confirm, create, and send invite**.
- Confirm exactly one bet is created and exactly one invitation is sent to each unregistered email.
- Confirm the creator sees a success state that distinguishes invitation delivery from ordinary creation.

### Invitation email and private link

The current E2E test covers local Mailpit delivery and the basic private-link journey. Extend it with content and failure assertions.

- Confirm the invitation is addressed only to the intended invitee.
- Confirm its subject and body identify the creator and explain that a bet was created.
- Confirm it contains the expected condition, wager, and deadline without exposing unrelated private data.
- Confirm it contains a direct `/bets/[id]` URL for the newly created bet.
- Confirm the link uses the configured first-party application origin.
- Confirm invitation delivery failures are reported according to the intended product behavior without rolling back or duplicating the saved bet.
- Confirm refreshing or retrying the success screen does not send a duplicate invitation.

### Invitee signup returns to the exact bet

The core redirect flow is covered and should remain protected.

- Open the private bet link in a signed-out browser.
- Confirm the browser redirects to Google login with the exact bet path encoded as the internal `next` destination.
- Complete signup using the Google account for the same normalized email address that was invited.
- Confirm the user returns directly to the original `/bets/[id]` page, not merely the dashboard.
- Confirm the new account can see the bet in its dashboard after signup.
- Confirm the invitee can see participant details and subsequent status or activity updates.
- Repeat with uppercase or whitespace variants at creation/login boundaries and confirm they resolve to the same authorized email identity.

### Private access before and after invitee registration

The suite currently verifies that one outsider cannot list or directly retrieve the bet. Add coverage for every relevant boundary.

- Before the invitee registers, confirm the bet is authorized by normalized participant email rather than requiring an existing application-user ID.
- Confirm an unrelated signed-in user cannot see the bet in `/api/bets`, their dashboard, or their activity feed.
- Confirm an unrelated user requesting `/bets/[id]` or `/api/bets/[id]` receives a privacy-preserving 404 rather than a response revealing that the bet exists.
- Confirm a signed-out visitor is sent to login but does not receive bet details before authentication.
- Confirm signing in through the private link as an email other than the invited address does not grant access.
- Confirm knowing or guessing the bet ID alone never grants read or mutation access.
- Confirm the creator and intended invitee retain access after refresh and a new authenticated session.
- Confirm existing administrator moderation access remains intentionally privileged and is tested separately.

### Mixed registered and unregistered participants

- Enter a mixture of registered users and new invitee addresses.
- Confirm the review labels each address with the correct account status.
- Confirm registered users do not receive invitation emails.
- Confirm every unregistered address receives one invitation.
- Confirm all participants can access the same bet after each new invitee completes signup.
- Confirm duplicate and case-variant addresses are normalized and do not produce duplicate participants or emails.

### Account status changes between review and confirmation

- Review a bet while an address is unregistered.
- Register that address in another browser before confirming the bet.
- Confirm creation returns the review-required state instead of using stale participant status.
- Confirm the refreshed review now marks that address as registered and does not send it an invitation after confirmation.
- Exercise the inverse or removed-account case if account deletion is supported.

### Required-field validation

- Attempt to submit with each field empty.
- Confirm native or application validation identifies the relevant field.
- Confirm no request creates a bet.

### Boundary validation

- Test condition text below its minimum and at its maximum length.
- Test wager text below its minimum and at its maximum length.
- Test participant counts at and above the maximum of 20.
- Test malformed email addresses.
- Test an invalid or incomplete deadline.
- Confirm server-side validation errors are presented meaningfully in the browser.

### Deadline behavior

- Create a bet with a future deadline and confirm it shows as open.
- Create or seed a bet whose deadline has passed and confirm it shows as overdue.
- Confirm an overdue bet remains in Active until it is resolved.
- Confirm deadline formatting is correct in the browser's configured locale and timezone.

### Close the creation form

- Open the new-bet form and select **Close**.
- Confirm the form disappears without creating a bet.
- Reopen it and confirm the application remains usable.

### Failed network or server request

- Force the create request to return an error.
- Confirm the user sees a useful error and the form remains usable.
- Confirm rapid repeated submission does not create duplicate bets.

## Viewing Bets and Participant Permissions

### Participant can view a shared bet

- Confirm a participant sees the condition, wager, deadline, status, and other participant details.
- Confirm the participant can open and close the bet detail modal.
- Confirm a page refresh preserves access.

### Participant cannot resolve another user's bet

- Open a bet as a participant who is not its creator.
- Confirm Complete, Unresolved, and Cancel controls are absent.
- Attempt the underlying PATCH request from that authenticated browser and confirm it is forbidden.
- Confirm the bet remains unchanged for all participants.

### Unrelated user cannot view a bet

- Create a bet between two users.
- Sign in as a third regular user.
- Confirm the bet does not appear in their dashboard or activity feed.
- Attempt to request the bet directly and confirm access is forbidden.

### Active and History filtering

- Seed a mixture of open, completed, cancelled, and unresolved bets.
- Confirm Active contains only open bets, including overdue open bets.
- Confirm History contains every non-open status.
- Confirm the Active count is correct.
- Switch tabs repeatedly and confirm no duplicate or stale cards appear.

### Empty states

- Sign in as a user with no bets and confirm the Active empty state.
- Open History and confirm the History empty state.
- Confirm the recent-activity empty state is shown when applicable.

### Bet modal behavior

- Open and close a bet with the explicit Close button.
- Open and close it by clicking the backdrop.
- Confirm clicking inside the modal does not close it.
- Confirm keyboard focus and Escape behavior meet the intended accessibility design.

## Resolving Bets

### Mark a bet completed

- Complete a bet with and without an outcome note.
- Confirm status, History placement, persistence, participant visibility, and activity entries.

### Mark a bet unresolved

- Select **Unresolved** on an open bet.
- Confirm it moves to History with an unresolved badge.
- Confirm the optional note is visible to participants.
- Confirm it no longer offers creator resolution controls.

### Cancel a bet as its creator

- Select **Cancel bet** on an open bet.
- Confirm it moves to History with a cancelled badge.
- Confirm participants see the cancellation and any note.
- Confirm the activity feed records the cancellation.

### Resolution-note validation

- Submit no note and confirm the optional behavior works.
- Submit a note at its maximum supported length.
- Attempt a note above the maximum length and confirm a useful error is shown.
- Confirm text is rendered safely rather than interpreted as HTML or script.

### Prevent changes to closed bets

- Resolve a bet as a normal creator.
- Attempt to resolve or modify it again through the browser session.
- Confirm the request is rejected and the original final state remains unchanged.

### Simultaneous resolution

- Open the same creator-owned bet in two tabs or browser contexts.
- Resolve it in the first context.
- Attempt a conflicting resolution in the second context.
- Confirm the final state is consistent and the UI reports or refreshes stale state appropriately.

## Recent Activity

### Creation activity

- Create a bet and confirm the creator and all participants see the creation entry.
- Confirm an unrelated user does not see it.

### Resolution activity

- Complete, cancel, and mark separate bets unresolved.
- Confirm each action produces the correct message.
- Confirm entries are ordered newest first.
- Confirm displayed timestamps are valid and appropriately formatted.

### Activity visibility limits

- Generate more than six visible dashboard activities.
- Confirm the dashboard shows only the intended recent subset.
- Confirm no duplicate entries appear after refreshes.

### Admin activity visibility

- Confirm an admin sees system-wide activity if that is intended.
- Confirm role changes and moderation actions generate appropriate entries.

## Admin Workflows

### Load the admin dashboard

- Sign in as the configured admin and navigate through the **Admin** link.
- Confirm the user list and bet list load.
- Confirm open and closed bet statuses are displayed correctly.
- Confirm navigation back to the dashboard works.

### Promote a regular user

- Change a regular user's role from User to Admin.
- Confirm the change persists after refresh.
- Sign in or refresh as the promoted user and confirm admin access is available.
- Confirm an activity entry is created.

### Demote another admin

- Demote an admin other than the current user.
- Confirm the role change persists.
- Confirm the demoted user's admin access is removed on their next authorized request.

### Prevent self-demotion

- Attempt to change the current administrator's own role to User.
- Confirm the operation is rejected with the expected message.
- Confirm the user retains admin access after refresh.

### Cancel a bet as an administrator

- Select Cancel on an open bet in the admin panel.
- Dismiss the confirmation and confirm no change occurs.
- Repeat and accept the confirmation.
- Confirm the bet becomes cancelled with the administrator cancellation note.
- Confirm the bet's participants see the cancellation.
- Confirm an activity record is generated.

### Administrator visibility and authority

- Confirm an admin can see bets they do not participate in.
- Confirm an admin can resolve or moderate an open bet they did not create.
- Confirm normal users cannot call equivalent admin APIs from their browser session.

### Admin error handling

- Force role-update and moderation requests to fail.
- Confirm errors are visible and controls remain consistent with server state.

## Error Handling and Recovery

### Dashboard loading failures

- Force `/api/bets` or `/api/activities` to fail or return malformed data.
- Confirm the page does not crash.
- Confirm the user receives an appropriate loading or error state.
- Restore the endpoint and confirm retry or refresh recovers.

### Slow requests

- Delay login, bet creation, resolution, and admin actions.
- Confirm busy states prevent accidental duplicate submissions.
- Confirm controls return to an enabled state after failure.

### Not-found and malformed bet identifiers

- Request a valid but nonexistent bet ID.
- Request a malformed ID.
- Confirm the application returns a controlled response rather than crashing or exposing a stack trace.

## Accessibility and Browser Interaction

### Keyboard-only operation

- Complete login, create a bet, switch tabs, open a bet, and resolve it without a mouse.
- Confirm focus order is logical and focus remains visible.
- Confirm modal focus is managed appropriately.

### Accessible names and error announcements

- Confirm form fields and buttons have stable accessible names.
- Confirm authentication errors are announced as alerts.
- Confirm application errors are available to assistive technology.
- Confirm status is not communicated by color alone.

### Responsive layouts

- Exercise login, dashboard, bet form, modal, activity feed, and admin panel at representative mobile and tablet sizes.
- Confirm content does not overflow or become inaccessible.
- Confirm primary actions remain visible and usable.

### Supported browser projects

- Run critical happy paths in Chromium, Firefox, and WebKit if those browsers are supported.
- Add at least one mobile viewport project if mobile use is supported.
- Confirm date inputs, session cookies, and Google OAuth callback behavior work consistently.

## Suggested Implementation Order

1. Strengthen the existing completion assertions.
2. Add a staging Google OAuth smoke test and preserve automated session/sign-out coverage.
3. Extend the existing invitation test with email-content, wrong-email, and mutation-isolation assertions.
4. Cover mixed registered/unregistered groups and account-status changes between review and confirmation.
5. Cover completed, unresolved, cancelled, and overdue states.
6. Add creation validation and invitation-delivery failure/retry coverage.
7. Cover admin authorization, role management, and moderation.
8. Add activity-feed assertions.
9. Add accessibility, responsive, and cross-browser projects.

The first six groups protect the application's core data integrity and authorization boundaries. Accessibility, responsive-layout, and browser-matrix tests can then be layered onto the stable core journeys.
