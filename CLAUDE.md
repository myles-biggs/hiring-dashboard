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

## Project Overview

Level Hire is a standalone Next.js app that manages the hiring brief lifecycle for Level Agency:
Asana webhook intake → AI-generated job descriptions (Gemini) → approval workflow → Workable posting.

## Architecture

- **Next.js 16** with App Router, server components by default
- **NextAuth v4** with Google OAuth, database session strategy, `@level.agency` domain
- **Prisma 7** with PostgreSQL, multi-file schema in `prisma/schema/`
- **shadcn/ui** components in `components/ui/`

## Key File Locations

| Need               | Location                        |
| ------------------ | ------------------------------- |
| Auth config        | `lib/auth/config.ts`            |
| Role guards        | `lib/auth/roles.ts`             |
| Prisma client      | `lib/utils/prisma.ts`           |
| Zod schemas        | `lib/schemas/`                  |
| Integration libs   | `lib/integrations/`             |
| AI prompts         | `lib/prompts/`                  |
| Prisma schema      | `prisma/schema/`                |
| Shared components  | `components/shared/`            |
| UI primitives      | `components/ui/`                |
| Route groups       | `app/(app)/` and `app/(auth)/`  |
| API routes         | `app/api/`                      |
| Environment vars   | `.env.local` (see `.env.example`) |

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

1. **Add a route**: Create `app/(app)/your-feature/page.tsx` (server component by default)
2. **Add API route**: Create `app/api/your-feature/route.ts` — call `getServerSession(authOptions)` first
3. **Add Zod schema**: Add validation in `lib/schemas/your-feature.ts`
4. **Add integration**: Add client in `lib/integrations/your-service.ts`
5. **Add schema model**: Add to `prisma/schema/`, run `npm run db:generate`
