import { getCandidatesForJob, getJobStages } from "@/lib/integrations/workable";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ shortcode: string }> }
) {
  const { shortcode } = await params;
  const [candidates, stages] = await Promise.all([
    getCandidatesForJob(shortcode),
    getJobStages(shortcode),
  ]);

  return NextResponse.json({
    stages: stages.map((s) => ({ name: s.name, slug: s.slug, kind: s.kind })),
    candidateStageSample: candidates.slice(0, 10).map((c) => ({
      name: c.name,
      stage: c.stage,
      disqualified: c.disqualified,
    })),
    totalCandidates: candidates.length,
    activeCandidates: candidates.filter((c) => !c.disqualified).length,
  });
}
