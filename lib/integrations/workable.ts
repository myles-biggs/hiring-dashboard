import { WorkableCandidate, WorkableJob } from "@/types/workable";

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

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
): Promise<boolean> {
  const secret = process.env.WORKABLE_WEBHOOK_SECRET;
  if (!secret) return false;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(rawBody);

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sigBuffer = await crypto.subtle.sign("HMAC", key, messageData);
  const computed = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computed === signature;
}
