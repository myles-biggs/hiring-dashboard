# Level Hire v2 — Application Spec

> Reference document for Claude Code agents. Cited by the implementation brief. Drop this at `.specify/specs/hiring-app-spec.md` in the repo.

This document is the source of truth for:

- Bucket thresholds and the disposition action matrix
- Workable custom field definitions
- The three report structures (State of Hiring, Daily Snapshot, Pipeline)
- Sourcing classification logic
- Final interview brief field requirements
- Comp ranges, channel registry, team contacts, calendar config

The implementation brief (`.specify/specs/claude-code-brief.md`) drives the build sequence. This document drives the business logic inside that build.

---

## Bucket thresholds

### Job posting fit (Evaluation type `JOB_POSTING_FIT`)

| Bucket   | Score range | Meaning                                       |
| -------- | ----------- | --------------------------------------------- |
| STRONG   | 80–100      | High alignment with role requirements         |
| POSSIBLE | 60–79       | Partial alignment, worth a human look         |
| PASS     | 0–59        | Insufficient alignment for this specific role |

Starting defaults. Export from `lib/utils/bucket.ts` as constants so they're tunable after the first batch of real scoring data. Do not hardcode anywhere else.

### Culture fit (Evaluation type `CULTURE_FIT`)

| Bucket   | Raw score (8–40) | Star rating |
| -------- | ---------------- | ----------- |
| STRONG   | 30–40            | 4–5 stars   |
| POSSIBLE | 24–29            | 3 stars     |
| WEAK     | 8–23             | 1–2 stars   |

Star mapping for Workable:

- 36–40 → 5 stars (Strong Yes)
- 30–35 → 4 stars (Yes)
- 24–29 → 3 stars (Lean Yes)
- 16–23 → 2 stars (No)
- 8–15 → 1 star (Strong No)

---

## Disposition action matrix

The `recommendedAction(args)` function in `lib/utils/bucket.ts` takes a JD bucket and an optional Culture bucket and returns one of the actions below with a human-readable reason string.

| JD bucket | Culture bucket  | Recommended action | Reason string                                                        |
| --------- | --------------- | ------------------ | -------------------------------------------------------------------- |
| STRONG    | STRONG          | ADVANCE            | High alignment on role + culture. Move to offer track.               |
| STRONG    | POSSIBLE        | PANEL_REVIEW       | Strong role fit, culture mixed. Bring panel for tiebreak.            |
| STRONG    | WEAK            | SECOND_OPINION     | Strong role fit but culture concerns. Second TA review before reject.|
| STRONG    | _null_          | SCHEDULE_INTERVIEW | Strong role fit, no culture data yet. Schedule first interview.      |
| POSSIBLE  | STRONG          | ADVANCE            | Strong culture compensates for partial role fit. TA review.          |
| POSSIBLE  | POSSIBLE        | HOLD               | Mixed on both axes. Hold for future role match.                      |
| POSSIBLE  | WEAK            | DISQUALIFY         | Partial role fit, culture concerns. Disqualify for this role.        |
| POSSIBLE  | _null_          | SCHEDULE_INTERVIEW | Partial role fit. Worth a screen to gather culture signal.           |
| PASS      | _any or null_   | DISQUALIFY         | Insufficient role fit. Disqualify for this role, retain in database. |

Rules that bind the matrix:

1. Every recommendation is a recommendation. The Disposition row is created in `RECOMMENDED` status. Workable is NOT updated to disqualify or advance until a human approves.
2. Approved disqualifications use Workable's native disqualification flow with the disposition reason set to the reason string. The candidate record is retained.
3. The recommended action recomputes whenever a new Evaluation of either type is created. The most recent Disposition row in `RECOMMENDED` status is superseded; the prior row stays in the audit trail.
4. The second row (POSSIBLE + STRONG → ADVANCE) is intentional. A 65 JD score with a 5-star culture eval is a stronger candidate than a 78 JD score with no culture data.

---

## Workable custom fields

Andrew creates these on candidate records in Workable Admin before any code runs.

