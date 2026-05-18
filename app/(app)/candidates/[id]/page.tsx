import { authOptions } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { EvaluationType } from "@prisma/client";
import { getServerSession } from "next-auth";
import { notFound, redirect } from "next/navigation";
import ApprovalControls from "./_components/approval-controls";
import { TranscriptEvaluation } from "./_components/transcript-evaluation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CandidateDetailPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  try {
    requireRole(session, "TALENT_ACQUISITION", "ADMIN");
  } catch {
    redirect("/dashboard");
  }

  const { id } = await params;

  const candidate = await prisma.candidate.findUnique({
    where: { id },
    include: {
      evaluations: { orderBy: { createdAt: "desc" } },
      dispositions: { orderBy: { createdAt: "desc" }, take: 1 },
      transcripts: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!candidate) notFound();

  const disposition = candidate.dispositions[0];
  const jdEval = candidate.evaluations.find((e) => e.type === EvaluationType.JOB_POSTING_FIT);
  const cultureEval = candidate.evaluations.find((e) => e.type === EvaluationType.CULTURE_FIT);
  const latestTranscript = candidate.transcripts[0];
  const latestEval = jdEval;

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">{candidate.fullName}</h1>
        <p className="text-gray-500">{candidate.workableJobTitle}</p>
        {candidate.linkedinUrl && (
          <a
            href={candidate.linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-600 hover:underline"
          >
            LinkedIn profile
          </a>
        )}
      </div>

      {latestEval && (
        <div className="mb-6 rounded-lg border border-gray-200 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
            Evaluation
          </h2>
          <div className="mb-2 flex items-center gap-4">
            <span className="text-3xl font-bold">{latestEval.score ?? "—"}</span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                latestEval.bucket === "STRONG"
                  ? "bg-green-100 text-green-700"
                  : latestEval.bucket === "POSSIBLE"
                    ? "bg-yellow-100 text-yellow-700"
                    : "bg-red-100 text-red-700"
              }`}
            >
              {latestEval.bucket}
            </span>
          </div>
          {latestEval.rationale && (
            <p className="text-sm text-gray-700">{latestEval.rationale}</p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            Evaluated {latestEval.createdAt.toLocaleDateString()} · Model:{" "}
            {latestEval.modelUsed} · Prompt v{latestEval.promptVersion}
          </p>
        </div>
      )}

      {cultureEval && latestTranscript && (
        <div className="mb-6">
          <TranscriptEvaluation
            evaluation={{
              id: cultureEval.id,
              score: cultureEval.score,
              bucket: cultureEval.bucket,
              dimensionScores: cultureEval.dimensionScores as Record<string, number> | null,
              createdAt: cultureEval.createdAt,
            }}
            transcript={{
              id: latestTranscript.id,
              meetingDate: latestTranscript.meetingDate,
              interviewerEmails: latestTranscript.interviewerEmails,
              matchMethod: latestTranscript.matchMethod,
            }}
          />
        </div>
      )}

      {disposition && (
        <ApprovalControls
          dispositionId={disposition.id}
          recommendedAction={disposition.recommendedAction}
          status={disposition.status}
          notes={disposition.approvalNotes ?? undefined}
        />
      )}

      {!disposition && !latestEval && (
        <p className="text-gray-400">This candidate has not been evaluated yet.</p>
      )}
    </div>
  );
}
