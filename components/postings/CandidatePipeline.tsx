"use client";

import { useState } from "react";
import { WorkableCandidate } from "@/types/workable";
import { WorkableStageOption } from "@/lib/integrations/workable";
import { EvaluationForm, CandidateEvaluation } from "@/components/evaluations/EvaluationForm";
import { EvaluationHistory } from "@/components/evaluations/EvaluationHistory";

interface VetData {
  workableCandidateId: string;
  aiVetScore: number | null;
  aiVetStatus: string | null;
  aiVetSummary: string | null;
  aiVetQuestions: string[];
  aiVetRationale?: string | null;
}

interface SilverMedalistState {
  isSilverMedalist: boolean;
  silverMedalistNote: string | null;
}

interface Props {
  jobShortcode: string;
  jobTitle?: string;
  candidates: WorkableCandidate[];
  stages: WorkableStageOption[];
  vetMap: Record<string, VetData>;
  briefId: string | null;
  jdEnglish: string | null;
}

// ─── Evaluation Modal ─────────────────────────────────────────────────────────

function EvaluationModal({
  candidate,
  jobShortcode,
  jobTitle,
  onClose,
}: {
  candidate: WorkableCandidate;
  jobShortcode: string;
  jobTitle: string;
  onClose: () => void;
}) {
  return (
    <Modal onClose={onClose}>
      <EvaluationForm
        candidateId={candidate.id}
        jobShortcode={jobShortcode}
        candidateName={candidate.name}
        jobTitle={jobTitle}
        currentStage={candidate.stage.name}
        onComplete={() => onClose()}
      />
    </Modal>
  );
}

// ─── Shared Modal Shell ───────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl font-light"
          aria-label="Close"
        >
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

// ─── Main Pipeline ────────────────────────────────────────────────────────────

