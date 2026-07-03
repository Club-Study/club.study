# Implementation Plan

## Implementation Rules

- Treat `/planning_documents` as ground truth for implementation. Do not rewrite or reinterpret the docs during implementation unless the user explicitly asks for a planning change.
- Work in vertical feature slices. After each feature slice, spawn a review agent focused on correctness, simplicity, security/RLS, maintainability, and test coverage.
- Do not continue to the next feature slice until blocking review findings are addressed or explicitly documented as accepted tradeoffs.
- Use tests as the objective gate for whether the app works and remains safe: typecheck, lint, unit tests, Playwright smoke tests, Supabase migration/RLS checks, and targeted cache inspection for PWA safety.
- Keep every feature launch-focused. If a feature is not required by the MVP docs, leave a small future seam rather than implementing it.

## Phase 1: Scaffold

- Create Vite React TypeScript app in repo root.
- Add Tailwind CSS v4 and shadcn/ui with `new-york`, neutral base color, CSS variables, and lucide icons.
- Add TanStack Router, TanStack Router Vite plugin, TanStack Query, Supabase JS, Zod, React Hook Form, vite-plugin-pwa, Vitest, and Playwright.
- Configure TanStack Router file-based routing, generated route types, typed params, Zod search validation, and route context for Supabase client + Query client.
- Add feature folders and `.env.example`.

Verify: typecheck, lint, build.

## Phase 2: MVP Database Contract

- Create migrations for profiles, private clubs, members, invite links, papers, schedules, reading logs, comments.
- Explicitly enable RLS on every public table.
- Add explicit grants for `authenticated` because automatic table exposure is off.
- Add RLS helpers with fixed `search_path` and minimal `security definer` scope.
- Add indexes listed in `03-data-model-and-rls.md`.
- Add RPCs: `create_club`, `create_invite_link`, `accept_invite`, `schedule_arxiv_paper`, `schedule_manual_paper`, `toggle_read_status`.
- Use `week_start date` with Monday check constraint.
- Do not add Supabase Storage or uploaded PDFs in MVP.

Verify: `supabase db reset` if available, generated DB types, and RLS checks for signed-out, non-member, member, owner.

## Phase 3: Auth, Profile, First Run

- Implement Supabase browser client.
- Implement Google OAuth and `/auth/callback`.
- Upsert profile from OAuth metadata.
- Implement route guards.
- Implement first-run dashboard: accept invite if present, otherwise create private club prompt.

Verify: signed-out redirects, callback works, profile upsert is idempotent.

## Phase 4: Private Clubs And Invite Links

- Implement private club creation through `create_club`.
- Implement club dashboard/schedule shell.
- Implement invite link copy/revoke flow through RPC.
- Implement `/invites/$token` acceptance flow through RPC.
- Implement members table with `owner`/`member` only.

Verify: creator becomes owner atomically, expired/revoked/duplicate invites fail safely, non-members cannot read club data.

## Phase 5: arXiv URL/ID Import And Scheduling

- Implement metadata-only Edge Function for arXiv URL/PDF URL/raw ID normalization.
- Do not implement full arXiv search UI yet.
- Canonicalize arXiv IDs without version suffix for uniqueness.
- Store title, authors, abstract, arXiv ID, DOI, license, abstract URL, PDF URL, published/updated dates.
- Implement manual external-paper fallback.
- Schedule one primary paper per club/week through RPC.
- Link `Open PDF` / `Download from arXiv` directly to arXiv.

Verify: no PDF bytes are fetched, streamed, cached, proxied, or stored; arXiv rows have no storage path; PDF links go to `arxiv.org`.

## Phase 6: Scheduled Paper, Comments, Read Status

- Implement `/app/clubs/$clubId/schedule/$scheduleId`.
- Show metadata, links, notes, read progress, read/unread action, comments.
- Implement comments scoped to schedule.
- Keep raw reading logs visible only to the current user; use aggregate progress for club view.

Verify: only club members can read/comment/mark read; users can modify only their own comments/read status.

## Phase 7: PWA And Launch Polish

- Configure manifest and static app-shell caching only.
- Avoid runtime caching except explicit static asset allowlist.
- Add compact loading, empty, and error states.
- Keep UI restrained and dense.

Verify: production build, PWA manifest, Cache Storage contains no Supabase URLs, Edge Function responses, private data, PDFs, signed URLs, or Authorization-bearing requests.

## Final Verification

- Typecheck, lint, unit tests, build.
- Vitest for arXiv normalization, week helpers, query keys.
- Playwright smoke: sign-in shell, create club, accept invite, schedule arXiv paper, comment, mark read.
- Supabase local/RLS checks where CLI/Docker are available.
- A final review agent must find no unresolved blocking issues in security, product scope, maintainability, or launch readiness.
- Report missing credentials, Google OAuth config, Docker, or network blockers.
