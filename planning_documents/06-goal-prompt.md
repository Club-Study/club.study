# Goal Prompt

Use this prompt when starting implementation:

```text
/goal Build the club.study MVP PWA in /Users/thomashagland/dev/club.study. Before coding, read every file in /planning_documents, especially 01-product-spec.md, 02-architecture.md, 03-data-model-and-rls.md, 04-ui-and-routes.md, and 05-implementation-plan.md.

Treat /planning_documents as ground truth. Do not edit or reinterpret those docs during implementation unless the user explicitly asks for a planning change. Implement in vertical feature slices; after each slice, spawn a review agent for correctness, simplicity, security/RLS, maintainability, and tests. Do not move to the next slice until blocking review findings are fixed or explicitly documented.

Implement the narrow launch loop first: Supabase Google OAuth, profile upsert, private club creation, invite-link acceptance, one scheduled paper per club/week, arXiv URL/ID metadata import, manual external paper fallback, scheduled-paper comments, read/unread status, and a compact dashboard/current-week view.

Use Vite + React + TypeScript, shadcn/ui + Tailwind v4, TanStack Router, TanStack Query, Zod, React Hook Form, Supabase Auth/Postgres/Edge Functions, and vite-plugin-pwa. Style should be restrained, dense, neutral, and Linear-like: thin borders, compact typography, no marketing hero, no decorative gradients.

Important scope: do not implement open clubs, admin user search/add, admin role, user-uploaded PDFs, Supabase Storage, full arXiv search UI, GitHub-style activity grid, email invites, or inline PDF annotations in MVP. Keep the architecture ready for these later, but do not build them now.

Critical arXiv policy: store only metadata: title, authors, abstract, canonical arXiv ID, DOI, license, abstract URL, PDF URL, published/updated dates. Do not proxy, mirror, upload, cache, fetch bytes, or re-serve arXiv PDFs from Supabase Storage, Edge Functions, service workers, app caches, or any project-owned infrastructure. PDF actions must link directly to arXiv.

Database requirements: explicitly enable RLS and grants in migrations; use owner/member roles only; use week_start date; use RPCs for create_club, create_invite_link, accept_invite, schedule_arxiv_paper, schedule_manual_paper, and toggle_read_status; add indexes and RLS tests from 03-data-model-and-rls.md.

Configure TanStack Router with file-based routes, generated route types, typed params, Zod-validated search params, and Query client route context. PWA caching must be static app-shell only; do not cache Supabase responses, Edge Function responses, private data, PDFs, signed URLs, or Authorization-bearing requests.

Tests are the release gate. Run install, typecheck, lint, build, unit tests for arXiv/date/query helpers, Playwright smoke flows, Supabase migration/RLS validation if CLI/Docker are available, and PWA cache inspection proving no private/API/PDF data is cached. Use a final review agent and resolve all blocking findings before claiming done. Report blockers such as missing Supabase credentials, Google OAuth config, Docker, or network access.
```

The prompt is intentionally under 4000 characters and points implementation work back to the detailed planning documents.