export function CandidatePipeline({
  jobShortcode,
  jobTitle = "",
  candidates: initialCandidates,
  stages,
  vetMap: initialVetMap,
  briefId,
  jdEnglish: _jdEnglish,
}: Props) {
  const [candidates] = useState(initialCandidates);
  const [vetMap, setVetMap] = useState(initialVetMap);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [vettingId, setVettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"applied" | "score">("score");
  const [filterStatus, setFilterStatus] = useState<"all" | "Qualified" | "Unqualified">("all");
  const [vettingAll, setVettingAll] = useState(false);
  const [vetAllSummary, setVetAllSummary] = useState<string | null>(null);
  const [evaluateTarget, setEvaluateTarget] = useState<WorkableCandidate | null>(null);
  const [evaluationsMap, setEvaluationsMap] = useState<Record<string, CandidateEvaluation[]>>({});
  const [silverMap, setSilverMap] = useState<Record<string, SilverMedalistState>>({});

  const activeStages = stages.filter((s) => s.kind !== "disqualified");
  const activeCandidates = candidates.filter((c) => !c.disqualified);

  const byStage: Record<string, WorkableCandidate[]> = {};
  for (const stage of activeStages) {
    let stageCandidates = activeCandidates.filter((c) => c.stage.name === stage.name);

    if (filterStatus !== "all") {
      stageCandidates = stageCandidates.filter(
        (c) => vetMap[c.id]?.aiVetStatus === filterStatus
      );
    }

    stageCandidates = stageCandidates.sort((a, b) => {
      if (sortBy === "score") {
        const scoreA = vetMap[a.id]?.aiVetScore ?? -1;
        const scoreB = vetMap[b.id]?.aiVetScore ?? -1;
        return scoreB - scoreA;
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    byStage[stage.slug] = stageCandidates;
  }

  async function runVetAll() {
    setVettingAll(true);
    setVetAllSummary(null);
    setError(null);

    const res = await fetch(`/api/postings/${jobShortcode}/vet-all`, { method: "POST" });
    const body = await res.json();

    setVettingAll(false);

    if (!res.ok) {
      setError(body.error ?? "Failed to start vetting.");
      return;
    }

    if (!body.queued) {
      setVetAllSummary("All candidates already scored");
      return;
    }

    setVetAllSummary(`Vetting ${body.toVet} candidates in background — refresh in ~30 seconds to see scores`);
  }

  async function toggleSilverMedalist(candidate: WorkableCandidate) {
    const current = silverMap[candidate.id]?.isSilverMedalist ?? false;
    const next = !current;

    setSilverMap((prev) => ({
      ...prev,
      [candidate.id]: { isSilverMedalist: next, silverMedalistNote: prev[candidate.id]?.silverMedalistNote ?? null },
    }));

    const res = await fetch(
      `/api/postings/${jobShortcode}/candidates/${candidate.id}/silver-medalist`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isSilverMedalist: next }),
      }
    );

    if (!res.ok) {
      // Revert on failure
      setSilverMap((prev) => ({
        ...prev,
        [candidate.id]: { isSilverMedalist: current, silverMedalistNote: prev[candidate.id]?.silverMedalistNote ?? null },
      }));
    }
  }

  async function runVet(candidate: WorkableCandidate) {
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

  return (
    <div className="space-y-6">
      {evaluateTarget && (
        <EvaluationModal
          candidate={evaluateTarget}
          jobShortcode={jobShortcode}
          jobTitle={jobTitle}
          onClose={() => {
            const id = evaluateTarget.id;
            const stage = evaluateTarget.stage.name;
            setEvaluateTarget(null);
            fetch(
              `/api/postings/${jobShortcode}/candidates/${id}/evaluations?stage=${encodeURIComponent(stage)}`
            )
              .then((r) => r.json())
              .then((d) => {
                setEvaluationsMap((prev) => ({ ...prev, [id]: d.evaluations ?? [] }));
              })
              .catch(() => undefined);
          }}
        />
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Sort:</span>
            <button
              onClick={() => setSortBy("score")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === "score" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              AI Score
            </button>
            <button
              onClick={() => setSortBy("applied")}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${sortBy === "applied" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              Applied date
            </button>
          </div>
          <div className="flex items-center gap-2 ml-4">
            <span className="text-xs text-gray-500">Filter:</span>
            {(["all", "Qualified", "Unqualified"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterStatus(f)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${filterStatus === f ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
              >
                {f === "all" ? "All" : f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {vetAllSummary && (
            <span className="text-xs text-green-700 font-medium">{vetAllSummary}</span>
          )}
          <button
            onClick={runVetAll}
            disabled={vettingAll}
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {vettingAll ? "Running…" : "Vet all unvetted"}
          </button>
        </div>
      </div>

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

                  return (
                    <div key={candidate.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => {
                                const next = isExpanded ? null : candidate.id;
                                setExpanded(next);
                                if (next && evaluationsMap[candidate.id] === undefined) {
                                  fetch(
                                    `/api/postings/${jobShortcode}/candidates/${candidate.id}/evaluations?stage=${encodeURIComponent(candidate.stage.name)}`
                                  )
                                    .then((r) => r.json())
                                    .then((d) => {
                                      setEvaluationsMap((prev) => ({
                                        ...prev,
                                        [candidate.id]: d.evaluations ?? [],
                                      }));
                                    })
                                    .catch(() => undefined);
                                }
                              }}
                              className="font-medium text-sm text-gray-900 hover:text-gray-600 text-left"
                            >
                              {candidate.name}
                            </button>
                            {vet?.aiVetScore != null && (
                              <VetScoreBadge score={vet.aiVetScore} />
                            )}
                          </div>
                          {vet?.aiVetRationale && (
                            <p className="text-xs text-gray-400 italic mt-1">{vet.aiVetRationale}</p>
                          )}
                          {candidate.headline && (
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{candidate.headline}</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            Applied {new Date(candidate.created_at).toLocaleDateString("en-CA")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <button
                            onClick={() => toggleSilverMedalist(candidate)}
                            title={silverMap[candidate.id]?.isSilverMedalist ? "Remove silver medalist" : "Mark as silver medalist"}
                            className="text-xs px-2 py-1.5 border border-gray-300 rounded-md text-gray-500 hover:bg-gray-50 transition-colors"
                          >
                            {silverMap[candidate.id]?.isSilverMedalist ? "★" : "☆"}
                          </button>

                          <button
                            onClick={() => runVet(candidate)}
                            disabled={vettingId === candidate.id}
                            title="Run AI vet"
                            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            {vettingId === candidate.id ? "Vetting…" : vet ? "Re-vet" : "AI Vet"}
                          </button>

                          <button
                            onClick={() => {
                              setEvaluateTarget(candidate);
                              if (!evaluationsMap[candidate.id]) {
                                fetch(
                                  `/api/postings/${jobShortcode}/candidates/${candidate.id}/evaluations?stage=${encodeURIComponent(candidate.stage.name)}`
                                )
                                  .then((r) => r.json())
                                  .then((d) => {
                                    setEvaluationsMap((prev) => ({
                                      ...prev,
                                      [candidate.id]: d.evaluations ?? [],
                                    }));
                                  })
                                  .catch(() => undefined);
                              }
                            }}
                            className="text-xs px-2.5 py-1.5 border border-indigo-300 rounded-md text-indigo-600 hover:bg-indigo-50 transition-colors"
                          >
                            Evaluate
                          </button>
                        </div>
                      </div>

                      {isExpanded && evaluationsMap[candidate.id] !== undefined && (
                        <div className="mt-4 bg-gray-50 rounded-lg p-4">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                            Evaluations
                          </p>
                          <EvaluationHistory evaluations={evaluationsMap[candidate.id] ?? []} />
                        </div>
                      )}

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
                          {vet.aiVetRationale && (
                            <div>
                              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                                Score rationale
                              </p>
                              <p className="text-sm text-gray-500 italic">{vet.aiVetRationale}</p>
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
