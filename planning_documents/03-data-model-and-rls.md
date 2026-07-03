# Data Model, RLS, And MVP Database Contract

## Principles

- MVP is private clubs only.
- Use two roles: `owner` and `member`.
- Use Monday `week_start date` instead of separate ISO year/week fields.
- Every public table must explicitly `enable row level security`.
- Migrations must include explicit grants because automatic table exposure is off.
- Use RPCs for multi-row workflows.
- arXiv PDFs are never stored in Supabase Storage or served by app infrastructure.
- Supabase Storage for user-uploaded PDFs is deferred until after MVP.

## Core Types

```sql
create type club_role as enum ('owner', 'member');
create type invite_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type paper_source_type as enum ('arxiv', 'manual');
```

## Tables

### profiles

- `id uuid primary key references auth.users(id)`
- `display_name text not null`
- `avatar_url text`
- `bio text`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS:

- Users can read their own profile.
- Club members can read limited profile fields for members of the same club.
- Users can insert/update only their own profile.

### clubs

- `id uuid primary key default gen_random_uuid()`
- `name text not null`
- `slug text unique not null`
- `description text`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

RLS:

- Members can read clubs they belong to.
- Owners can update their clubs.
- Club creation should happen through `create_club` RPC so owner membership is created atomically.

### club_members

- `club_id uuid not null references clubs(id) on delete cascade`
- `user_id uuid not null references profiles(id) on delete cascade`
- `role club_role not null default 'member'`
- `created_at timestamptz not null default now()`
- Primary key: `(club_id, user_id)`

RLS:

- Members can read membership for their own clubs.
- Owners can manage members in their own clubs.
- Users cannot self-add except through `accept_invite`.

### club_invites

Invite links only; no email sending in MVP.

- `id uuid primary key default gen_random_uuid()`
- `club_id uuid not null references clubs(id) on delete cascade`
- `token_hash text unique not null`
- `status invite_status not null default 'pending'`
- `created_by uuid not null references profiles(id)`
- `expires_at timestamptz`
- `created_at timestamptz not null default now()`
- `accepted_by uuid references profiles(id)`
- `accepted_at timestamptz`

RLS:

- Owners can create/revoke invite links for their clubs.
- Invite acceptance happens through `accept_invite` RPC, which validates token hash, expiry, status, and existing membership atomically.

### papers

Canonical metadata. MVP source types are arXiv and manual external links.

- `id uuid primary key default gen_random_uuid()`
- `source_type paper_source_type not null`
- `title text not null`
- `authors jsonb not null default '[]'::jsonb`
- `abstract text`
- `doi text`
- `license text`
- `arxiv_id text unique`
- `abstract_url text`
- `pdf_url text`
- `external_url text`
- `published_at timestamptz`
- `source_updated_at timestamptz`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

Constraints:

- `source_type = 'arxiv'` requires canonical non-versioned `arxiv_id`, `abstract_url`, and direct `https://arxiv.org/pdf/...` `pdf_url`.
- `source_type = 'manual'` requires `external_url`.
- No file/storage columns in MVP.

RLS:

- Members can read papers scheduled in their clubs.
- Insert/update should happen through schedule/import RPCs where practical.

### club_paper_schedule

The scheduled paper is the primary discussion/read-status object.

- `id uuid primary key default gen_random_uuid()`
- `club_id uuid not null references clubs(id) on delete cascade`
- `paper_id uuid not null references papers(id) on delete cascade`
- `week_start date not null`
- `notes text`
- `created_by uuid not null references profiles(id)`
- `created_at timestamptz not null default now()`
- Unique: `(club_id, week_start)`

Constraints:

- `week_start` must be a Monday.

RLS:

- Club members can read schedules for their clubs.
- Club members can create/update schedule rows in MVP.
- Owners can delete schedule rows.

### reading_logs

- `id uuid primary key default gen_random_uuid()`
- `schedule_id uuid not null references club_paper_schedule(id) on delete cascade`
- `user_id uuid not null references profiles(id) on delete cascade`
- `read_at timestamptz not null default now()`
- Unique: `(schedule_id, user_id)`

RLS:

- Users can read/create/delete only their own raw reading logs.
- Club-level read progress should be exposed through aggregate query/RPC, not raw member tracking by default.

### comments

- `id uuid primary key default gen_random_uuid()`
- `schedule_id uuid not null references club_paper_schedule(id) on delete cascade`
- `author_id uuid not null references profiles(id) on delete cascade`
- `body text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`
- `deleted_at timestamptz`

RLS:

- Club members can read comments on schedules in their clubs.
- Members can create comments in their clubs.
- Authors can update/delete their own comments.
- Owners can soft-delete comments in their clubs.

## Required RPCs

- `create_club(name, slug, description)` creates `clubs` and owner `club_members` row atomically.
- `create_invite_link(club_id, expires_at)` checks owner role and creates/replaces a pending token hash.
- `accept_invite(token)` validates and inserts membership atomically.
- `schedule_arxiv_paper(club_id, week_start, arxiv_metadata, notes)` validates membership, upserts `papers`, and creates/updates schedule.
- `schedule_manual_paper(club_id, week_start, metadata, notes)` validates membership and schedules an external paper.
- `toggle_read_status(schedule_id, read)` validates membership and upserts/deletes the caller's log.

## RLS Helper Rules

- Prefer helpers that derive user identity from `(select auth.uid())` instead of accepting arbitrary `user_id`.
- Set fixed `search_path`.
- Keep `security definer` helpers minimal and revoke broad execute access unless needed.
- Avoid recursive `club_members` policies by using stable helper functions.
- Use both `USING` and `WITH CHECK` for write policies.

## Indexes

Add indexes for all foreign keys plus:

- `club_members(user_id, club_id)`
- `club_invites(club_id, status)`
- `club_invites(token_hash)` unique
- `papers(arxiv_id)` unique where not null
- `club_paper_schedule(club_id, week_start)` unique
- `reading_logs(user_id, read_at)`
- `comments(schedule_id, created_at) where deleted_at is null`

## Grants

Because automatic table exposure is off, migrations must explicitly grant required table, sequence, and function privileges to `authenticated` while keeping RLS enabled. Do not grant access to `anon` except where a route explicitly needs signed-out behavior.

## Post-MVP Storage Contract

When uploaded PDFs are added later, introduce a club-scoped file ownership model such as `paper_files(club_id, paper_id, storage_path, uploaded_by, size_bytes, mime_type)`. Use a private bucket, short signed URL TTLs, no stored signed URLs, file size limits, no arXiv uploads, and membership-backed Storage policies.

## Acceptance Checks

- Signed-out users cannot read private data.
- Non-members cannot read club schedule, papers, comments, or membership.
- Club creation always creates owner membership.
- Invite acceptance cannot create duplicate or expired memberships.
- arXiv import creates metadata rows only and never creates Storage objects.
- Raw reading logs are private to the user.
- RLS checks cover owner, member, non-member, and signed-out cases.
