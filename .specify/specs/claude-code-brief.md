# Level Hire v2 — One-Shot Implementation Brief

> **For Claude Code orchestrator and specialist agents.** Read the entire brief before starting. Phase 1 is sequential. Phases 2A through 2D run in parallel after Phase 1 lands. Phase 3 is the final cleanup pass.

## Required reading before any code

Read these in order. Treat them as binding:

1. `.specify/memory/constitution.md` (v2.0.0)
2. `.specify/memory/tech-stack.md`
3. `.specify/memory/coding-standards.md`
4. `.specify/memory/lessons-learned.md`
5. `CLAUDE.md`
6. `AGENTS.md` — **especially this.** Next.js 16 has breaking changes from training data. Read `node_modules/next/dist/docs/` before writing routing code.

## What we are building

Extending the existing Level Hire app with four new capability areas:

1. **Candidate vetting** — score Workable applicants against job postings via Claude, surface recommended dispositions for human approval, write results back to Workable
2. **Culture evaluation** — process Zoom interview transcripts through Andrew's 8-dimension rubric (GWC + 4 values + AI Forward), produce 1-5 star Workable ratings, same human approval pattern
3. **Reporting dashboard** — three views (State of Hiring weekly, Daily Snapshot daily, Pipeline bi-weekly) replacing the standalone Hiring Intelligence Claude project, with Slack push for exec consumption
4. **Bilingual job post generator** — standalone tool inside the app (its own button), generates English + Canadian French postings via Gemini, pushes drafts to Workable

## What we are removing from runtime (code preserved)

The hiring brief flow (Asana intake → JD generation → approval → Workable posting). Hide behind `ENABLE_BRIEF_FLOW` feature flag. Default `false`. Do not delete code, migrations, models, or tests. Hide UI entry points.

## Manual prerequisites (Andrew + Myles handle before Phase 1)

These are not Claude Code's job. Do not block on them; assume they will be true.

1. Workable Admin custom fields created on candidate records: `jd_match_score`, `jd_match_bucket`, `jd_match_rationale`, `culture_score`, `culture_eval_source`, `culture_eval_notes`, `recommended_action`, `recommendation_rationale`, `evaluated_at`
2. Workable webhook configured to fire `candidate_created` events to `/api/webhooks/workable`
3. Zoom webhook configured to fire `recording.transcript_completed` events to `/api/webhooks/zoom`
4. Env vars set in Vercel: `ANTHROPIC_API_KEY`, `WORKABLE_WEBHOOK_SECRET`, `WORKABLE_API_TOKEN`, `ZOOM_WEBHOOK_SECRET`, `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `HIRING_CALENDAR_ID`, `ADMIN_EMAILS`, `TA_EMAILS`, `VIEWER_EMAILS`, `ENABLE_BRIEF_FLOW=false`

---

## Phase 1: Foundation (sequential, blocks all other phases)

### 1.1 Add Anthropic SDK to tech stack

- `npm install @anthropic-ai/sdk`
- Update `.specify/memory/tech-stack.md`: add row under AI / Integrations
- Update `.env.example`: add `ANTHROPIC_API_KEY=`

### 1.2 Create Claude integration

File: `lib/integrations/claude.ts`

Mirror the structure of `lib/integrations/gemini.ts`. Export a client factory and a typed completion function that accepts a system prompt, user prompt, and Zod schema for structured output validation. Default model: `claude-sonnet-4-6`. Include error handling consistent with existing integrations.

### 1.3 Prisma schema additions

Multi-file format in `prisma/schema/`. Do not modify existing files. Create:

`prisma/schema/candidate.prisma`:

```prisma
model Candidate {
  id                   String   @id @default(cuid())
  workableCandidateId  String   @unique
  workableJobShortcode String
  workableJobTitle     String
  fullName             String
  email                String?
  resumeUrl            String?
  linkedinUrl          String?
  coverLetter          String?  @db.Text
  applicationAnswers   Json?
  applicationSource    String?

  evaluations          Evaluation[]
  dispositions         Disposition[]
  transcripts          InterviewTranscript[]

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  @@index([workableJobShortcode])
}
```

`prisma/schema/evaluation.prisma`:

```prisma
enum EvaluationType {
  JOB_POSTING_FIT
  CULTURE_FIT
}

enum EvaluationSource {
  RESUME
  COVER_LETTER
  APPLICATION_ANSWERS
  LINKEDIN_URL
  TRANSCRIPT
}

