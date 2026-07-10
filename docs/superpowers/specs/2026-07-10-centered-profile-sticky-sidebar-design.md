# Centered Profile Identity and Sticky App Sidebar Design

## Objective

Refine the approved GitHub-inspired Profile layout by centering its avatar above the display-name row while keeping the display name aligned with the bio's left edge, and keep the global COsearch navigation visible at a stable viewport height while long page content scrolls. These are layout-only changes; routes, data, actions, permissions, and mobile navigation behavior remain unchanged.

## Confirmed Decisions

- The display name starts on the same left edge as the bio.
- The avatar and display-name row form one shrink-to-content identity header whose left edge matches the bio.
- The avatar is centered above that name/edit row; the name itself is not centered across the rail.
- The edit action stays adjacent to the display name.
- Bio, reading totals, separator, and joined clubs remain left-aligned.
- The avatar-over-name treatment applies to full current-user and public profiles through their shared identity component.
- The loading state mirrors the revised identity alignment to avoid a visible layout shift.
- “Sidebar” means the global navigation containing Feed, Clubs, Profile, theme, and sign-out.
- On desktop, that navigation stays in the document's flex layout but becomes sticky and exactly one dynamic viewport high.
- Main content keeps normal document scrolling. The app does not introduce an independent main scroll container.
- Mobile continues to use the existing sheet-based navigation.

## Profile Identity Alignment

`ProfileIdentityRail` groups only the avatar and name/edit row in a shrink-to-content identity-header wrapper. The wrapper starts on the same left edge as the bio, while the avatar is centered across the width of the name/edit row above it. The display name remains the single level-one heading, stays left-aligned, and continues to truncate safely. The edit button keeps its existing label, behavior, and permission rules.

The identity wrapper is capped at the rail width so long names retain the current truncation behavior instead of widening the rail. The bio begins below the identity wrapper at the same left edge and retains its current width, KaTeX rendering, and truncation. Reading statistics and club links are unchanged.

The shared component means current-user and full public profiles receive the same alignment automatically. The restricted non-public profile view remains unchanged. `ProfileLoading` uses the same avatar-over-name silhouette so loading and loaded states do not jump.

## Global Sidebar Behavior

The desktop `Sidebar` remains a flex item so its expanded and collapsed widths continue to reserve the correct space for `SidebarInset`. Its desktop layout changes from a content-stretched minimum height to:

- `position: sticky` at the top of the viewport;
- `height: 100dvh`;
- `align-self: flex-start` so the parent flex container cannot stretch it to document height.

`SidebarContent` keeps its existing internal overflow behavior. On unusually short viewports or at high zoom, navigation content may scroll inside the sidebar while the header and footer remain available. The main page retains native document scrolling, browser scroll restoration, and the existing mobile sticky header.

The design does not use `position: fixed`, because removing the sidebar from flow would require synchronized main-content offsets for both expanded and collapsed widths. It also does not lock the full app shell to `100dvh`, because that would introduce a nested main scroller and change route scroll behavior.

## Responsive and Accessibility Behavior

- Desktop and tablet layouts at the existing `md` sidebar breakpoint use the sticky viewport-height sidebar.
- Below `md`, the desktop sidebar remains hidden and the existing Radix sheet remains the navigation surface.
- The left-aligned name/bio relationship and avatar-over-name treatment work in the wide two-column layout and the stacked narrow layout.
- Bio, statistics, and clubs stay left-aligned at every width.
- Existing keyboard shortcut, collapse transition, focus states, accessible labels, and sheet semantics remain intact.
- Dynamic viewport units are retained because the sidebar component already uses them and they account for mobile browser chrome more accurately than static viewport units.

## Component Scope

- `src/features/profile/components/ProfileIdentityRail.tsx`: align name and bio while centering the avatar over the name row.
- `src/features/profile/components/ProfileLoading.tsx`: mirror the same loading silhouette.
- `src/components/ui/sidebar.tsx`: make the desktop sidebar sticky, viewport-height, and self-aligned.

No page query, route, API, database, cache, paper, club, or profile-permission code changes.

## Verification

Automated checks:

- TypeScript typecheck.
- Existing Vitest suite.
- ESLint with no new errors.
- Production build.
- Git whitespace check.

Visual checks:

- Display name and bio share the same left edge on the current-user Profile.
- Avatar is centered over the display-name row rather than over the full identity rail.
- The same alignment appears on a full public Profile and during loading.
- Bio, statistics, and clubs remain left-aligned.
- With a long papers list, the global desktop sidebar stays at viewport height and its footer remains visible while the document scrolls.
- Expanded and collapsed desktop sidebar widths still reserve the correct main-content space.
- A short-height viewport allows only the sidebar content region to scroll when necessary.
- Mobile sheet navigation and mobile sticky header are unchanged.

## Out of Scope

- Making the Profile identity rail itself sticky.
- Centering the bio, statistics, or clubs.
- Changing Profile data, controls, paper behavior, or club behavior.
- Redesigning navigation content, width, collapse behavior, or mobile presentation.
