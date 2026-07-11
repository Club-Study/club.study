# Profile and Clubs GitHub-Inspired Layout Design

## Objective

Improve the Profile and Clubs pages through stronger hierarchy, better use of horizontal space, and calmer navigation while preserving their existing actions and domain behavior. The Profile should feel like a focused GitHub profile: identity and club context in a stable left rail, reading activity and papers in the wider right column. The Clubs page should become a repository-style grid that makes club purpose and membership easier to scan.

This design follows the completed Feed discovery and density work. It does not revisit Feed behavior.

## Confirmed Product Decisions

- Profile uses a GitHub-inspired two-column composition on wide screens.
- The identity rail contains the pixel avatar, display name, edit action when allowed, bio, Reading/Planned/Read totals, and joined clubs in that order.
- Reading activity and the papers workspace occupy the main Profile column.
- Reading activity shows 52 weeks with the existing rectangular cells and no enclosing card border, background, or padding.
- Paper status selection changes from five ghost buttons to one compact status dropdown.
- The dropdown keeps the current default view of **Reading** and preserves the existing client-side status selection behavior.
- A short adjacent summary exposes the other meaningful status counts without recreating a second toggle mechanism. It excludes the active state and disappears when every other count is zero.
- Existing Add Paper, logging, progress, paper links, edit controls, and read-only behavior remain unchanged.
- Clubs uses a two-column repository-card grid on desktop and a one-column grid on narrow screens.
- Each club card shows name, the viewer's role, description, and member count. The entire card remains one navigation target.
- Upcoming-paper counts, avatars, discovery ranking, search, sorting controls, and new club actions are not added in this iteration.

## Profile Layout

### Identity Rail

At the large breakpoint, Profile uses a grid with an approximately `16rem` identity rail and a flexible main column. The rail is visually self-contained through spacing rather than a heavy card boundary.

Content order:

1. A square pixel avatar at approximately `7rem` on desktop and `5rem` on narrow screens, with a restrained border treatment.
2. Display name as the page's level-one heading and the existing edit action for the current user's profile.
3. Truncated bio rendered with the existing KaTeX-aware text component.
4. Reading, Planned, and Read totals in a compact three-column row.
5. A subtle separator followed by the Clubs heading and existing membership links.

Club links keep their name, role, description, route, virtualization behavior, hover state, and focus state. Their internal spacing is tightened to suit the narrower rail. No nested actions are introduced.

### Main Column

The main column begins with the contribution graph under a clear **Reading activity** heading. The graph sits directly on the page without an enclosing card border, background, or padding. It shows 52 weeks instead of 49, adding three columns while preserving the existing rectangular cell size, gap, color scale, and seven-row structure. The added columns and reclaimed card padding make the graph modestly longer without stretching its cells.

The papers workspace follows with:

- **Papers** heading and count.
- Existing Add Paper action when the page is editable.
- A shadcn-based status dropdown showing the active label and count, for example **Reading (1)**.
- A short muted summary of the other non-zero counts, such as **8 planned · 2 read**.
- The existing paper rows and empty state.

Opening the dropdown shows every existing paper state: Reading, Planned, On hold, Dropped, and Read. Selecting one updates the same local `PaperListView` state used today. The menu does not navigate, mutate paper state, or trigger a new server request.

### Public Profiles

Public profiles use the same responsive composition for consistency. Existing permissions still decide which controls render:

- The current user retains edit, Add Paper, and logging controls.
- Other users' public profiles remain read-only.
- Non-public profiles continue to show their existing limited identity and shared-club view; this redesign does not expose private activity.

## Clubs Layout

The Clubs page retains its header and New Club action, followed by a responsive repository-card grid.

Each card contains:

- Club name as the primary line.
- The current viewer's role as a quiet outlined badge.
- Description clamped to a consistent maximum so cards align.
- Member count in a muted footer with a small people icon.

The entire card is the club schedule link. Resting cards use a subtle border and transparent or near-background surface. Hover and keyboard focus strengthen the border and neutral surface across the full card. Cards do not contain nested links or buttons.

Two columns are used when each card has sufficient room for a readable name and description. The grid collapses to one column before text becomes cramped. Empty Clubs continues to explain that the user has no private clubs and keeps the New Club action visible.

## Data and Query Design

The existing clubs list query is extended to return the signed-in viewer's role and a member count for every visible club in the same request. The implementation must use one membership-aware aggregate query rather than one count request per card.

The clubs query accepts the authenticated user ID and includes it in its React Query key. The user-scoped key remains below `queryKeys.clubs.all`, which stays the stable prefix used by existing create, edit, invite, leave, and member-management invalidations.

One joined membership projection is filtered to that user and supplies `viewerRole`; a separate aggregate projection supplies `memberCount`. This avoids constraining the total count to the viewer's single membership while keeping the result to one request. Normalization requires exactly one viewer-membership role and one finite, non-negative aggregate count. Missing or multiple viewer memberships and malformed aggregate results throw instead of silently defaulting.