model Evaluation {
  id              String   @id @default(cuid())
  candidate       Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  candidateId     String
  type            EvaluationType
  sources         EvaluationSource[]

  score           Int      // 0-100 for JOB_POSTING_FIT, 8-40 for CULTURE_FIT
  bucket          String   // Computed bucket label
  rationale       String   @db.Text
  dimensionScores Json?    // Per-dimension breakdown for CULTURE_FIT

  modelUsed       String
  promptVersion   String
  rawOutput       String   @db.Text

  createdAt       DateTime @default(now())

  @@index([candidateId, type])
  @@index([type, createdAt])
}
```

`prisma/schema/disposition.prisma`:

```prisma
enum DispositionAction {
  ADVANCE
  SCHEDULE_INTERVIEW
  PANEL_REVIEW
  SECOND_OPINION
  HOLD
  DISQUALIFY
}

enum DispositionStatus {
  RECOMMENDED
  APPROVED
  OVERRIDDEN
}

model Disposition {
  id                String   @id @default(cuid())
  candidate         Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  candidateId       String

  recommendedAction DispositionAction
  recommendedReason String   @db.Text

  status            DispositionStatus @default(RECOMMENDED)
  approvedAction    DispositionAction?
  approvedBy        String?
  approvedAt        DateTime?
  approvalNotes     String?  @db.Text

  workableUpdated   Boolean  @default(false)
  workableError     String?

  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([candidateId])
  @@index([status])
}
```

`prisma/schema/interview-transcript.prisma`:

```prisma
model InterviewTranscript {
  id                  String   @id @default(cuid())
  candidate           Candidate @relation(fields: [candidateId], references: [id], onDelete: Cascade)
  candidateId         String

  zoomMeetingId       String   @unique
  zoomRecordingId     String?
  transcriptText      String   @db.Text
  meetingDate         DateTime
  interviewerEmails   String[]

  matchMethod         String   // "workable_native" | "email_match" | "manual"

  processed           Boolean  @default(false)
  processedAt         DateTime?

  createdAt           DateTime @default(now())

  @@index([candidateId])
}
```

Run `npm run db:generate` and create migration via `npm run db:push` for dev. Production migration is via Vercel deploy.

### 1.4 Update Role enum

In the existing role schema file, add new values `TA` and `VIEWER`. Keep existing values (`ADMIN`, `APPROVER`, `HR`, `HIRING_MANAGER`) for historical records. Mark deprecated values in a code comment.

Update `lib/auth/roles.ts`:

- Read `ADMIN_EMAILS`, `TA_EMAILS`, `VIEWER_EMAILS` env vars
- Update role assignment logic in `signIn` callback to map email to new roles
- Add `requireTA()` helper alongside existing `requireApprover()` etc.

### 1.5 Zod schemas

Create the following in `lib/schemas/`:

- `candidate.ts` — Candidate input validation, Workable webhook payload shape
- `evaluation.ts` — Job posting fit output schema, culture fit output schema
- `disposition.ts` — Disposition action enum, approval input
- `transcript.ts` — Zoom webhook payload shape, transcript ingestion input

### 1.6 Bucket logic utility

File: `lib/utils/bucket.ts`

Export pure functions:

```typescript
// Returns "STRONG" | "POSSIBLE" | "PASS"
export function jobPostingBucket(score: number): JdBucket

// Returns "STRONG" | "POSSIBLE" | "WEAK"
export function cultureBucket(score: number): CultureBucket

// Returns the recommended DispositionAction given both buckets (or null for culture)
export function recommendedAction(args: {
  jdBucket: JdBucket
  cultureBucket: CultureBucket | null
}): { action: DispositionAction; reason: string }
```

Threshold defaults (defined as exported constants for easy tuning):

- JD STRONG ≥ 80, POSSIBLE 60-79, PASS < 60
- Culture STRONG ≥ 4 stars (raw ≥ 30), POSSIBLE 3 stars (raw 24-29), WEAK ≤ 2 stars (raw < 24)

Matrix per the spec (see `.specify/specs/hiring-app-spec.md` for full table).

### 1.7 Acceptance criteria

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run db:generate` succeeds
- All new files conform to coding-standards.md naming and organization
- No `"use client"` directive in any new file in Phase 1
- No Prisma client imported in any client code (none exists in this phase but the rule stands)

---

## Phase 2A: Workable extension + JD vetting flow (parallel after Phase 1)

### 2A.1 Extend Workable integration

File: `lib/integrations/workable.ts` (existing — add functions, do not refactor existing job-posting code)

Add typed functions:

