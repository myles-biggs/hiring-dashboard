# Lessons Learned — Level Hire

> **Agents**: Review before making changes to avoid known pitfalls.

## Prisma

- Schema is in `prisma/schema/` (multi-file format) — do not create a `prisma/schema.prisma` file
- The Prisma client outputs to the default location; import from `@prisma/client`
- `prisma.config.ts` reads `DATABASE_URL` from `.env.local` or `.env`
- After schema changes: run `npm run db:generate` then restart the dev server

## Authentication (NextAuth v4)

- Session strategy is `database` — sessions are stored in the `Session` table
- The `session` callback attaches `user.id` and `user.role` — both required for auth gates
- `signIn` callback upserts the user record and assigns a role based on email
- Role assignment uses `HR_EMAILS`, `APPROVER_PRIMARY_EMAIL`, `APPROVER_BACKUP_EMAIL` env vars
- `requireRole()` throws `AuthError` — always wrap in try/catch in route handlers

## Asana Integration

- Webhook payloads arrive at `/api/webhooks/asana` — signature verified via `ASANA_WEBHOOK_SECRET`
- Custom field GIDs must be set in env vars before the webhook can parse brief data
- The webhook handler upserts `HiringBrief` records by `asanaTaskId`

## Workable Integration

- Job postings are created via `/api/briefs/[id]/approve` after approval
- `workableJobId` is stored on `HiringBrief` and used to match Workable webhook events

## Gemini JD Generation

- JD generation is triggered at `/api/jd/[briefId]`
- Prompts are in `lib/prompts/jd-generator.ts` — treat prompt changes as code changes
- Generation produces both English and French JDs stored on the brief

## TypeScript Strict Mode

- `noUncheckedIndexedAccess` is enabled — array/object index access returns `T | undefined`
- Always null-check indexed access results before using them
