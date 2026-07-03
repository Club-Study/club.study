# club.study Product Spec

## Summary

club.study is a minimal PWA for academic paper reading clubs. The launch MVP should do one loop very well: sign in, create a private club, invite members by link, schedule an arXiv paper for a week, discuss it, and mark it read.

The product should feel closer to Linear or GitHub than a social network: compact, quiet, fast, and built around repeated weekly workflows. The first implementation should prioritize launch speed, RLS safety, and maintainability over broad feature coverage.

## Launch MVP Goals

- Users sign in with Supabase Google OAuth.
- Users get a basic profile from OAuth metadata and can edit display name/avatar/bio.
- Users create private clubs and automatically become the club owner.
- Owners create invite links; signed-in users can accept a valid invite link.
- Club members can schedule one primary paper per club per week.
- Papers are added by arXiv URL, arXiv PDF URL, raw arXiv ID, or manual metadata/external URL.
- Members can comment on a scheduled paper.
- Members can mark their own scheduled paper as read or unread.
- The dashboard shows current week, upcoming scheduled papers, and simple read progress.
- The app is installable as a PWA, with app-shell/static-asset caching only.

## Deferred Until After MVP

- Open/public clubs and club discovery.
- Admin user search/add by profile search.
- `admin` role and role-management UI beyond `owner`/`member`.
- User-uploaded PDFs and Supabase Storage.
- Full arXiv search UI with pagination.
- GitHub-style contribution grid.
- Full inline PDF annotations.
- Email sending for invites.

These are useful future features, but they expand RLS, storage, moderation, cache, and UI complexity. Do not implement them in the first launch slice unless explicitly requested after the MVP works.

## Strict arXiv Policy

The app must not host arXiv PDFs. For arXiv papers, Supabase stores metadata only:

- Title
- Authors
- Abstract
- arXiv ID
- DOI
- License
- Abstract URL
- PDF URL
- Published date
- Updated date

The UI may show `Open PDF`, `Open on arXiv`, or `Download from arXiv` actions, but those actions must link directly to arXiv URLs such as `https://arxiv.org/pdf/2401.12345`. The app must not proxy, mirror, upload, cache, or re-serve arXiv PDF bytes from Supabase Storage, Edge Functions, service workers, app caches, or any project-owned infrastructure.

## Core Workflows

### First Run

1. A signed-out user sees a minimal sign-in screen.
2. They choose `Continue with Google`.
3. Supabase completes OAuth and returns to `/auth/callback`.
4. The app creates or updates a profile row.
5. If the user arrived from an invite link, they accept it and land in that club.
6. Otherwise they land on the dashboard with a prompt to create a private club.

### Private Club And Invite Link

1. A signed-in user creates a private club.
2. A database RPC creates the club and owner membership atomically.
3. The owner creates a revocable invite link.
4. A signed-in recipient opens the link.
5. A database RPC validates token, expiry, status, and membership, then inserts membership atomically.

### Weekly Paper Scheduling

1. A club member chooses a Monday `week_start`.
2. They paste an arXiv URL/ID or enter manual paper metadata/external URL.
3. A metadata-only Edge Function normalizes arXiv metadata and never fetches PDF bytes.
4. A database RPC creates/reuses the paper and schedule row atomically.
5. The scheduled paper becomes the primary context for comments and read status.

### Comments And Reading

1. Club members open a scheduled paper page.
2. They see paper metadata, arXiv/external links, comments, and member read progress.
3. They can add/edit/delete their own comments.
4. They can mark their own read status.

## Success Criteria

- A small private reading group can run a weekly paper discussion end to end.
- Private club data is protected by explicit Supabase RLS and grants.
- Multi-row workflows do not leave orphaned rows.
- arXiv imports store metadata only and link directly to arXiv PDFs.
- PWA caching never stores Supabase responses, signed URLs, private data, or PDFs.
- The app remains compact, fast, and not visually bloated.