| Field key                  | Type        | Source                               | Notes                                          |
| -------------------------- | ----------- | ------------------------------------ | ---------------------------------------------- |
| `jd_match_score`           | Number      | JD vetting Evaluation                | 0–100                                          |
| `jd_match_bucket`          | Single-line | Computed (STRONG / POSSIBLE / PASS)  |                                                |
| `jd_match_rationale`       | Multi-line  | JD vetting Evaluation                | 3–5 sentences from Claude                      |
| `culture_score`            | Number      | Culture eval Evaluation              | 8–40                                           |
| `culture_eval_source`      | Single-line | Always `Transcript` initially        | Forward-compatible for `Screen Notes` later    |
| `culture_eval_notes`       | Multi-line  | Culture eval Evaluation              | Per-dimension breakdown + total rationale      |
| `recommended_action`       | Single-line | Computed via `recommendedAction()`   | One of the DispositionAction enum values       |
| `recommendation_rationale` | Multi-line  | Computed via `recommendedAction()`   | The reason string from the matrix              |
| `evaluated_at`             | Date        | Most recent Evaluation timestamp     | ISO 8601                                       |

The Workable star rating (1–5) is set via the dedicated star rating endpoint, not as a custom field. Handled by `setCandidateStarRating` in `lib/integrations/workable.ts`.

When writing `culture_eval_notes`, preserve Andrew's existing screener comment format: rubric breakdown by dimension, then overall rationale.

---

## Three report structures

These reports replace the Hiring Intelligence Claude project. The reporting dashboard renders them inside the app. A "Push to Slack" action posts a summary message + Canvas to `#hiring-updates` (`C0B2R77KRB3`) after explicit approval in the UI.

### Common report rules

- Exact counts only. Never "100+" or "10+". Paginate Workable until exhausted.
- Evergreen roles (Account Director, Account Manager, Account Coordinator, Media) are never labeled "stalled" or "slow." Report warm candidates and last activity date.
- Referral attribution combines Workable tags AND Slack-documented referrals into a single count. Flag missing tags in the Pipeline report's data quality section.
- Final interview candidates always include the full final interview brief (see below).

### Report 1: State of Hiring (weekly, strategic)

**Audience:** Bill, Lonn, Myles
**Data sources:** Workable (all published jobs), Hiring Calendar (past 7 + next 7 days), Slack `#hiring-*` (past 7 days)

**Slack message bullets** (5 max, posted to `#hiring-updates`):

1. `:large_green_circle: *Closest to offer:*` role, candidate, what needs to happen
2. `:red_circle: *Decisions needed:*` owner + specific ask (2–3 inline max, else count + "see report")
3. `:calendar: *Active searches:*` N roles, N interviews this week
4. `:arrows_counterclockwise: *Evergreen pipeline health:*` one line
5. `:warning: *Blocker:*` one line, omit if none

**Canvas structure:**

- `## :bar_chart: At a glance` — 3-column: open roles / interviews this week / roles at offer stage
- `## :red_circle: Decisions needed` — callout block per decision, named owner, specific ask
- `## :large_green_circle: Active searches` — one `###` subsection per role with:
  - Pipeline funnel table: `Stage | Candidates | Step conversion`
  - Named candidate table: `Name | Stage | Source | Comp ask | Team assessment | Next step`
  - One-line sourcing mix note (inbound / outbound / referral)
  - Flag callout for any blocking issue
- `## :arrows_counterclockwise: Evergreen pipelines` — single table: `Role | Approval status | Warm candidates | Last activity`
- `## :calendar: On the hiring calendar` — full interview table: `Date | Time | Candidate | Role | Interviewers`

Every Canvas opens with this one-line note before content:

```
:speech_balloon: **To comment on anything in this report:** highlight the text you want to discuss, then click the comment icon that appears. Your comment will notify the hiring team directly.
```

### Report 2: Daily Snapshot (weekdays, operational)

**Audience:** Andrew, Amy, hiring managers
**Data sources:** Hiring Calendar (today), Workable (last 24h), Slack `#hiring-*` (last 24h)

**Slack message bullets:**

1. `:calendar: *On the calendar today:*` N interviews — list each as `Time · Candidate · Role`
2. `:arrows_counterclockwise: *Moved forward:*` candidate names, role, stage change
3. `:clipboard: *Assessments:*` due today or submitted since yesterday
4. `:red_circle: *Needs action today:*` specific asks with owner name

Omit bullets where the answer is "nothing."

**Canvas structure:**

- `## :calendar: Today's interviews` — table: `Time | Candidate | Role | Interviewer | Stage`
- `## :arrows_counterclockwise: Pipeline movement` — table: `Candidate | Role | Previous stage | New stage | Date moved`
- `## :clipboard: Needs action` — bullet list: `Owner · Task · Deadline`

If nothing moved and no interviews: one-line Canvas — "No interviews or pipeline movement today."

### Report 3: Pipeline Report (bi-weekly, sourcing)

