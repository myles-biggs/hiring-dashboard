# CLAUDE.md

> Instructions for AI coding agents working in this codebase.

## Documentation Tiers

This app includes `.specify/memory/` documents that define platform principles:

| File                  | What It Covers                                                           |
| --------------------- | ------------------------------------------------------------------------ |
| `constitution.md`     | Non-negotiable principles (server-first, no Prisma in client, auth)      |
| `tech-stack.md`       | Approved technologies and versions                                       |
| `coding-standards.md` | Conventions, patterns, component organization, API patterns              |
| `lessons-learned.md`  | Gotchas, architecture decisions, common mistakes                         |

**Read `.specify/memory/constitution.md` before making architectural decisions.**

The full v2 implementation brief is at `.specify/specs/claude-code-brief.md`.
The disposition matrix and scoring spec is at `.specify/specs/hiring-app-spec.md`.

## Project Overview

Level Hire is a hiring operations platform for Level Agency. It scores Workable applicants against job postings and culture dimensions via Claude, surfaces disposition recommendations for TA review, generates bilingual job postings via Gemini, and produces hiring dashboard reports with Slack push.

The legacy brief flow (Asana intake → JD generation → Workable posting) is preserved in code but disabled via `ENABLE_BRIEF_FLOW=false`.

## Architecture

- **Next.js 16** with App Router, server components by default
- **NextAuth v4** with Google OAuth, database session strategy, `@level.agency` domain
- **Prisma 7** with PostgreSQL (Neon), multi-file schema in `prisma/schema/`
- **Claude** (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` — candidate vetting + culture eval
- **Gemini** via `@google/generative-ai` — bilingual job post generation
- **Inngest** — background jobs, nightly sync, durable workflows
- **shadcn/ui** components in `components/ui/`

## Key File Locations

| Need                        | Location                             |
| --------------------------- | ------------------------------------ |
| Auth config                 | `lib/auth/config.ts`                 |
| Role guards                 | `lib/auth/roles.ts`                  |
| Feature flags               | `lib/utils/feature-flags.ts`         |
| Prisma client               | `lib/utils/prisma.ts`                |
| Bucket / disposition logic  | `lib/utils/bucket.ts`                |
| Zod schemas                 | `lib/schemas/`                       |
| Integration clients         | `lib/integrations/`                  |
| AI prompts                  | `lib/prompts/`                       |
| Server actions              | `lib/actions/`                       |
| Report data layer           | `lib/data/reports.ts`                |
| Background jobs             | `lib/inngest/functions.ts`           |
| Prisma schema               | `prisma/schema/`                     |
| Shared components           | `components/shared/`                 |
| UI primitives               | `components/ui/`                     |
| App pages                   | `app/(app)/`                         |
| Auth pages                  | `app/(auth)/`                        |
| API routes                  | `app/api/`                           |
| Environment vars            | `.env.local` (see `.env.example`)    |

## Essential Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run lint         # ESLint
npm run typecheck    # TypeScript check
npm run db:generate  # Regenerate Prisma client after schema changes
npm run db:push      # Push schema changes to database
npm run db:studio    # Open Prisma Studio GUI
```

## Adding New Features

### Candidate-side features (vetting, culture, dispositions)

1. **Schema**: Add model to `prisma/schema/`, run `npm run db:generate`
2. **Zod schema**: Add validation in `lib/schemas/your-feature.ts`
3. **Server action**: Add to `lib/actions/your-action.ts` — `"use server"` at top, `requireRole()` first line
4. **API route**: `app/api/your-feature/route.ts` — `getServerSession(authOptions)` + `requireRole()` first
5. **Page**: `app/(app)/your-feature/page.tsx` — server component, `requireRole()` or redirect
6. **Client component**: `app/(app)/your-feature/_components/your-component.tsx` — `"use client"`, no Prisma

### Integration / webhook features

1. Verify signature in the route handler before parsing payload
2. Respond `200` immediately — trigger heavy work as fire-and-forget or Inngest event
3. Write to DB before writing to external services (audit trail)
4. Never auto-approve dispositions — always write `RECOMMENDED` status, require human approval

### Hard constraints (always enforced)

- No `"use client"` in any file that imports Prisma or reads environment secrets
- No `@ts-ignore`
- No prompts in DB or env vars — only in `lib/prompts/`
- No automated dispositions — `RECOMMENDED` status only, human approval required
- All new dependencies require `tech-stack.md` update in the same PR
- All paths use `@/` alias, not relative imports across module boundaries
- Every API route handler: `getServerSession(authOptions)` + `requireRole()` before any logic
