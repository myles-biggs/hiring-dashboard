# Tech Stack — Level Hire

> **Agents**: Reference this before adding dependencies or choosing technologies.

## Core Framework

| Package    | Version | Notes                          |
| ---------- | ------- | ------------------------------ |
| Next.js    | 16.2.x  | App Router, server components  |
| React      | ^19.2.x |                                |
| TypeScript | ^5.x    | Strict mode                    |

## Authentication

| Package               | Version | Notes                                                        |
| --------------------- | ------- | ------------------------------------------------------------ |
| next-auth             | ^4.24.x | Google OAuth, database session strategy, `@level.agency` only |
| @next-auth/prisma-adapter | ^1.0.7 | Prisma session/account storage                          |

## UI & Styling

| Package               | Version | Notes                                    |
| --------------------- | ------- | ---------------------------------------- |
| Tailwind CSS          | ^4.x    | CSS-first config, `@theme` directive     |
| shadcn/ui (via shadcn) | ^4.1.x | Radix primitives, CVA variants           |
| class-variance-authority | ^0.7.x |                                       |
| clsx + tailwind-merge | latest  | `cn()` utility in `lib/utils.ts`         |
| lucide-react          | ^1.0.x  | Icon library                             |
| @base-ui/react        | ^1.3.x  | Accessible headless primitives           |

## Database

| Package        | Version | Notes                         |
| -------------- | ------- | ----------------------------- |
| Prisma         | ^7.5.x  | Multi-file schema in `prisma/schema/` |
| @prisma/client | ^7.5.x  | PostgreSQL (production)       |

## AI / Integrations

| Package                  | Notes                      |
| ------------------------ | -------------------------- |
| @google/generative-ai    | Gemini JD generation       |
| Asana REST API           | Hiring brief intake source |
| Workable REST API        | Job posting target         |
| Slack (via lib/integrations/slack.ts) | Notifications  |

## Forms & Validation

| Package              | Version |
| -------------------- | ------- |
| react-hook-form      | ^7.72.x |
| @hookform/resolvers  | ^5.2.x  |
| zod                  | ^4.3.x  |

## Code Quality

| Package                   | Version | Notes              |
| ------------------------- | ------- | ------------------ |
| ESLint                    | ^9.x    | Flat config        |
| eslint-config-next        | 16.2.1  |                    |
| Prettier                  | ^3.8.x  | With tailwindcss plugin |
| prettier-plugin-tailwindcss | ^0.7.x |                   |

## Runtime Requirements

| Requirement | Version |
| ----------- | ------- |
| Node.js     | ^20.x   |

---

_Source of truth for approved technologies. See constitution.md for deviation process._
