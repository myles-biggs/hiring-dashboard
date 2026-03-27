"use client";

import { EvaluationForm, CandidateEvaluation } from "@/components/evaluations/EvaluationForm";
import { useEffect, useState } from "react";

interface CandidateOption {
  id: string;
  name: string;
  jobShortcode: string;
  jobTitle: string;
  stage: string;
}

export default function EvaluatePage() {
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [completed, setCompleted] = useState<CandidateEvaluation | null>(null);

  useEffect(() => {
    fetch("/api/candidates")
      .then((r) => r.json())
      .then((d) => setCandidates(d.candidates ?? []))
      .catch(() => setCandidates([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = candidates.find((c) => `${c.id}::${c.jobShortcode}` === selectedKey) ?? null;

  function handleComplete(evaluation: CandidateEvaluation) {
    setCompleted(evaluation);
  }

  function reset() {
    setSelectedKey("");
    setCompleted(null);
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Evaluate a Candidate</h1>

      {completed ? (
        <div className="space-y-4">
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            Evaluation submitted.{" "}
            <span className="font-medium">
              Recommendation: {completed.recommendation === "ADVANCE" ? "Advance" : "Do Not Advance"}
            </span>
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            Evaluate another candidate
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-2">
              Select candidate
            </label>
            {loading ? (
              <p className="text-sm text-gray-400">Loading candidates...</p>
            ) : candidates.length === 0 ? (
              <p className="text-sm text-gray-400">No active candidates found.</p>
            ) : (
              <select
                value={selectedKey}
                onChange={(e) => setSelectedKey(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select a candidate...</option>
                {candidates.map((c) => (
                  <option key={`${c.id}::${c.jobShortcode}`} value={`${c.id}::${c.jobShortcode}`}>
                    {c.name} — {c.jobTitle} — {c.stage}
                  </option>
                ))}
              </select>
            )}
          </div>

          {selected && (
            <div className="border-t border-gray-200 pt-6">
              <EvaluationForm
                candidateId={selected.id}
                jobShortcode={selected.jobShortcode}
                candidateName={selected.name}
                jobTitle={selected.jobTitle}
                currentStage={selected.stage}
                onComplete={handleComplete}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