- `listPublishedJobs()` — paginated, returns full list
- `listCandidatesForJob(shortcode: string, since?: Date)` — paginated full list
- `getCandidateDetail(workableCandidateId: string)` — resume, cover letter, application answers, LinkedIn, tags, source
- `updateCandidateCustomFields(workableCandidateId: string, fields: Partial<CandidateCustomFields>)`
- `disqualifyCandidate(workableCandidateId: string, dispositionReason: string)`
- `createDraftJob(payload)` — used by Phase 2D
- `setCandidateStarRating(workableCandidateId: string, rating: 1 | 2 | 3 | 4 | 5)`
- `addCandidateComment(workableCandidateId: string, comment: string)`

All functions throw typed errors caught at route handler level.

### 2A.2 Workable webhook

File: `app/api/webhooks/workable/route.ts`

- Verify HMAC signature using `WORKABLE_WEBHOOK_SECRET`
- Handle `candidate_created` event
- Upsert `Candidate` record by `workableCandidateId`
- Trigger background vetting via Server Action (do not block webhook response)

### 2A.3 Vetting prompt

File: `lib/prompts/candidate-vetting.ts`

Export:

- `VETTING_PROMPT_VERSION` constant (semver, start `1.0.0`)
- `buildVettingPrompt(args)` function returning `{ system: string; user: string }`

System prompt requirements:

- Role definition: senior recruiter evaluating fit against a specific job posting
- Output schema: JSON only, conforming to the Zod schema in `lib/schemas/evaluation.ts`
- Score range 0-100 with rubric anchors
- Three-bucket rationale (3-5 sentences)
- Explicit instruction: missing inputs are not penalized, scoring is on what is present
- Explicit instruction: do not consider protected characteristics (name as signal of national origin, age inferences from grad year, etc.)

### 2A.4 Vetting API + Server Action

File: `app/api/candidates/[id]/vet/route.ts`

- Auth required: `requireRole('TA')` or higher
- Loads Candidate + Workable detail
- Calls Claude integration with vetting prompt
- Validates output via Zod
- Writes Evaluation row
- Computes bucket via `lib/utils/bucket.ts`
- Creates Disposition row in RECOMMENDED status
- Updates Workable custom fields (score, bucket, rationale, recommended_action, evaluated_at)
- Returns `{ data: { evaluationId, dispositionId } }`

Server Action wrapper for in-app triggering: `lib/actions/vet-candidate.ts`.

### 2A.5 Approval UI

Route group: `app/(app)/candidates/`

- `page.tsx` — Server Component, list view, filterable by recommended action and job
- `[id]/page.tsx` — Server Component, detail view showing Workable data, evaluation rationale, recommended action, approve/override controls
- `[id]/_components/approval-controls.tsx` — Client Component, calls Server Actions

Server Actions in `lib/actions/disposition.ts`:

- `approveDisposition(dispositionId, notes?)` — sets status APPROVED, executes the action in Workable, marks workableUpdated
- `overrideDisposition(dispositionId, newAction, notes)` — same but with different action

### 2A.6 Backfill script

File: `scripts/revet-existing-candidates.ts`

- Loads all published jobs from Workable
- For each, paginates all active (non-disqualified) candidates
- Calls the vetting Server Action for each new candidate not yet in DB
- Logs progress, errors, summary
- Idempotent: skips candidates already scored

Run via `npx tsx scripts/revet-existing-candidates.ts` after deploy.

### 2A.7 Acceptance criteria for Phase 2A

- A simulated webhook payload triggers full pipeline: Candidate created, Evaluation created, Disposition created in RECOMMENDED, Workable custom fields updated
- Approve action moves Disposition to APPROVED and reflects in Workable
- Override action records the divergence
- Backfill script runs without errors on empty DB (no existing candidates to backfill on first run)
- Lint, typecheck pass

---

## Phase 2B: Zoom + culture eval flow (parallel after Phase 1)

### 2B.1 Zoom integration

File: `lib/integrations/zoom.ts`

OAuth Server-to-Server flow using `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`. Functions:

- `getAccessToken()` — cached
- `getMeetingDetails(meetingId)`
- `getTranscript(recordingId)` — returns text
- `getMeetingParticipants(meetingId)` — returns email list

### 2B.2 Zoom webhook

File: `app/api/webhooks/zoom/route.ts`

- Verify signature using `ZOOM_WEBHOOK_SECRET`
- Handle `recording.transcript_completed`
- Match transcript to Candidate:
  - Primary: query Workable for interview record matching the Zoom meeting ID
  - Fallback: extract candidate email from meeting participants, look up Candidate by email
  - On match: create InterviewTranscript record
  - On no-match: log to a dedicated `unmatched_transcripts` table or log file, do not block

### 2B.3 Culture eval prompt

