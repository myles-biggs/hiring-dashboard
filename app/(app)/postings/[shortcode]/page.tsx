import { authOptions } from "@/lib/auth/config"
import { getCandidatesForJob, getJobStages } from "@/lib/integrations/workable"
import { prisma } from "@/lib/utils/prisma"
import { getServerSession } from "next-auth"
import { notFound } from "next/navigation"
import Link from "next/link"
import { CandidatePipeline } from "@/components/postings/CandidatePipeline"

export default async function JobPipelinePage({
  params,
}: {
  params: Promise<{ shortcode: string }>
}) {
  const { shortcode } = await params
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const [candidates, stages] = await Promise.all([
    getCandidatesForJob(shortcode),
    getJobStages(shortcode),
  ])

  // Load any AI vet data we have cached for these candidates
  const candidateIds = candidates.map((c) => c.id)
  const vetCache = await prisma.candidateCache.findMany({
    where: { workableCandidateId: { in: candidateIds } },
    select: {
      workableCandidateId: true,
      aiVetScore: true,
      aiVetStatus: true,
      aiVetSummary: true,
      aiVetRationale: true,
      aiVetQuestions: true,
    },
  })
  const vetMap = Object.fromEntries(vetCache.map((v) => [v.workableCandidateId, v]))

  // Find the matching brief for this job (if any)
  const brief = await prisma.hiringBrief.findFirst({
    where: { workableJobId: shortcode },
    select: { id: true, roleTitle: true, jdEnglish: true },
  })

  const jobTitle = candidates[0]?.job?.title ?? brief?.roleTitle ?? shortcode

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/postings"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-2 block"
        >
          ← Active Postings
        </Link>
        <h1 className="text-2xl font-heading font-semibold text-foreground">{jobTitle}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {candidates.length} candidate{candidates.length !== 1 ? "s" : ""} ·{" "}
          {candidates.filter((c) => !c.disqualified).length} active
        </p>
      </div>

      <CandidatePipeline
        jobShortcode={shortcode}
        jobTitle={jobTitle}
        candidates={candidates}
        stages={stages}
        vetMap={vetMap}
        briefId={brief?.id ?? null}
        jdEnglish={brief?.jdEnglish ?? null}
      />
    </div>
  )
}
