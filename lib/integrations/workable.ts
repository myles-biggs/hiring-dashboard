import { WorkableCandidate, WorkableEmailTemplate, WorkableJob } from "@/types/workable";

const BASE_URL = `https://${process.env.WORKABLE_SUBDOMAIN}.workable.com/spi/v3`;

async function workableFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.WORKABLE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Workable API error ${res.status}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export async function createJob(data: {
  title: string;
  department: string;
  employmentType: string;
  descriptionEnglish: string;
  descriptionFrench?: string | null;
}): Promise<{ shortcode: string; id: string }> {
  const employmentTypeMap: Record<string, string> = {
    "Full-time": "full-time",
    "Part-time": "part-time",
  };

  const body: Record<string, unknown> = {
    job: {
      title: data.title,
      full_title: data.title,
      description: data.descriptionEnglish,
      employment_type: employmentTypeMap[data.employmentType] ?? "full-time",
      department: data.department,
      remote: true,
      state: "published",
    },
  };

  if (data.descriptionFrench) {
    body.translations = [
      {
        locale: "fr",
        description: data.descriptionFrench,
      },
    ];
  }

  const result = await workableFetch<{ job: { shortcode: string; id: string } }>("/jobs", {
    method: "POST",
    body: JSON.stringify(body),
  });

  return { shortcode: result.job.shortcode, id: result.job.id };
}

export async function getJobs(): Promise<WorkableJob[]> {
  const data = await workableFetch<{ jobs: WorkableJob[] }>("/jobs?state=published");
  return data.jobs;
}

export async function getJob(shortcode: string): Promise<WorkableJob> {
  const data = await workableFetch<{ job: WorkableJob }>(`/jobs/${shortcode}`);
  return data.job;
}

export async function getCandidatesForJob(jobShortcode: string): Promise<WorkableCandidate[]> {
  const data = await workableFetch<{ candidates: (Omit<WorkableCandidate, "stage"> & { stage: WorkableCandidate["stage"] | string })[] }>(
    `/jobs/${jobShortcode}/candidates`
  );
  // Workable list endpoint returns stage as a plain string; normalize to object
  return data.candidates.map((c) => ({
    ...c,
    stage: typeof c.stage === "string"
      ? { name: c.stage, kind: "applied", position: 0 }
      : c.stage,
  })) as WorkableCandidate[];
}

export async function getCandidate(candidateId: string): Promise<WorkableCandidate> {
  const data = await workableFetch<{ candidate: WorkableCandidate }>(
    `/candidates/${candidateId}`
  );
  return data.candidate;
}

export async function addCandidateNote(
  candidateId: string,
  body: string,
  policy: "simple" | "timed" = "simple"
): Promise<void> {
  await workableFetch(`/candidates/${candidateId}/activities`, {
    method: "POST",
    body: JSON.stringify({
      action: "note",
      body,
      policy,
    }),
  });
}

export interface WorkableStageOption {
  slug: string;
  name: string;
  kind: string;
  position: number;
}

export async function getJobStages(jobShortcode: string): Promise<WorkableStageOption[]> {
  const data = await workableFetch<{ stages: WorkableStageOption[] }>(
    `/jobs/${jobShortcode}/stages`
  );
  return data.stages;
}

export async function moveCandidate(
  jobShortcode: string,
  candidateId: string,
  targetStageSlug: string
): Promise<void> {
  await workableFetch(`/jobs/${jobShortcode}/candidates/${candidateId}/move`, {
    method: "POST",
    body: JSON.stringify({ stage_slug: targetStageSlug }),
  });
}

export async function disqualifyCandidate(
  jobShortcode: string,
  candidateId: string,
  reason: string
): Promise<void> {
  await workableFetch(`/jobs/${jobShortcode}/candidates/${candidateId}/disqualify`, {
    method: "POST",
    body: JSON.stringify({ disqualification_reason: reason }),
  });
}

export async function closeJob(jobShortcode: string): Promise<void> {
  await workableFetch(`/jobs/${jobShortcode}`, {
    method: "PATCH",
    body: JSON.stringify({ job: { state: "closed" } }),
  });
}

export async function getEmailTemplates(): Promise<WorkableEmailTemplate[]> {
  const data = await workableFetch<{ email_templates: WorkableEmailTemplate[] }>(
    "/email_templates?state=active"
  );
  return data.email_templates ?? [];
}

export async function sendCandidateEmail(
  jobShortcode: string,
  candidateId: string,
  subject: string,
  body: string,
  senderEmail?: string
): Promise<void> {
  await workableFetch(`/jobs/${jobShortcode}/candidates/${candidateId}/activities`, {
    method: "POST",
    body: JSON.stringify({
      action: "email",
      subject,
      body,
      ...(senderEmail ? { sender_email: senderEmail } : {}),
    }),
  });
}

// Workable does not sign webhook payloads. We verify via a shared token
// embedded in the webhook URL query string (?token=...).
export function verifyWebhookToken(token: string | null): boolean {
  const expected = process.env.WORKABLE_WEBHOOK_SECRET;
  if (!expected || !token) return false;
  return token === expected;
}

