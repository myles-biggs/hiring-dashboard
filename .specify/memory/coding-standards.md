# Coding Standards — Level Hire

> **Agents**: Follow these conventions for all code changes.

## TypeScript

- Strict mode required
- Prefer `unknown` over `any`
- Use type-only imports where possible
- Keep runtime validation with Zod at system boundaries (`lib/schemas/`)
- No `@ts-ignore` without documented justification

## React & Next.js

- Server Components by default; `"use client"` only when required
- Avoid `useEffect` for data fetching — use Server Actions or server-only data access
- Keep route-specific logic in the route's folder
- Client components should be small, leaf-node components

## File & Naming Conventions

| Element             | Convention        | Example                            |
| ------------------- | ----------------- | ---------------------------------- |
| Files               | kebab-case        | `brief-form.tsx`                   |
| Components          | PascalCase        | `BriefForm`                        |
| Variables/functions | camelCase         | `getHiringBrief`                   |
| Route folders       | kebab-case        | `(app)/briefs/`                    |
| Private folders     | underscore prefix | `_components/`, `_hooks/`, `_lib/` |

## Path Aliases

```typescript
// Within this app
import { prisma } from "@/lib/utils/prisma"
import { cn } from "@/lib/utils"
import { authOptions } from "@/lib/auth/config"
```

## Component Organization

```
components/
  brief/       — brief-specific components
  shared/      — shared layout/auth components
  ui/          — shadcn base components (do not edit directly)
```

## API Route Conventions

All API routes return `{ error: string }` on failure with appropriate HTTP status codes.

```typescript
// Standard success
return NextResponse.json({ data }, { status: 200 })

// Standard error
return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

## Integration Patterns

All external API calls (Asana, Workable, Gemini, Slack) are encapsulated in
`lib/integrations/`. Route handlers call these functions — never call external
APIs directly from route handlers or components.

## Commits

- Conventional Commits: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, `test:`
- Run `npm run lint` and `npm run typecheck` before committing

---

_See constitution.md for non-negotiable principles._