File: `lib/prompts/culture-eval.ts`

Export `CULTURE_PROMPT_VERSION` and `buildCulturePrompt(args)`.

System prompt requirements:

- Role definition: hiring evaluator scoring against Level Agency's 8-dimension rubric
- The 8 dimensions: Gets It, Wants It, Capacity to Do It, No Ego All In, Better Every Day, Relentless for Results, Driven by Truth, AI Forward
- Each dimension scored 1-5
- Total score 8-40
- Star mapping: 36-40 → 5★, 30-35 → 4★, 24-29 → 3★, 16-23 → 2★, 8-15 → 1★
- Per-dimension evidence from transcript (1-2 quotes per dimension)
- Output schema matches Zod schema in `lib/schemas/evaluation.ts`
- Explicit instruction: do not consider protected characteristics

### 2B.4 Culture eval API

File: `app/api/transcripts/[id]/evaluate/route.ts`

Same pattern as 2A.4: load transcript, call Claude, validate output, write Evaluation, recompute bucket via `lib/utils/bucket.ts` (now using both JD and culture scores), update Disposition recommendation, update Workable star rating + comment.

Server Action wrapper: `lib/actions/evaluate-transcript.ts`.

### 2B.5 Transcript view in candidate detail

Extend the candidate detail page from Phase 2A to show transcript-based evaluation when present. Include per-dimension breakdown.

### 2B.6 Acceptance criteria for Phase 2B

- Simulated Zoom webhook creates InterviewTranscript, triggers evaluation, writes Evaluation row, updates Workable star rating
- Match fallback works when primary lookup fails
- Lint, typecheck pass

---

## Phase 2C: Reporting dashboard (parallel after Phase 1)

### 2C.1 Calendar and Slack integrations

Confirm or extend:

- `lib/integrations/google-calendar.ts` — read events from `HIRING_CALENDAR_ID`, parse interview naming patterns, identify candidates and interviewers
- `lib/integrations/slack.ts` (existing) — extend to read messages from `#hiring-*` channels by ID, search channels by name

### 2C.2 Data access layer

File: `lib/data/reports.ts` (server-only)

Functions returning pre-aggregated data for each report:

- `getStateOfHiringData()` — open roles, interviews this week, decisions needed, evergreen health, blockers
- `getDailySnapshotData()` — today's interviews, pipeline movement in last 24h, action items
- `getPipelineReportData()` — total active pipeline, sourcing mix, referral attribution, by-role breakdown, data quality flags

These functions merge Workable, Calendar, and Slack data per the spec in `.specify/specs/hiring-app-spec.md`.

### 2C.3 Dashboard routes

Route group: `app/(app)/reports/`

- `page.tsx` — Server Component, hub showing all three report tiles
- `state-of-hiring/page.tsx` — Server Component rendering State of Hiring data
- `daily-snapshot/page.tsx` — Server Component rendering Daily Snapshot data
- `pipeline/page.tsx` — Server Component rendering Pipeline Report data

Each report page also exposes a "Push to Slack" button (Client Component) that previews the Slack message + Canvas content and prompts for approval before posting to `#hiring-updates`.

### 2C.4 Slack push Server Action

File: `lib/actions/post-report-to-slack.ts`

- Generates the 5-bullet Slack message and the Canvas content per the formatting rules in the existing project instructions
- Creates the Canvas via Slack API
- Posts the message to `C0B2R77KRB3` with the Canvas link
- Returns confirmation including the message permalink

### 2C.5 Final interview brief auto-compiler

When a candidate enters final interview stage in Workable, a function in `lib/data/reports.ts` compiles the brief:

- Resume URL (from Workable `resume_url`)
- Homework assignment description (from Workable comments or custom field)
- Candidate submission (from Slack channel scan)
- Interview panel (from Calendar)
- Team assessment (from Slack channel scan)
- Values alignment (from Evaluation records)
- Technical skills assessment (from Evaluation records)
- Comp ask vs. budget range (from Workable + hardcoded comp table)

Surfaced in the candidate detail view and included in the State of Hiring report when relevant.

### 2C.6 Acceptance criteria for Phase 2C

- All three report routes render with live data from Workable (Calendar and Slack data are read-only and may be empty in dev)
- Slack push generates correct formatting, requires explicit approval click
- Final interview brief renders for any candidate at final stage
- Lint, typecheck pass

---

## Phase 2D: Bilingual job post generator (parallel after Phase 1)

### 2D.1 Move and rename existing generator

The existing Gemini-based generator currently lives behind the brief flow. Extract it:

