# Level Hire — Constitution

> **Agents**: This document defines non-negotiable principles for all code changes.
> Read this before making architectural decisions. It supersedes all other guidance.

## Product Vision

Internal hiring platform for Level Agency. Manages the full hiring brief lifecycle:
Asana webhook intake → AI-generated job descriptions (Gemini) → approval workflow →
Workable job posting. Runs as a standalone Next.js app.

**Target Audience**: Level Agency employees only (HR, Hiring Managers, Approvers, Admins)

## Core Principles

### I. Server-First Architecture

All components are Server Components by default. Add `"use client"` only when the
component requires browser APIs, event handlers, or React hooks.

- Client components must be small, leaf-node components
- Data fetching happens in Server Components or Server Actions
- Pass data to client components as props, never import the Prisma client in client code
- Mutations use Server Actions (`"use server"`)

### II. No Prisma in Client Components

**NEVER** import `@/lib/utils/prisma` or any module that transitively imports
Prisma in a `"use client"` file.

| Code Type                         | Can Import Prisma? |
| --------------------------------- | ------------------ |
| Server Component                  | Yes                |
| Server Action (`"use server"`)    | Yes                |
| Client Component (`"use client"`) | **NEVER**          |
| Route Handler (`route.ts`)        | Yes                |

### III. Authentication

- NextAuth v4 with Google OAuth, database session strategy
- All users must have `@level.agency` email (enforced via role assignment in signIn callback)
- Role hierarchy: ADMIN > APPROVER > HR > HIRING_MANAGER
- Auth check in all route handlers: `getServerSession(authOptions)`
- Role enforcement via `requireRole()` from `@/lib/auth/roles`

### IV. Type Safety

- TypeScript strict mode required
- Prefer `unknown` over `any`
- Use Zod for all runtime validation at system boundaries (`lib/schemas/`)
- No `@ts-ignore` without documented justification

### V. Error Handling

- Every API route must return typed `{ error: string }` responses on failure
- Use `handleAuthError()` from `@/lib/auth/roles` for auth error responses
- Integration errors (Asana, Workable, Gemini, Slack) must be caught and logged

## Technology Stack

See `tech-stack.md` for approved technologies.

## Development Workflow

### Quality Gates

Before committing, run:

1. `npm run lint` — ESLint
2. `npm run typecheck` — TypeScript strict mode

### Commit Standards

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`

---

**Version**: 1.0.0 | **Project**: level-hire
