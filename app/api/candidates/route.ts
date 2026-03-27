import { authOptions } from "@/lib/auth/config";
import { getCandidatesForJob, getJobs } from "@/lib/integrations/workable";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await getJobs();

  const allCandidates: { id: string; name: string; jobShortcode: string; jobTitle: string; stage: string }[] = [];
  for (const job of jobs) {
    try {
      const candidates = await getCandidatesForJob(job.shortcode);
      const mapped = candidates
        .filter((c) => !c.disqualified)
        .map((c) => ({
          id: c.id,
          name: c.name,
          jobShortcode: job.shortcode,
          jobTitle: job.title,
          stage: c.stage.name,
        }));
      allCandidates.push(...mapped);
    } catch {
      // skip failed jobs
    }
  }

  const candidates = allCandidates;
  return NextResponse.json({ candidates });
}
