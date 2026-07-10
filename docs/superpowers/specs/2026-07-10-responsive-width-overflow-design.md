# Responsive Width and Overflow Design

## Objective

Make the 52-week Profile activity graph match the width of the Papers panel on wide screens, and prevent long user-provided text from widening mobile pages. Preserve the graph's existing cell dimensions, page behavior, routes, data, actions, and permissions.

## Confirmed Decisions

- On wide screens, the activity graph fills the same available column width as the Papers panel beneath it.
- Graph cells retain their existing size, shape, seven-row arrangement, and 52-week data window.
- Extra wide-screen width is distributed as horizontal space between fixed-size graph columns.
- On narrow screens, the graph remains an internally scrollable region because 52 fixed-size columns cannot fit without resizing cells.
- The page itself must not gain horizontal scrolling from long text.
- Long club names, club-card titles, paper titles, and member names truncate at their component boundaries.
- Descriptions keep a small readable line clamp and may break unbroken tokens within their allotted width.
- Club schedule and member tables constrain their primary text columns locally instead of changing the shared table component.
- No global `overflow-x-hidden` or `overflow-x-clip` is added. Oversized content is fixed at its source.

## Activity Graph Width

`ContributionGraph` keeps its existing fixed cell and gap variables. Its intrinsic-width content wrapper gains a minimum width equal to the scroll viewport. The grid distributes any surplus width between its 52 fixed columns. This produces two behaviors from one structure:

- When the Profile column is wider than the graph's natural width, the first and last columns align with the available content edges and the graph matches the Papers width.
- When the viewport is narrower than the graph's natural width, the intrinsic width wins and the existing keyboard-reachable internal horizontal scroller remains.

The legend stays aligned with the graph's right edge. No cell stretches, and the contribution data calculation remains unchanged.

## Mobile Text Constraints

### Club Shell

The Club header and its text column become explicitly shrinkable. The club name is a single truncated line with its full value retained in the DOM and exposed as a native title. The description remains at most two lines and uses `overflow-wrap:anywhere` for unbroken input. The edit action remains visible and may wrap beneath the text when required.

### Clubs Grid

The page, grid, and repository-card link become shrinkable grid/flex items. Each card clips only its own visual overflow so the existing title ellipsis can activate. The role badge remains non-shrinking, descriptions retain their three-line clamp, and unbroken description tokens wrap within the card.

### Profile Papers

Editable paper-title links become block-level, width-constrained truncate targets; the current read-only title already follows that pattern. Club-name and author metadata become shrinkable flex items with ellipsis rather than establishing a wider minimum content size. Logging controls and progress remain unchanged.

### Club Tables

Schedule and Members use local fixed table layouts. Secondary columns receive bounded widths, leaving the primary Paper or Member column the remaining space. Primary links are block/flex truncate targets with full text retained in a native title. Metadata is shrinkable. The shared shadcn table wrapper keeps its normal scrolling behavior for other consumers.

## Accessibility

- Truncated text remains the actual accessible text; ellipsis is visual only.
- Native titles expose the complete value to pointer users for primary truncated names and titles.
- Existing links, headings, table semantics, focus states, graph region label, and keyboard scrolling remain intact.
- No interactive control is clipped or replaced.

## Component Scope

- `src/features/profile/components/ContributionGraph.tsx`
- `src/features/profile/components/ProfileActivityPanel.test.tsx`
- `src/features/profile/components/ProfilePaperRows.tsx`
- `src/features/clubs/ClubShell.tsx`
- `src/features/clubs/ClubsPage.tsx`
- `src/features/schedule/SchedulePage.tsx`
- `src/features/clubs/MembersPage.tsx`
- Focused regression tests for the affected layout contracts

No API, query, database, cache, routing, permission, or shared table-component changes.

## Verification

- Red-green component coverage for graph full-width behavior and each truncation boundary.
- TypeScript typecheck.
- Full Vitest suite.
- ESLint with no new errors.
- Production build and PWA cache verification.
- Git whitespace check.
- Manual mobile checks for long club, paper, author, and member names without page-level horizontal scrolling.
- Manual desktop check that the graph and Papers panel share the same content width while graph cells retain their size.

## Out of Scope

- Replacing the mobile tables with cards.
- Hiding all horizontal overflow at the app shell.
- Removing the graph's narrow-screen internal scroller.
- Changing contribution cell size, shape, color, or date calculation.
- Changing validation limits for user-provided names or descriptions.
