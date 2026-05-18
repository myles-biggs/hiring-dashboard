# Level Hire

Internal hiring operations platform for Level Agency. Ingests candidates from Workable, scores them against job postings and culture dimensions via Claude, surfaces disposition recommendations for TA review, and generates bilingual (English + Canadian French) job postings via Gemini.

---

## Architecture

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, server components by default |
| Auth | NextAuth v4, Google OAuth, `@level.agency` domain enforced |
| Database | Prisma 7, PostgreSQL (Neon), multi-file schema in `prisma/schema/` |
| Background jobs | Inngest |
| AI — vetting | Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk` |
| AI — job posts | Google Gemini via `@google/generative-ai` |
| Candidate data | Workable SPI v3 |
| Interview data | Zoom Server-to-Server OAuth |
| Notifications | Slack Bot API |
| UI components | `@levelinteractive/ui`, shadcn/ui primitives |

---

## Local setup

```bash
git clone <repo>
cd level-hire
cp .env.example .env.local   # fill in values
npm install
npm run db:generate
npm run db:push              # applies schema to dev database
npm run dev
```

App runs at `http://localhost:3000`. Sign in with a `@level.agency` Google account.

---

## Required environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_URL` | App base URL |
| `NEXTAUTH_SECRET` | NextAuth signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `ANTHROPIC_API_KEY` | Anthropic API key for candidate vetting + culture eval |
| `WORKABLE_API_TOKEN` | Workable API token |
| `WORKABLE_SUBDOMAIN` | Workable account subdomain |
| `WORKABLE_WEBHOOK_SECRET` | HMAC secret for Workable webhook verification |
| `ZOOM_ACCOUNT_ID` | Zoom Server-to-Server OAuth account ID |
| `ZOOM_CLIENT_ID` | Zoom Server-to-Server OAuth client ID |
| `ZOOM_CLIENT_SECRET` | Zoom Server-to-Server OAuth client secret |
| `ZOOM_WEBHOOK_SECRET` | Secret for Zoom webhook HMAC verification |
| `SLACK_BOT_TOKEN` | Slack bot token (hiring channels) |
| `SLACK_HIRING_CHANNEL_ID` | Default Slack channel for report pushes |
| `HIRING_CALENDAR_ID` | Google Calendar ID for interview scheduling |
| `INTERNAL_SERVICE_KEY` | Service key for internal API-to-API calls |
| `ADMIN_EMAILS` | Comma-separated list of admin email addresses |
| `TA_EMAILS` | Comma-separated list of TA email addresses |
| `VIEWER_EMAILS` | Comma-separated list of viewer email addresses |
| `INNGEST_SIGNING_KEY` | Inngest signing key |
| `INNGEST_EVENT_KEY` | Inngest event key |
| `NEXT_PUBLIC_APP_URL` | Public app URL (used by webhook → eval pipeline) |
| `ENABLE_BRIEF_FLOW` | `"true"` to enable legacy Asana brief flow. Default: `"false"` |

---

## Workable Admin setup checklist

Before deploying to production:

1. Create custom fields on candidate records (type: text or number as appropriate):
   - `jd_match_score`, `jd_match_bucket`, `jd_match_rationale`
   - `culture_score`, `culture_eval_source`, `culture_eval_notes`
   - `recommended_action`, `recommendation_rationale`, `evaluated_at`
2. Create a webhook in Workable → Settings → Integrations → Webhooks:
   - Event: `candidate_created`
   - URL: `https://your-domain.com/api/webhooks/workable`
   - Secret: set as `WORKABLE_WEBHOOK_SECRET`

---

## Zoom Admin setup checklist

1. Create a Server-to-Server OAuth app in Zoom Marketplace
2. Grant scopes: `recording:read`, `meeting:read`, `user:read`
3. Note Account ID, Client ID, Client Secret → set as `ZOOM_*` env vars
4. Add a webhook endpoint under Event Subscriptions:
   - Event: `recording.transcript_completed`
   - URL: `https://your-domain.com/api/webhooks/zoom`
   - Secret token: set as `ZOOM_WEBHOOK_SECRET`

---

## Deploy

Push to `main` triggers a Vercel production deploy. No manual steps required.

For schema migrations:

```bash
npm run db:push        # dev (no migration history)
npm run db:migrate:deploy  # production (runs pending migrations)
```

---

## Development workflow

```bash
npm run dev            # Start dev server (localhost:3000)
npm run lint           # ESLint
npm run typecheck      # TypeScript check (no emit)
npm run build          # Production build
npm run db:generate    # Regenerate Prisma client after schema changes
npm run db:push        # Push schema to database
npm run db:studio      # Open Prisma Studio
```

---

## Key file locations

| Need | Location |
|---|---|
| Auth config | `lib/auth/config.ts` |
| Role guards | `lib/auth/roles.ts` |
| Feature flags | `lib/utils/feature-flags.ts` |
| Prisma client | `lib/utils/prisma.ts` |
| Bucket / disposition logic | `lib/utils/bucket.ts` |
| Zod schemas | `lib/schemas/` |
| Integration clients | `lib/integrations/` |
| AI prompts | `lib/prompts/` |
| Server actions | `lib/actions/` |
| Report data layer | `lib/data/reports.ts` |
| Prisma schema | `prisma/schema/` |
| Shared components | `components/shared/` |
| UI primitives | `components/ui/` |
| App pages | `app/(app)/` |
| Auth pages | `app/(auth)/` |
| API routes | `app/api/` |
| Background jobs | `lib/inngest/functions.ts` |

---

## Capability areas

### 1. Candidate vetting (`/candidates`)

Workable fires a `candidate_created` webhook → `app/api/webhooks/workable/route.ts` → scores candidate against job posting via Claude → creates `Evaluation` + `Disposition` records → writes scores back to Workable custom fields. TA reviews and approves or overrides in the candidates UI.

Entry point: `app/(app)/candidates/`

### 2. Culture evaluation (`/candidates/[id]`)

Zoom fires `recording.transcript_completed` → `app/api/webhooks/zoom/route.ts` → matches transcript to candidate → scores against Level Agency's 8-dimension rubric via Claude → updates Workable star rating. Transcript view available on the candidate detail page.

Entry point: transcript-based evaluation shown inline on `app/(app)/candidates/[id]/page.tsx`

### 3. Reporting dashboard (`/reports`)

Three views pulling live data from Workable, Google Calendar, and Slack:
- **State of Hiring** — weekly summary, open roles, interview volume, blockers
- **Daily Snapshot** — today's interviews, pipeline movement
- **Pipeline Report** — sourcing mix, referral attribution, data quality

Each view has a "Push to Slack" button (requires explicit approval click before posting).

Entry point: `app/(app)/reports/`

### 4. Job post generator (`/job-posts/new`)

Standalone form for generating English + Canadian French job postings via Gemini. Side-by-side preview with edit-in-place. Pushes draft (not published) to Workable on approval.

Entry point: `app/(app)/job-posts/new/`

---

## Legacy brief flow

The original Asana intake → JD generation → Workable posting flow is preserved in code but disabled by default (`ENABLE_BRIEF_FLOW=false`). All brief routes return `410 Gone` when the flag is off. Set `ENABLE_BRIEF_FLOW=true` to re-enable.
