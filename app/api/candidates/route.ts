import { authOptions } from "@/lib/auth/config";
import { getCandidatesForJob, getJobs } from "@/lib/integrations/workable";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobs = await getJobs();

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const candidates = await getCandidatesForJob(job.shortcode);
        return candidates
          .filter((c) => !c.disqualified)
          .map((c) => ({
            id: c.id,
            name: c.name,
            jobShortcode: job.shortcode,
            jobTitle: job.title,
            stage: c.stage.name,
          }));
      } catch {
        return [];
      }
    })
  );

  const candidates = results.flat();
  return NextResponse.json({ candidates });
}