- Rename `lib/prompts/jd-generator.ts` to `lib/prompts/job-post-generator.ts` if not already (check actual filename)
- Keep the existing prompt logic intact
- Remove dependencies on the brief flow data model from the prompt-building function — accept role title, role context, comp range, location, and any other inputs directly

### 2D.2 New standalone route

Route: `app/(app)/job-posts/new/`

- `page.tsx` — Server Component shell
- `_components/job-post-form.tsx` — Client Component form (role title, context, comp range, location, Workable account, posting tags)
- `_components/job-post-preview.tsx` — Client Component, side-by-side English + French preview, edit-in-place

Server Actions in `lib/actions/job-post.ts`:

- `generateJobPost(input)` — calls Gemini integration, returns English + French versions
- `pushDraftToWorkable(payload)` — calls `createDraftJob` from Workable integration, returns draft URL

### 2D.3 Navigation entry

Add a "Generate Job Post" button in the main app navigation, gated on `requireTA()` or higher.

### 2D.4 Acceptance criteria for Phase 2D

- Form input produces both English and French outputs
- Outputs are editable before push
- Push to Workable creates a draft (not published) job posting
- Lint, typecheck pass

---

## Phase 3: Cleanup, deprecation, README rewrite (after 2A-2D)

### 3.1 Feature-flag the brief flow

- Add `ENABLE_BRIEF_FLOW` env var check at the top of every brief flow route handler (`/api/briefs/*`, `/api/webhooks/asana`, `/api/jd/*`)
- If `false`, return `{ error: "Brief flow disabled" }` with status 410
- Hide brief flow nav links in the main layout when flag is `false`
- Do NOT delete the routes, components, models, or migrations

### 3.2 README rewrite

File: `README.md` (full replacement, no boilerplate)

Sections:

- What this app does (one paragraph, plain language)
- Architecture overview (Next.js 16, Prisma 7, NextAuth, integrations list)
- Local setup (clone, env, db, dev server)
- Required env vars (full list with descriptions, no values)
- Workable Admin setup checklist (custom fields, webhook)
- Zoom Admin setup checklist (Server-to-Server app, webhook)
- Deploy (Vercel, push to main)
- Development workflow (lint, typecheck, db commands)
- Key file locations (table mirroring CLAUDE.md)
- The four capability areas with route entry points

Voice: direct, no preamble, no marketing language. Reader is a Level Agency engineer or future Claude Code agent.

### 3.3 Update CLAUDE.md

Update the project overview section to match the new product vision. Update the "Adding New Features" patterns section to reflect candidate-side feature paths.

### 3.4 Acceptance criteria for Phase 3

- Brief flow routes return 410 when flag is off
- Brief flow nav entries are hidden
- README is fully rewritten, no `create-next-app` boilerplate text remains
- `npm run lint`, `npm run typecheck`, `npm run build` all pass
- Vercel preview deploy is successful and reachable

---

## Final integration checks (after Phase 3)

Run in order:

1. `npm run lint` — zero errors
2. `npm run typecheck` — zero errors
3. `npm run build` — succeeds
4. Push to PR branch
5. Verify Vercel preview deploys successfully
6. Smoke test the four capability areas in the preview:
   - Trigger a fake Workable webhook (curl) → verify Candidate, Evaluation, Disposition created
   - Trigger a fake Zoom webhook (curl) → verify Transcript and culture Evaluation created
   - Load each of the three report views
   - Generate a bilingual job post and push as draft to Workable test environment
7. Merge to main, ship to production

---

## Hard constraints (binding for every agent)

- No `"use client"` in a file that needs to access Prisma or environment secrets
- No `@ts-ignore`
- No prompts in databases or env vars (only in `lib/prompts/`)
- No automated dispositions, ever
- No model output written to Workable without first writing to the Evaluation table (audit trail)
- No deletion of brief flow code in Phase 3
- All new dependencies require `tech-stack.md` update in the same PR
- All paths use `@/` alias, not relative imports across module boundaries
- File naming: kebab-case files, PascalCase components, camelCase functions
- Every API route handler starts with `getServerSession(authOptions)` and `requireRole(...)` checks
- Conventional commit messages per coding-standards.md

## Parallel execution guide for the orchestrator

After Phase 1 lands and tests pass:

- Spawn four agents on branches `phase/2a-vetting`, `phase/2b-culture`, `phase/2c-reporting`, `phase/2d-job-posts`
- Each agent works in isolation; no cross-branch dependencies
- When all four merge to a `phase-2-integration` branch and tests pass, spawn the Phase 3 cleanup agent
- Final merge to `main` triggers production deploy

End of brief.
