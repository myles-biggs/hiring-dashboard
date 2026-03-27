"use client";

import { useState } from "react";
import type { CandidateEvaluation } from "./EvaluationForm";

const CV_LABEL: Record<string, string> = {
  "+": "(+)",
  "+/-": "(+/-)",
  "-": "(-)",
};

const PERF_LABEL: Record<string, string> = {
  UNDERPERFORMING: "Underperforming",
  INCONSISTENT: "Inconsistent",
  STRONG: "Strong",
  OUTSTANDING: "Outstanding",
};

const FUTURE_LABEL: Record<string, string> = {
  RESISTANT: "Resistant",
  STATIC: "Static",
  FORWARD_LOOKING: "Forward-looking",
  TRAILBLAZER: "Trailblazer",
};

interface Props {
  evaluations: CandidateEvaluation[];
}

export function EvaluationHistory({ evaluations }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (evaluations.length === 0) {
    return (
      <p className="text-sm text-gray-400">No evaluations submitted yet for this stage.</p>
    );
  }

  return (
    <div className="space-y-2">
      {evaluations.map((ev) => {
        const isExpanded = expandedId === ev.id;
        const evaluator = ev.evaluatorName ?? ev.evaluatorEmail;
        const date = new Date(ev.createdAt).toLocaleDateString("en-CA");
        const isAdvance = ev.recommendation === "ADVANCE";

        return (
          <div key={ev.id} className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : ev.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left"
            >
              <span className="text-sm text-gray-700">
                {evaluator} &mdash; {date}
              </span>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    isAdvance
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {isAdvance ? "Advance" : "Do Not Advance"}
                </span>
                <span className="text-xs text-gray-400">{isExpanded ? "^" : "v"}</span>
              </div>
            </button>

            {isExpanded && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                  <div>
                    <span className="font-medium text-gray-500">Driven by Truth:</span>{" "}
                    <span className="text-gray-700">{CV_LABEL[ev.cvTruth] ?? ev.cvTruth}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Relentless For Results:</span>{" "}
                    <span className="text-gray-700">{CV_LABEL[ev.cvResults] ?? ev.cvResults}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Better Every Day:</span>{" "}
                    <span className="text-gray-700">{CV_LABEL[ev.cvBetterEveryDay] ?? ev.cvBetterEveryDay}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">No Ego, All In:</span>{" "}
                    <span className="text-gray-700">{CV_LABEL[ev.cvNoEgo] ?? ev.cvNoEgo}</span>
                  </div>
                </div>

                <div className="text-xs space-y-0.5">
                  <div>
                    <span className="font-medium text-gray-500">Gets It:</span>{" "}
                    <span className={ev.gwcGetsIt ? "text-green-700" : "text-red-700"}>
                      {ev.gwcGetsIt ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Wants It:</span>{" "}
                    <span className={ev.gwcWantsIt ? "text-green-700" : "text-red-700"}>
                      {ev.gwcWantsIt ? "Yes" : "No"}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Capacity:</span>{" "}
                    <span className={ev.gwcCapacity ? "text-green-700" : "text-red-700"}>
                      {ev.gwcCapacity ? "Yes" : "No"}
                    </span>
                  </div>
                </div>

                <div className="text-xs space-y-0.5">
                  <div>
                    <span className="font-medium text-gray-500">Performance:</span>{" "}
                    <span className="text-gray-700">{PERF_LABEL[ev.performance] ?? ev.performance}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-500">Future Readiness:</span>{" "}
                    <span className="text-gray-700">{FUTURE_LABEL[ev.futureReadiness] ?? ev.futureReadiness}</span>
                  </div>
                </div>

                {ev.notes && (
                  <div className="text-xs">
                    <span className="font-medium text-gray-500">Notes:</span>{" "}
                    <span className="text-gray-700">{ev.notes}</span>
                  </div>
                )}

                {ev.overrideReason && (
                  <div className="text-xs bg-yellow-50 border border-yellow-200 rounded px-3 py-2">
                    <span className="font-medium text-yellow-800">Override:</span>{" "}
                    <span className="text-yellow-800">{ev.overrideReason}</span>
                  </div>
                )}

                {ev.workableCommentPosted && ev.workableCommentPostedAt && (
                  <p className="text-xs text-gray-400">
                    Posted to Workable on{" "}
                    {new Date(ev.workableCommentPostedAt).toLocaleDateString("en-CA")}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
