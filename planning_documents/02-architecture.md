# club.study Architecture

## Stack

- App: Vite, React, TypeScript
- Routing: TanStack Router
- Server state: TanStack Query
- Forms and validation: React Hook Form and Zod
- Styling: Tailwind CSS v4 and shadcn/ui
- Icons: lucide-react
- Backend: Supabase Auth, Postgres, Edge Functions
- Deferred backend: Supabase Storage for post-MVP user-uploaded PDFs
- PWA: vite-plugin-pwa, app-shell/static assets only
- Testing: Vitest, Playwright, Supabase local/RLS checks

Do not switch to Next.js or a heavier framework for MVP. The proposed stack is enough and keeps launch friction low.

## App Structure

Use feature folders with thin routes:

```text
src/
  app/
    App.tsx
    providers.tsx
    router.tsx
  routes/
    __root.tsx
    sign-in.tsx
    auth.callback.tsx
    app.tsx
    app.index.tsx
    app.profile.tsx
    app.clubs.index.tsx
    app.clubs.new.tsx
    app.clubs.$clubId.tsx
    app.clubs.$clubId.schedule.index.tsx
    app.clubs.$clubId.schedule.$scheduleId.tsx
    app.clubs.$clubId.members.tsx
    app.invites.$token.tsx
  features/
    auth/
    profile/
    dashboard/
    clubs/
    papers/
    schedule/
    comments/
  components/
    layout/
    ui/
  lib/
    arxiv/
    dates/
    supabase/
    queryKeys.ts
    utils.ts
```

Within each feature, prefer `api.ts`, `queries.ts`, `mutations.ts`, `schemas.ts`, `components/`, and `hooks.ts`. Route files should stay thin and call feature modules.

## Routing

Use TanStack Router with the Vite router plugin before the React plugin. Prefer file-based routes, generated route types, typed params, and Zod-backed `validateSearch`.

Route context should hold stable services only:

- Supabase client
- TanStack Query client

Do not put mutable profile/session objects directly in router context. Fetch session/profile through Supabase auth state plus TanStack Query and invalidate on auth changes.

Use loaders with `queryClient.ensureQueryData` only for route-critical data. Page sections can use component queries.

## Supabase Setup

Project settings:

- Enable Data API: on
- Automatically expose new tables: off
- Enable automatic RLS: on, but migrations must still explicitly enable RLS

Use the browser-safe Supabase publishable or anon key in React. Never expose the `service_role` key.

Required env:

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

## Data Access

Client reads/writes through Supabase JS using the signed-in user's session. RLS and explicit grants enforce authorization.

Use RPCs for multi-row workflows:

- `create_club`
- `create_invite_link`
- `accept_invite`
- `schedule_arxiv_paper`
- `schedule_manual_paper`
- `toggle_read_status`

This avoids orphaned rows and RLS dead ends from loose client-side mutation chains.

## arXiv Integration

Use a Supabase Edge Function for metadata lookup/normalization. It accepts arXiv URL, PDF URL, or raw ID and returns normalized metadata. It must never fetch, stream, cache, upload, or re-serve PDF bytes.

Database RPCs handle authorization and insert/update papers and schedule rows. If an Edge Function ever uses service role for future work, it must validate caller JWT and club membership itself.

## PWA Strategy

Launch with installability and static app-shell caching only. Avoid runtime caching except an explicit allowlist of static build assets.

Network-only / never cache:

- Supabase REST/Auth/Realtime responses
- Edge Function responses
- signed URLs
- uploaded PDFs if added later
- arXiv PDFs
- any request with Authorization headers

Add a production smoke check that Cache Storage contains no Supabase URLs, signed URLs, private data, or PDF requests.

## Security Boundaries

- RLS is the security boundary; route guards are UX only.
- Every public table must explicitly enable RLS in migrations.
- Migrations must include explicit `GRANT` statements for required `authenticated` access because automatic table exposure is off.
- RLS helpers must use fixed `search_path`, minimal `security definer` scope, and `(select auth.uid())` where possible.
- Raw reading logs should be private to the user; expose club progress through aggregate queries/RPCs.