**Audience:** Myles, Andrew, Amy
**Data sources:** Workable (all published jobs, full candidate list, paginated), Hiring Calendar (past 14 days), Slack `#hiring-*` (past 14 days)

**Slack message bullets:**

1. `:bar_chart: *Total active pipeline:*` N candidates across N roles
2. `:mag: *Sourcing mix:*` N% inbound · N% outbound sourced · N% referral · N% careers page
3. `:handshake: *Top referral sources:*` Name → Candidate (Role), Name → Candidate (Role)
4. `:large_green_circle: *Outbound in pipeline:*` N sourced candidates, N at assessment or beyond
5. `:warning: *Data quality flag:*` named candidates with missing referral tags (omit if clean)

**Canvas structure:**

- `## :bar_chart: At a glance` — 3-column: total pipeline / outbound sourced / referral
- `## :mag: Sourcing breakdown` — table: `Channel | Candidate count | % of total | % active in pipeline` + one-line conversion note
- `## :handshake: Referral attribution` — table: `Referrer | Candidate | Role | Current stage | Tag status (✓ or missing)`. Single list combining Workable tags + Slack-documented referrals.
- `## :large_green_circle: Sourcing by role` — table: `Role | Inbound | Outbound | Referral | Vendor`. Flag any role that is inbound-only with no outbound activity.
- `## :office: Careers page signal` — table: `Candidate | Role | Stage`. Tracked separately as warm inbound.
- `## :warning: Data quality` — callout per candidate with missing referral tag: name, role, referrer, tags to add.

---

## Sourcing classification logic

Apply in `lib/data/sourcing.ts` (server-only) when classifying each candidate.

| Classification     | Logic                                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| Outbound / sourced | `sourced: true` AND `common_source_category: "Sourced"` AND `common_source: "Uploaded"`               |
| Referral           | Tag matches `_referral` or `referral_` OR documented in Slack `#hiring-*` as a referral                |
| Careers page       | `domain: "level.agency"` AND `common_source: "Careers page"`                                           |
| LinkedIn free      | `domain: "linkedin.com"` AND `outlet: "free_posting"` AND `common_source: "linkedin.com free"`         |
| Workable job board | `domain: "jobs.workable.com"` AND `common_source: "Jobs by Workable"`                                  |
| Indeed             | `domain: "indeed.com"` AND `common_source: "indeed.com free"`                                          |
| Vendor             | `common_source: "Uploaded"` with no internal uploader, OR explicitly documented in Slack as a vendor   |

Referral tag format used by the team: `#[firstname][lastname]_referral` AND `#referral_[firstname][lastname]` (both applied simultaneously). Some referrals applied via the careers page may not be tagged yet; cross-reference Slack channels to catch these.

---

## Final interview brief

When a candidate enters final interview stage (Workable stage kind `interview` with `final` in the stage name, or a custom stage flagged as final), the candidate detail page auto-compiles this brief. The State of Hiring report also includes it for any candidate flagged as closest to offer.

Required fields:

1. **Resume URL** — from Workable `resume_url` (direct link, not Workable backend URL)
2. **Homework assignment** — description of what was given to the candidate
3. **Candidate submission** — link or description, sourced from Slack `#hiring-*` channel
4. **Interview panel** — list of interviewers + dates, from Google Calendar
5. **Team assessment** — compiled from Slack `#hiring-*` channel messages
6. **Values alignment** — per-dimension scores from culture Evaluation: No Ego All In, Better Every Day, Relentless for Results, Driven by Truth
7. **Technical skills assessment** — from culture Evaluation (GWC dimensions) + technical interview notes from Slack
8. **Future focus / AI fluency** — from culture Evaluation (AI Forward dimension)
9. **Comp ask vs. budget range** — candidate's stated ask from Workable + the budget range from the comp table

---

## Comp ranges (May 2026 snapshot)

Hardcoded in `lib/data/comp-ranges.ts`. Move to a Workable custom field on the job posting later.

| Role                       | Type      | USD range  | CAD range   | Approved by |
| -------------------------- | --------- | ---------- | ----------- | ----------- |
| Paid Media Manager         | Backfill  | $65–95K    | $80–115K    | Nicole      |
| SEO Analyst                | New       | $65–95K    | $70–100K    | Nicole      |
| Strategy Lead              | Backfill  | $75–90K    | $100–125K   | Lisa        |
| Analytics Impl. Manager    | New       | $100–125K  | $90–115K    | Nicole      |
| Technical Project Manager  | New       | $90–130K   | $80–115K    | Nicole      |
| Summer Interns             | New       | $18/hr     | $18/hr      | Bill        |
| Account Manager            | Evergreen | $65–95K    | $75–105K    | Pending     |
| Account Coordinator        | Evergreen | $45–65K    | $55–75K     | Pending     |
| Account Director           | Evergreen | $85–125K   | $90–130K    | Pending     |