The returned UI model adds `viewerRole` and numeric `memberCount` fields while retaining the existing club row fields. Row-level security remains the authorization boundary for both clubs and memberships. The query must continue to restrict the list to clubs the signed-in user has joined, despite public-profile activity policies that may make other club records readable elsewhere.

No database schema, RLS policy, function, or migration change is required. The implementation must verify the aggregate query against local authenticated fixture data before completion.

Profile data flow remains unchanged. The layout consumes the current profile, overview, activity, membership, and paper-bucket values without new Profile requests. The client-side contribution calculation covers 52 weeks (`52 × 7` cells) instead of 49.

Both current call sites for the clubs list—`ClubsPage` and `DashboardPage`—pass the authenticated user ID to the user-scoped query. Updating Dashboard is a query-signature and cache-key adaptation only; its Feed layout, filtering, ordering, and behavior remain unchanged.

## Component Boundaries

- `ProfilePage` and the public-profile branch own page-level grid composition and permission-aware controls.
- A focused `ProfileIdentityRail` component replaces the split responsibilities of the current page-level `ProfileSummaryCard` and `ProfileSidebar`. It owns avatar, name, edit control, bio, compact stats, and membership links. The virtualized club-list and stat helpers may remain internal subcomponents.
- `ContributionGraph` retains its activity rendering while gaining a responsive overflow treatment.
- `RecentReadsCard` owns the Papers heading, Add Paper action, status dropdown, count summary, and paper panel.
- `ProfilePaperRows` and logging controls remain behaviorally unchanged.
- `ClubsPage` owns the grid and empty state.
- The clubs API/query layer owns member-count aggregation and normalization.

No generic dashboard-card abstraction is introduced. The Profile rail and Club cards remain domain-specific components built from existing shadcn primitives where those primitives fit.

## Responsive Behavior

### Desktop

- Profile uses the identity rail and main column side by side.
- The contribution graph and papers share the main-column width.
- Clubs uses two repository-card columns.

### Tablet and Mobile

- Profile stacks identity above activity and papers.
- The identity content remains left-aligned; the avatar does not become a centered hero.
- Paper controls wrap into readable rows. The status dropdown stays available without hiding Add Paper.
- Contribution cells remain complete. When they cannot fit at a legible size, the graph gains horizontal scrolling instead of clipping cells.
- Clubs collapses to one column.
- Long names truncate only where necessary, while descriptions use a consistent line clamp.
- Neither page introduces horizontal viewport overflow.

## Accessibility

- Profile retains a single page-level name heading and descriptive section headings for Reading activity, Clubs, and Papers.
- Edit remains an icon button with an accessible label.
- The status dropdown trigger includes the active state in its accessible name; menu items expose their selected state and counts.
- Paper rows retain their current links and logging controls without nested interactive targets.
- Club cards are single links with visible keyboard focus and sufficiently contrasted hover/focus surfaces.
- Contribution graph preserves its existing accessible activity label; horizontal scrolling is keyboard reachable when present.
- Member counts are expressed as text, not icon-only information.

## Loading, Empty, and Error States

- `ProfileLoading` is reshaped to match the identity-rail/main-column layout, including the frame-free activity region, so content does not jump dramatically after loading.
- Profile bio, club membership, activity, and paper empty states keep their current meaning.
- Clubs loading uses repository-card-shaped skeletons if loading is surfaced by the route.
- The Clubs empty state remains visible within the grid region and does not remove the New Club action.
- Profile query errors continue through route-level error handling. `ClubsPage` explicitly throws `clubs.error` into the same existing route boundary instead of rendering a misleading empty grid; this does not add custom error UI.

## Verification

Automated verification:

- TypeScript typecheck.
- Existing Vitest suite.
- Unit coverage for club member-count normalization if normalization is not trivial.
- Query-key coverage confirming the user-scoped club list remains beneath the `queryKeys.clubs.all` invalidation prefix.
- ESLint with no new errors.
- Production build and PWA cache verification.
- Authenticated local Supabase query confirming member counts and membership-only club visibility.

Browser verification:

- Current-user Profile and read-only public Profile.
- Existing limited non-public Profile.
- Status dropdown switching through all five paper states.
- Add Paper, edit, paper navigation, and logging controls remain available only where they are today.
- All 52 contribution weeks are complete at 390px mobile, 768px tablet, and 1440px desktop widths.
- Club grid at one- and two-column breakpoints.
- Long club names, missing descriptions, empty clubs, and realistic member counts.
- Light and dark themes, keyboard focus, and no horizontal page overflow.

## Out of Scope

- Profile follow/follower features, contact metadata, achievements, or README-style freeform content.
- New profile fields or changes to profile privacy.
- Club search, sorting, public discovery, avatars, upcoming-paper totals, or ranking.
- Changes to club membership management or permissions.
- Changes to paper status semantics, persistence, logging, or progress calculations.
- Feed changes.
