# Centered Profile Identity and Sticky App Sidebar Design

## Objective

Refine the approved GitHub-inspired Profile layout by centering its avatar directly above the display name, and keep the global COsearch navigation visible at a stable viewport height while long page content scrolls. These are layout-only changes; routes, data, actions, permissions, and mobile navigation behavior remain unchanged.

## Confirmed Decisions

- The avatar and display-name row form one centered identity header.
- The edit action stays adjacent to the display name without changing the avatar-to-name alignment.
- Bio, reading totals, separator, and joined clubs remain left-aligned.
- The centered identity treatment applies to full current-user and public profiles through their shared identity component.
- The loading state mirrors the centered identity header to avoid a visible layout shift.
- “Sidebar” means the global navigation containing Feed, Clubs, Profile, theme, and sign-out.
- On desktop, that navigation stays in the document's flex layout but becomes sticky and exactly one dynamic viewport high.
- Main content keeps normal document scrolling. The app does not introduce an independent main scroll container.
- Mobile continues to use the existing sheet-based navigation.

## Profile Identity Alignment

`ProfileIdentityRail` groups only the avatar and name/edit row in a centered identity-header wrapper. The display name remains the single level-one heading and continues to truncate safely. The edit button keeps its existing label, behavior, and permission rules.

The avatar center aligns with the display-name center rather than with the combined width of the name and edit button. The name row uses equal flexible side tracks around a centered name track, with the edit control placed at the start of the right track. This keeps the control adjacent while preventing it from pushing the name away from the avatar's center line. Long names retain the current truncation behavior instead of widening the rail. The bio begins below this centered group and retains its current left alignment, width, KaTeX rendering, and truncation. Reading statistics and club links are unchanged.

The shared component means current-user and full public profiles receive the same alignment automatically. The restricted non-public profile view remains unchanged. `ProfileLoading` uses the same centered avatar/name silhouette so loading and loaded states do not jump.

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
- The centered profile identity works in the wide two-column layout and the stacked narrow layout.
- Bio, statistics, and clubs stay left-aligned at every width.
- Existing keyboard shortcut, collapse transition, focus states, accessible labels, and sheet semantics remain intact.
- Dynamic viewport units are retained because the sidebar component already uses them and they account for mobile browser chrome more accurately than static viewport units.

## Component Scope

- `src/features/profile/components/ProfileIdentityRail.tsx`: center the avatar and display-name identity header only.
- `src/features/profile/components/ProfileLoading.tsx`: mirror the centered loading silhouette.
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

- Avatar center aligns with the display-name center on the current-user Profile.
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
