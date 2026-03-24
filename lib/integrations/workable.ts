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

export async function getCandidatesForJob(jobShortcode: string): Promise<WorkableCandidate[]> {
  const data = await workableFetch<{ candidates: WorkableCandidate[] }>(
    `/jobs/${jobShortcode}/candidates`
  );
  return data.candidates;
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
