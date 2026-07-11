# Feed Discovery and Density Design

## Objective

Make the Feed a calmer, easier-to-scan overview of scheduled papers while preserving its restrained editorial style. Upcoming work remains the default. Readers can deliberately reveal past papers, distinguish read papers from missed ones, filter by club, search paper content, and choose a compact layout.

This is the first focused sub-project of the broader Feed, Clubs, Profile, and people-discovery redesign.

## Confirmed Product Decisions

- Upcoming papers are the default and remain visible at all times.
- Past papers are hidden by default and are not queried until the reader enables **Past**.
- Enabling Past reveals a separate section below Upcoming; past and upcoming papers are never mixed into one chronology.
- Past papers can be filtered to **All**, **Read**, or **Missed**.
- A past paper is **Read** when the current user's schedule status is `read`. A past paper with any other status, or no status row, is **Missed**.
- Undated papers remain at the end of Upcoming because they have not become past.
- Upcoming is ordered by scheduled date ascending, undated last, then creation time descending, then ID ascending for deterministic ties.
- Past is ordered by scheduled date descending, then creation time descending, then ID ascending.
- Search covers paper title and abstract. Author search is excluded because authors are stored as JSONB and need a separate normalized search strategy.
- Club filtering and text search run in the Supabase query before the result limit; the UI must not pretend to search only the already-rendered rows.
- Comfortable and Compact densities are available. Density is saved in local storage; Past remains off on each fresh page mount.

## Interaction Design

### Page Header and Toolbar

The page begins with a compact `Feed` level-one heading. A responsive toolbar follows:

1. shadcn `Input` with `type="search"` for title and abstract search.
2. Existing shadcn `DropdownMenu` with a radio group for **All clubs** or one selected club.
3. shadcn `Switch` with a visible **Past** label.
4. shadcn `ToggleGroup` for **Comfortable** and **Compact** density.

Search occupies the available width. The remaining controls stay content-width on desktop and wrap below the search field on narrow screens. Controls retain visible labels; icon-only controls are not necessary.

The Upcoming section has its own level-two heading and result count. When Past is enabled, a single-select **All / Read / Missed** toggle appears beside the Past section heading and count. It does not replace or hide the Past switch.

### Paper Rows

Paper rows use the shadcn `Item` primitive with TanStack Router `Link` as the interactive child. The row remains a domain-specific two-column editorial composition:

- Metadata rail: sequence number, club, and schedule date.
- Content rail: title, authors, and optional abstract.
- Trailing chevron: revealed on hover and keyboard focus.

The full-width top, bottom, and between-row dividers are removed. Rows are separated by moderate whitespace. Hover and keyboard focus apply a clearly visible neutral accent surface to the entire rounded row; keyboard focus also receives the theme focus ring. There is no decorative border in the resting state.

Comfortable density uses balanced vertical padding and a two-line abstract preview. Compact density reduces vertical padding, tightens the metadata rhythm, and omits the abstract. Both densities prioritize readable titles and authors, using line clamps only where necessary to prevent narrow-screen overflow.

### Empty and Loading States

- Initial loading uses the existing shadcn `Skeleton` component instead of briefly showing an empty message.
- No upcoming papers: explain that no upcoming papers match the current filters.
- No past papers: explain that no read or missed papers match the selected Past filter.
- Active search or club filters remain visible when a section is empty so the reader can change them.

## Data and Query Design

### Query Inputs

Introduce a serializable Feed filter value shared by query keys and API calls:

```ts
type FeedFilters = {
  clubId: string | null;
  search: string;
};
```

The React Query keys include week start, scope (`upcoming` or `past`), selected club, and normalized search text. Past uses `enabled: showPast`, preventing unnecessary requests while hidden.

### Supabase Queries

Split the dashboard query into upcoming and past functions that share selection and filtering helpers.

- Upcoming predicate: `week_start >= currentWeekStart OR week_start IS NULL`.
- Past predicate: `week_start < currentWeekStart`.
- Club predicate: equality on `club_id` when a club is selected.
- Search predicate: case-insensitive title or abstract matching on an inner joined paper relation.
- Past selection includes the current user's visible `schedule_paper_statuses(status)` relation. RLS already restricts schedule-status rows to the current user.
- Filtering is applied before ordering and limiting.
- Each section returns at most 20 matching rows in this iteration.

Search text is trimmed, whitespace-normalized, and escaped before it enters a PostgREST `or` expression. Empty search text adds no search predicate.

### Client Classification

Past rows are classified with one pure function:

```ts
function getPastPaperState(row): "read" | "missed"
```

The Past status toggle filters the returned past rows without another network request. This classification is covered by unit tests, including missing statuses and non-read statuses such as planned, reading, on-hold, and dropped.

## Component Boundaries

- `DashboardPage`: owns toolbar state, density persistence, the two queries, section composition, and empty/loading decisions.
- `FeedToolbar`: renders shadcn search, club, Past, and density controls.
- `FeedSection`: renders a section heading, count, optional status filter, and list state.
- `FeedPaperItem`: renders one paper in Comfortable or Compact density.
- Schedule API/query modules: own Supabase filtering, sorting, normalization, and stable query keys.
- A small pure Feed utility module owns search normalization and past-state classification.

These components stay Feed-specific. No unrelated Profile or Clubs refactor is included in this sub-project.

## Accessibility and Responsive Behavior

- The page has one level-one heading and each Feed section has a level-two heading.
- Search has a visible or screen-reader label and a descriptive placeholder.
- Switch and toggle controls expose their selected state through their native Radix/shadcn semantics.
- The entire paper row has one clear interactive target; no nested buttons or links are placed inside it.
- Hover, focus-visible, and selected-control states meet contrast requirements in light and dark themes.
- At mobile width, metadata stacks above paper content, controls wrap without horizontal overflow, and Compact remains meaningfully denser than Comfortable.
- At tablet and desktop widths, the existing metadata/content columns remain aligned across rows.

## Verification

Automated verification:

- Unit tests for past classification and search normalization.
- Existing Vitest suite.
- Typecheck, lint, and production build.
- shadcn audit checklist after generated components and Feed code are complete.

Browser verification with authenticated fixture data:

- Light and dark themes.
- 390px mobile, 768px tablet, and 1440px desktop widths.
- No horizontal overflow.
- Strong row hover and keyboard-focus feedback.
- Comfortable/Compact switching and persisted density.
- Past off by default; enabling it reveals a separate section.
- All/Read/Missed classification.
- Club filter, title/abstract search, combined filters, and clear empty states.
- Upcoming and past date ordering, including undated and equal-date rows.

## Out of Scope

- Author search or full-text ranking.
- Pagination or infinite scrolling beyond the first 20 matching rows per section.
- Clubs overview redesign.
- Profile layout redesign.
- Global people discovery.

Those remaining surfaces will follow as separate design and implementation checkpoints so their data/privacy and responsive behavior can be reviewed independently.