Note: SEO role budget is at Analyst level but top candidates are Manager-level. Surface this in the Pipeline report when SEO candidates exceed the budget range.

---

## Slack channel registry

Used by the reporting layer to scan for narrative context, referrals, team assessments.

| Channel                                       | ID            | Purpose                              |
| --------------------------------------------- | ------------- | ------------------------------------ |
| `#hiring-updates`                             | `C0B2R77KRB3` | All reports post here                |
| `#hiring`                                     | `C01M1LW58E8` | General hiring discussion            |
| `#hiring-media-manager`                       | `C0A3PUVTC06` | Paid Media Manager pipeline          |
| `#hiring-seo`                                 | `C0908T10PM0` | SEO role pipeline                    |
| `#hiring-strategy-lead`                       | `C0ANV6GSWBU` | Strategy Lead pipeline               |
| `#hiring-analytics-implementation-manager`    | `C0ATW6V0C11` | AIM pipeline                         |
| `#hiring-technical-project-manager`           | `C0AU66ATADS` | TPM pipeline                         |
| `#hiring-account-manager`                     | `C07RRAVU74H` | AM pipeline                          |
| `#hiring-account-coordinator`                 | `C08CC1494V9` | AC pipeline                          |
| `#hiring-account-director`                    | `C081VAH96SY` | AD pipeline                          |
| `#hiring-interns`                             | `C0B246HRT7D` | Summer intern pipeline               |
| `#hiring-media`                               | `C084J380206` | Media evergreen channel              |

---

## Hiring team

| Name           | Role                       | Email                          |
| -------------- | -------------------------- | ------------------------------ |
| Andrew Mucha   | TA Lead                    | andrew.mucha@level.agency      |
| Amy Lampitt    | TA Coordinator             | amy.lampitt@level.agency       |
| Myles Biggs    | Head of People Ops         | myles.biggs@level.agency       |
| Bill Buchanan  | COO (exec audience)        | bill.buchanan@level.agency     |
| Lonn Shulkin   | CPO (exec audience)        | lonn.shulkin@level.agency      |

---

## Hiring Calendar

| Item     | Value                                                                                |
| -------- | ------------------------------------------------------------------------------------ |
| ID       | `c_ed1c45a8be1971c46b26e4db26edb9e7badf1a2747ed5eee08e1d0e934f19d31@group.calendar.google.com` |
| Env var  | `HIRING_CALENDAR_ID`                                                                 |

Interview event naming patterns (observed, not enforced):

- `Interview - [Name] - [Role]`
- `[Role] - [Name]`
- `Final Interview - [Role] - [Name]`
- `[Name] - Assessment Walk Through - [Role]`

The reporting layer matches events to candidates by attendee email when possible, falling back to name parsing from the title.

---

## Workable reference

| Item              | Value          |
| ----------------- | -------------- |
| Subdomain         | `levelagency`  |
| Andrew's Asana GID | `1200200884846224` |

### Open roles registry (May 2026)

| Role                       | Shortcode    | Type      | Dept     | Headcount |
| -------------------------- | ------------ | --------- | -------- | --------- |
| Paid Media Manager         | `FFBB49E14E` | Backfill  | Media    | 2         |
| SEO Analyst                | `7B68138F20` | New       | SEO      | 1         |
| Strategy Lead              | `38418FE081` | Backfill  | Strategy | 1         |
| Analytics Impl. Manager    | `6D36FCAFFE` | New       | Martech  | 1         |
| Technical Project Manager  | `1BBC8F63CA` | New       | Martech  | 1         |
| Summer Interns             | `5D94E5B310` | New       | Various  | 3–6       |
| Account Manager            | `BEDDF70F63` | Evergreen | Clients  | ongoing   |
| Account Coordinator        | `BE07613001` | Evergreen | Clients  | ongoing   |
| Account Director           | `94767C19BA` | Evergreen | Clients  | ongoing   |

### Workable stage vocabulary

- `applied` → Applied
- `phone-screen` → TA Initial Screen, Hiring Team Review, or Hiring Manager Interview (check stage name)
- `interview` → SME/Team Interview
- `assessment` → Assessment
- `offer` → Offer stage
- `hired` → Hired

---

End of spec.
