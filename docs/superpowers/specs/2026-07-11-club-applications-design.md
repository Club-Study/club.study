# Public club directory and membership applications

## Goal

Let signed-in users discover reading clubs and request membership without an invite link. Keep each club's papers, schedule, member identities, invites, and applications private to the people who need them.

## User experience

- The Clubs page has two sections: **Your clubs** and **Discover clubs**.
- Directory cards reveal only club name, description, and aggregate member count.
- A non-member can submit one membership application from a directory card.
- The card immediately shows a pending state. Duplicate pending applications are prevented in the database.
- Rejected applicants may apply again. Approved applicants become members and the club moves into **Your clubs**.
- Owners and admins review pending applications in an **Applications** section on the existing Members page.
- Review rows show the applicant's avatar, display name, bio, and application date, with Approve and Reject actions.
- Invite links continue to work as a separate, immediate-join path.

No application message is included in the first version. This keeps the workflow small and avoids additional moderation and validation surface.

## Data model

Add `public.club_join_requests` with:

- `id uuid` primary key
- `club_id uuid` referencing `clubs` with cascade delete
- `user_id uuid` referencing `profiles` with cascade delete
- `status` constrained to `pending`, `approved`, or `rejected`
- `created_at`, `reviewed_at`
- `reviewed_by` referencing `profiles`

Integrity rules:

- A partial unique index permits at most one pending request per `(club_id, user_id)`.
- Approved/rejected rows must contain reviewer and review timestamp; pending rows must contain neither.
- A membership and pending request for the same club/user cannot be created through the public RPCs.
- Review operations lock the request row and perform status change plus membership insertion in one transaction.

## Backend API

Expose narrow `security definer` RPCs with an empty search path and explicit authentication checks:

- `list_discoverable_clubs()` returns only directory-safe fields plus the caller's membership role and latest request status.
- `apply_to_club(p_club_id)` creates a pending request and returns it.
- `list_club_join_requests(p_club_id)` returns pending requests plus the minimum applicant profile fields, manager-only.
- `review_club_join_request(p_request_id, p_decision)` accepts `approved` or `rejected`; managers only. Approval inserts a `member` membership atomically.

Direct table writes are not granted to clients. RPC execution is granted only to `authenticated`; `anon` and `public` are revoked.

## Privacy and RLS

- Existing club detail, schedule, paper, invite, membership, and profile policies remain private.
- Directory discovery happens only through the projection RPC, not a broad `clubs` table select policy.
- The table has RLS enabled but no direct client table grants; applicants and managers read only through the narrow RPC projections above.
- No authenticated user receives another club's member identities through discovery.
- Helper functions used in RLS stay in `private`, verify `auth.uid()`, use indexed lookups, and are not executable directly by client roles.

## Error behavior

Backend exceptions use stable, user-readable messages for these expected cases:

- sign-in required
- club not found
- already a member
- application already pending
- request no longer pending
- only owners and admins may review applications
- invalid review decision

The frontend maps these to toasts and refreshes relevant queries after successful apply/review operations.

## Verification and rollout

- Database tests cover discovery privacy, duplicate/concurrent-style application prevention, manager authorization, rejection, approval, atomic membership creation, and post-approval visibility.
- Component/API tests cover directory states and manager actions.
- Generate TypeScript types after the migration.
- Run clean local database reset, full database suite, unit tests, typecheck, lint, production build, PWA check, audit, and E2E suite.
- Push the branch, apply the migration to production, merge through a PR, wait for Vercel, then smoke-test production with two authenticated users.