// ─── HMAC-SHA256 webhook signature verification ───────────────────────────────

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): Promise<boolean> {
  const secret = process.env.WORKABLE_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const computed = Buffer.from(sig).toString("hex");
  return computed === signatureHeader;
}

// ─── Paginated jobs ───────────────────────────────────────────────────────────

type JobsPage = { jobs: WorkableJob[]; paging?: { next?: string } };

export async function listPublishedJobs(): Promise<WorkableJob[]> {
  const jobs: WorkableJob[] = [];
  let nextPath: string | null = "/jobs?state=published&limit=50";

  while (nextPath) {
    const page: JobsPage = await workableFetch<JobsPage>(nextPath);
    jobs.push(...page.jobs);
    if (page.paging?.next) {
      const nextUrl = new URL(page.paging.next);
      nextPath = nextUrl.pathname.replace(/^\/spi\/v3/, "") + nextUrl.search;
    } else {
      nextPath = null;
    }
  }

  return jobs;
}

// ─── Paginated candidates for a job ──────────────────────────────────────────

export async function listCandidatesForJob(
  shortcode: string,
  since?: Date
): Promise<WorkableCandidate[]> {
  const candidates: WorkableCandidate[] = [];
  const sinceParam = since ? `&created_after=${since.toISOString()}` : "";
  let nextPath: string | null = `/jobs/${shortcode}/candidates?limit=50${sinceParam}`;

  type RawCandidate = Omit<WorkableCandidate, "stage"> & {
    stage: WorkableCandidate["stage"] | string;
  };
  type CandidatesPage = { candidates: RawCandidate[]; paging?: { next?: string } };

  while (nextPath) {
    const page: CandidatesPage = await workableFetch<CandidatesPage>(nextPath);
    const normalized: WorkableCandidate[] = page.candidates.map(
      (c: RawCandidate) => ({
        ...c,
        stage:
          typeof c.stage === "string"
            ? { name: c.stage, kind: "applied", position: 0 }
            : c.stage,
      })
    );

    candidates.push(...normalized);
    if (page.paging?.next) {
      const nextUrl = new URL(page.paging.next);
      // Strip the /spi/v3 prefix so it doesn't duplicate BASE_URL
      nextPath = nextUrl.pathname.replace(/^\/spi\/v3/, "") + nextUrl.search;
    } else {
      nextPath = null;
    }
  }

  return candidates;
}

// ─── Candidate detail ─────────────────────────────────────────────────────────

export interface WorkableCandidateDetail extends WorkableCandidate {
  answers?: { question: string; answer?: string }[];
  source?: { id?: string; name?: string };
}

export async function getCandidateDetail(
  workableCandidateId: string
): Promise<WorkableCandidateDetail> {
  const data = await workableFetch<{ candidate: WorkableCandidateDetail }>(
    `/candidates/${workableCandidateId}`
  );
  return data.candidate;
}

// ─── Custom fields ────────────────────────────────────────────────────────────

export interface CandidateCustomFields {
  jd_match_score?: number;
  jd_match_bucket?: string;
  jd_match_rationale?: string;
  culture_score?: number;
  culture_eval_source?: string;
  culture_eval_notes?: string;
  recommended_action?: string;
  recommendation_rationale?: string;
  evaluated_at?: string;
}

export async function updateCandidateCustomFields(
  workableCandidateId: string,
  fields: Partial<CandidateCustomFields>
): Promise<void> {
  const customFields = Object.entries(fields).map(([key, value]) => ({
    field_key: key,
    value: String(value ?? ""),
  }));

  await workableFetch(`/candidates/${workableCandidateId}`, {
    method: "PATCH",
    body: JSON.stringify({ candidate: { custom_fields: customFields } }),
  });
}

// ─── Draft job creation ───────────────────────────────────────────────────────

export async function createDraftJob(payload: {
  title: string;
  department: string;
  description: string;
  employmentType: string;
}): Promise<{ shortcode: string; id: string }> {
  const employmentTypeMap: Record<string, string> = {
    "Full-time": "full-time",
    "Part-time": "part-time",
  };

  const result = await workableFetch<{ job: { shortcode: string; id: string } }>("/jobs", {
    method: "POST",
    body: JSON.stringify({
      job: {
        title: payload.title,
        department: payload.department,
        description: payload.description,
        employment_type: employmentTypeMap[payload.employmentType] ?? "full-time",
        state: "draft",
      },
    }),
  });

  return { shortcode: result.job.shortcode, id: result.job.id };
}

// ─── Star rating ──────────────────────────────────────────────────────────────

export async function setCandidateStarRating(
  workableCandidateId: string,
  rating: 1 | 2 | 3 | 4 | 5
): Promise<void> {
  await workableFetch(`/candidates/${workableCandidateId}`, {
    method: "PATCH",
    body: JSON.stringify({ candidate: { rating } }),
  });
}

// ─── Candidate comment ────────────────────────────────────────────────────────

export async function addCandidateComment(
  workableCandidateId: string,
  comment: string
): Promise<void> {
  await workableFetch(`/candidates/${workableCandidateId}/activities`, {
    method: "POST",
    body: JSON.stringify({ action: "comment", body: comment }),
  });
}
