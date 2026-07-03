# UI And Routes Plan

## Visual Direction

Use a minimal Linear-like style:

- Neutral palette with restrained accent color.
- Compact typography and dense spacing.
- Thin borders, subtle backgrounds, and 6 to 8px radii.
- No marketing hero, decorative gradients, or oversized cards.
- Sidebar plus main content for signed-in app routes.
- Tables/lists for operational views rather than decorative card grids.

Use shadcn/ui components wherever possible. Custom UI should mostly compose shadcn primitives.

## MVP shadcn Components

- `button`
- `input`
- `textarea`
- `label`
- `form`
- `dialog`
- `sheet`
- `dropdown-menu`
- `avatar`
- `badge`
- `separator`
- `skeleton`
- `tooltip`
- `table`
- `sonner`

Defer `command`, `popover`, and `calendar` unless the first implementation genuinely needs them. Use native date input for `week_start` if that launches faster.

## Routes

```text
/sign-in
/auth/callback
/invites/$token
/app
/app/profile
/app/clubs
/app/clubs/new
/app/clubs/$clubId
/app/clubs/$clubId/schedule
/app/clubs/$clubId/schedule/$scheduleId
/app/clubs/$clubId/members
```

The scheduled paper route is the primary paper view. Avoid a global `/app/papers/$paperId` in MVP because comments, read status, and access are club/schedule scoped.

## First-Run UX

- Signed-out users see only sign-in.
- Signed-in users with no clubs see a compact prompt to create a private club.
- Signed-in users opening an invite link land on invite acceptance, then the club.
- Dashboard shows current week, upcoming papers, and simple progress, not a full contribution grid.

## Club Screens

Club detail defaults to schedule.

Schedule view:

- Week rows sorted newest/upcoming first.
- One primary paper per week.
- Each row shows title, source, week start, read progress, and comment count.

Scheduled paper view:

- Paper title, authors, abstract, metadata.
- `Open on arXiv` / `Open PDF` external links for arXiv papers.
- External link for manual papers.
- Read/unread button for current user.
- Comments list and composer.

Members view:

- Member table with avatar/name/role.
- Owner can copy/revoke invite link.
- No admin search/add in MVP.

## arXiv Add Flow

Use a simple paste-first dialog:

- Input accepts `arxiv.org/abs/...`, `arxiv.org/pdf/...`, or raw arXiv ID.
- The app calls metadata-only lookup.
- Preview normalized title/authors/abstract/link.
- User schedules it for `week_start`.

Full arXiv search UI is post-MVP.

## Comments

Use a flat list:

- Comment body
- Author avatar/name
- Timestamp
- Edit/delete for own comments

Avoid page-number fields, quotes, threads, and inline annotations in MVP.

## Empty And Error States

- Empty dashboard: create club.
- Empty schedule: schedule first arXiv/manual paper.
- No comments: compact empty row.
- arXiv lookup error: explain that metadata lookup failed and allow manual entry.
- Invite error: expired, revoked, already accepted, or sign-in required.

Do not use large explanatory marketing blocks inside the app.
