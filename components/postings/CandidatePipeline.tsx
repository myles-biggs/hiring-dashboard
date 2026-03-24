"use client";

import { WorkableCandidate, WorkableStageOption } from "@/types/workable";
import { useState } from "react";

interface VetData {
  workableCandidateId: string;
  aiVetScore: number | null;
  aiVetStatus: string | null;
  aiVetSummary: string | null;
  aiVetQuestions: string[];
}

interface Props {
  jobShortcode: string;
  candidates: WorkableCandidate[];
  stages: WorkableStageOption[];
  vetMap: Record<string, VetData>;
  briefId: string | null;
  jdEnglish: string | null;
}

export function CandidatePipeline({
  jobShortcode,
  candidates: initialCandidates,
  stages,
  vetMap: initialVetMap,
  briefId,
  jdEnglish,
}: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [vetMap, setVetMap] = useState(initialVetMap);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [vettingId, setVettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const activeStages = stages.filter((s) => s.kind !== "disqualified");
  const activeCandidates = candidates.filter((c) => !c.disqualified);

  // Group candidates by stage
  const byStage: Record<string, WorkableCandidate[]> = {};
  for (const stage of activeStages) {
    byStage[stage.slug] = activeCandidates.filter((c) => c.stage.name === stage.name);
  }

  async function moveCandidate(candidateId: string, targetStageSlug: string) {
    setMovingId(candidateId);
    setError(null);

    const res = await fetch(`/api/postings/${jobShortcode}/candidates/${candidateId}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stageSlug: targetStageSlug }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to move candidate.");
      setMovingId(null);
      return;
    }

    const targetStage = stages.find((s) => s.slug === targetStageSlug);
    if (targetStage) {
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, stage: { kind: targetStage.kind, name: targetStage.name, position: targetStage.position } }
            : c
        )
      );
    }
    setMovingId(null);
  }

  async function runVet(candidate: WorkableCandidate) {
    if (!jdEnglish) {
      setError("No JD available to vet against. Generate a JD for this role first.");
      return;
    }
    setVettingId(candidate.id);
    setError(null);

    const res = await fetch(`/api/postings/${jobShortcode}/candidates/${candidate.id}/vet`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ briefId }),
    });

    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "AI vetting failed.");
      setVettingId(null);
      return;
    }

    setVetMap((prev) => ({ ...prev, [candidate.id]: body }));
    setVettingId(null);
  }

  const currentStageIndex = (candidate: WorkableCandidate) =>
    activeStages.findIndex((s) => s.name === candidate.stage.name);

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {activeStages.map((stage) => {
        const stageCandidates = byStage[stage.slug] ?? [];
        return (
          <div key={stage.slug} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{stage.name}</h2>
              <span className="text-xs text-gray-400 font-medium">{stageCandidates.length}</span>
            </div>

            {stageCandidates.length === 0 ? (
              <p className="text-sm text-gray-400 px-5 py-4">No candidates at this stage.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {stageCandidates.map((candidate) => {
                  const vet = vetMap[candidate.id];
                  const isExpanded = expanded === candidate.id;
                  const stageIdx = currentStageIndex(candidate);
                  const nextStage = activeStages[stageIdx + 1];
                  const prevStage = activeStages[stageIdx - 1];

                  return (
                    <div key={candidate.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => setExpanded(isExpanded ? null : candidate.id)}
                              className="font-medium text-sm text-gray-900 hover:text-gray-600 text-left"
                            >
                              {candidate.name}
                            </button>
                            {vet?.aiVetScore != null && (
                              <VetScoreBadge score={vet.aiVetScore} />
                            )}
                          </div>
                          {candidate.headline && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{candidate.headline}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {/* AI Vet */}
                          <button
                            onClick={() => runVet(candidate)}
                            disabled={vettingId === candidate.id || !jdEnglish}
                            title={!jdEnglish ? "No JD available" : "Run AI vet"}
                            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            {vettingId === candidate.id ? "Vetting..." : vet ? "Re-vet" : "AI Vet"}
                          </button>

                          {/* Email */}
                          <a
                            href={`mailto:${candidate.email}`}
                            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Email
                          </a>

                          {/* Move backward */}
                          {prevStage && (
                            <button
                              onClick={() => moveCandidate(candidate.id, prevStage.slug)}
                              disabled={movingId === candidate.id}
                              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                            >
                              ← {prevStage.name}
                            </button>
                          )}

                          {/* Move forward */}
                          {nextStage && (
                            <button
                              onClick={() => moveCandidate(candidate.id, nextStage.slug)}
                              disabled={movingId === candidate.id}
                              className="text-xs px-2.5 py-1.5 bg-gray-900 text-white rounded-md hover:bg-gray-800 disabled:opacity-40 transition-colors"
                            >
                              {nextStage.name} →
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Expanded: AI vet results */}
                      {isExpanded && vet && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4 space-y-3">
                          {vet.aiVetSummary && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                AI Summary
                              </p>
                              <p className="text-sm text-gray-700">{vet.aiVetSummary}</p>
                            </div>
                          )}
                          {vet.aiVetQuestions?.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Suggested Interview Questions
                              </p>
                              <ul className="space-y-1">
                                {vet.aiVetQuestions.map((q, i) => (
                                  <li key={i} className="text-sm text-gray-700 flex gap-2">
                                    <span className="text-gray-400 shrink-0">{i + 1}.</span>
                                    {q}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {candidate.profile_url && (
                            <a
                              href={candidate.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 underline"
                            >
                              View in Workable →
                            </a>
                          )}
                        </div>
                      )}

                      {/* Expanded: no vet data yet */}
                      {isExpanded && !vet && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-500">
                            No AI vet data yet. Click &quot;AI Vet&quot; to score this candidate.
                          </p>
                          {candidate.profile_url && (
                            <a
                              href={candidate.profile_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-gray-500 underline mt-2 block"
                            >
                              View in Workable →
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function VetScoreBadge({ score }: { score: number }) {
  const color =
    score >= 80
      ? "bg-green-100 text-green-800"
      : score >= 60
      ? "bg-yellow-100 text-yellow-800"
      : "bg-red-100 text-red-800";

  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {score}
    </span>
  );
}
