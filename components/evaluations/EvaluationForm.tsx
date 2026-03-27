"use client";

import { calculateThreshold } from "@/lib/evaluations/threshold";
import { useState } from "react";

type CVScore = "+" | "+/-" | "-";
type Performance = "UNDERPERFORMING" | "INCONSISTENT" | "STRONG" | "OUTSTANDING";
type FutureReadiness = "RESISTANT" | "STATIC" | "FORWARD_LOOKING" | "TRAILBLAZER";

export interface CandidateEvaluation {
  id: string;
  workableCandidateId: string;
  workableJobId: string;
  pipelineStage: string;
  evaluatorEmail: string;
  evaluatorName: string | null;
  cvTruth: string;
  cvResults: string;
  cvBetterEveryDay: string;
  cvNoEgo: string;
  gwcGetsIt: boolean;
  gwcWantsIt: boolean;
  gwcCapacity: boolean;
  performance: string;
  futureReadiness: string;
  notes: string | null;
  meetsThreshold: boolean;
  recommendation: string;
  overrideReason: string | null;
  overrideByEmail: string | null;
  overrideAt: string | null;
  workableCommentPosted: boolean;
  workableCommentPostedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Props {
  candidateId: string;
  jobShortcode: string;
  candidateName: string;
  jobTitle: string;
  currentStage: string;
  onComplete: (evaluation: CandidateEvaluation) => void;
}

const CV_OPTIONS: { value: CVScore; label: string }[] = [
  { value: "+", label: "(+) Consistently demonstrates (≥80% of the time)" },
  { value: "+/-", label: "(+/-) Sometimes demonstrates (51%-79% of the time)" },
  { value: "-", label: "(-) Rarely demonstrates (≤50% of the time)" },
];

const PERF_OPTIONS: { value: Performance; label: string; description: string }[] = [
  { value: "UNDERPERFORMING", label: "Underperforming", description: "Bottom 25%, misses most goals, poor quality" },
  { value: "INCONSISTENT", label: "Inconsistent", description: "Middle 50%, hits some goals, average quality" },
  { value: "STRONG", label: "Strong", description: "Top 25%, meets/exceeds goals, reliable quality" },
  { value: "OUTSTANDING", label: "Outstanding", description: "Top 10%, surpasses all goals, sets the standard" },
];

const FUTURE_OPTIONS: { value: FutureReadiness; label: string; description: string }[] = [
  { value: "RESISTANT", label: "Resistant", description: "Avoids new tech, lacks curiosity, gives up easily" },
  { value: "STATIC", label: "Static", description: "Uses familiar tools, limited learning initiative" },
  { value: "FORWARD_LOOKING", label: "Forward-looking", description: "Actively learns AI, curious, bounces back from setbacks" },
  { value: "TRAILBLAZER", label: "Trailblazer", description: "AI-fluent innovator, drives learning, helps others adapt" },
];

const CV_FIELDS: { key: keyof Pick<FormState, "cvTruth" | "cvResults" | "cvBetterEveryDay" | "cvNoEgo">; label: string; bullets: string[] }[] = [
  {
    key: "cvTruth",
    label: "Driven by Truth",
    bullets: [
      "Bases decisions on data and evidence gathered during the hiring process",
      "Demonstrates radical candor — gives and receives direct, honest feedback",
      "Shows interest in understanding real performance data and outcomes",
      "Demonstrates AI fluency and data-driven thinking",
    ],
  },
  {
    key: "cvResults",
    label: "Relentless For Results",
    bullets: [
      "Demonstrates a track record of driving measurable outcomes",
      "Shows genuine competitiveness and drive to exceed expectations",
      "Holds themselves accountable — owns outcomes, doesn't make excuses",
      "Uses AI and tools strategically to accelerate performance",
    ],
  },
  {
    key: "cvBetterEveryDay",
    label: "Better Every Day",
    bullets: [
      "Shows evidence of continuous learning and self-improvement",
      "Embraces feedback as a growth mechanism, not a threat",
      "Demonstrates \"progress over perfection\" mindset",
      "Actively experiments with AI and emerging tools",
    ],
  },
  {
    key: "cvNoEgo",
    label: "No Ego, All In",
    bullets: [
      "Approaches challenges collaboratively, not as a lone operator",
      "Willing to do whatever it takes — no task is beneath them",
      "Projects positive energy and commitment even under pressure",
      "Humble and curious about AI — not threatened by it",
    ],
  },
];

const GWC_FIELDS: { key: keyof Pick<FormState, "gwcGetsIt" | "gwcWantsIt" | "gwcCapacity">; label: string; description: string }[] = [
  {
    key: "gwcGetsIt",
    label: "Gets It",
    description: "Truly understands the role, culture, systems, and pace of Level.",
  },
  {
    key: "gwcWantsIt",
    label: "Wants It",
    description: "Genuinely committed to the role and company — not just performing interest.",
  },
  {
    key: "gwcCapacity",
    label: "Capacity to Do It",
    description: "Has the time, intellect, and emotional intelligence to do the job well.",
  },
];

interface FormState {
  cvTruth: CVScore | "";
  cvResults: CVScore | "";
  cvBetterEveryDay: CVScore | "";
  cvNoEgo: CVScore | "";
  gwcGetsIt: boolean | null;
  gwcWantsIt: boolean | null;
  gwcCapacity: boolean | null;
  performance: Performance | "";
  futureReadiness: FutureReadiness | "";
  notes: string;
  override: boolean;
  overrideReason: string;
}

const DEFAULT_STATE: FormState = {
  cvTruth: "",
  cvResults: "",
  cvBetterEveryDay: "",
  cvNoEgo: "",
  gwcGetsIt: null,
  gwcWantsIt: null,
  gwcCapacity: null,
  performance: "",
  futureReadiness: "",
  notes: "",
  override: false,
  overrideReason: "",
};

function isComplete(state: FormState): boolean {
  return (
    state.cvTruth !== "" &&
    state.cvResults !== "" &&
    state.cvBetterEveryDay !== "" &&
    state.cvNoEgo !== "" &&
    state.gwcGetsIt !== null &&
    state.gwcWantsIt !== null &&
    state.gwcCapacity !== null &&
    state.performance !== "" &&
    state.futureReadiness !== ""
  );
}

function getThreshold(state: FormState): boolean | null {
  if (!isComplete(state)) return null;
  return calculateThreshold({
    cvTruth: state.cvTruth as CVScore,
    cvResults: state.cvResults as CVScore,
    cvBetterEveryDay: state.cvBetterEveryDay as CVScore,
    cvNoEgo: state.cvNoEgo as CVScore,
    gwcGetsIt: state.gwcGetsIt as boolean,
    gwcWantsIt: state.gwcWantsIt as boolean,
    gwcCapacity: state.gwcCapacity as boolean,
    performance: state.performance as string,
    futureReadiness: state.futureReadiness as string,
  });
}

function ThresholdCriteria({ state }: { state: FormState }) {
  const cvScores = [state.cvTruth, state.cvResults, state.cvBetterEveryDay, state.cvNoEgo];
  const plusCount = cvScores.filter((s) => s === "+").length;
  const minusCount = cvScores.filter((s) => s === "-").length;
  const cvPasses = plusCount >= 2 && minusCount === 0;

  const gwcPasses =
    state.gwcGetsIt === true && state.gwcWantsIt === true && state.gwcCapacity === true;

  const PERF_ORDER = ["UNDERPERFORMING", "INCONSISTENT", "STRONG", "OUTSTANDING"];
  const FUTURE_ORDER = ["RESISTANT", "STATIC", "FORWARD_LOOKING", "TRAILBLAZER"];
  const perfPasses =
    state.performance !== "" && PERF_ORDER.indexOf(state.performance) >= PERF_ORDER.indexOf("STRONG");
  const futurePasses =
    state.futureReadiness !== "" &&
    FUTURE_ORDER.indexOf(state.futureReadiness) >= FUTURE_ORDER.indexOf("FORWARD_LOOKING");

  const criteria = [
    { label: "Core Values: 2+ rated (+) and zero (-)", passes: cvPasses },
    { label: "GWC: All three Yes", passes: gwcPasses },
    { label: "Performance: Strong or Outstanding", passes: perfPasses },
    { label: "Future Readiness: Forward-looking or Trailblazer", passes: futurePasses },
  ];

  return (
    <div className="space-y-1">
      {criteria.map((c) => (
        <div key={c.label} className="flex items-center gap-2 text-xs">
          <span className={c.passes ? "text-green-600" : "text-gray-400"}>{c.passes ? "+" : "-"}</span>
          <span className={c.passes ? "text-green-700" : "text-gray-500"}>{c.label}</span>
        </div>
      ))}
    </div>
  );
}

export function EvaluationForm({
  candidateId,
  jobShortcode,
  candidateName,
  jobTitle,
  currentStage,
  onComplete,
}: Props) {
  const [state, setState] = useState<FormState>(DEFAULT_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meetsThreshold = getThreshold(state);
  const complete = isComplete(state);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    if (!complete) return;
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      pipelineStage: currentStage,
      cvTruth: state.cvTruth,
      cvResults: state.cvResults,
      cvBetterEveryDay: state.cvBetterEveryDay,
      cvNoEgo: state.cvNoEgo,
      gwcGetsIt: state.gwcGetsIt,
      gwcWantsIt: state.gwcWantsIt,
      gwcCapacity: state.gwcCapacity,
      performance: state.performance,
      futureReadiness: state.futureReadiness,
      notes: state.notes || null,
    };

    if (state.override) {
      body.recommendationOverride = meetsThreshold ? "DO_NOT_ADVANCE" : "ADVANCE";
      body.overrideReason = state.overrideReason || null;
    }

    const res = await fetch(
      `/api/postings/${jobShortcode}/candidates/${candidateId}/evaluations`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ? JSON.stringify(d.error) : "Submission failed.");
      return;
    }

    const d = await res.json();
    onComplete(d.evaluation as CandidateEvaluation);
  }

  const submitLabel = () => {
    if (submitting) return "Submitting...";
    if (!complete) return "Submit Evaluation";
    if (state.override) return "Submit with Override";
    if (meetsThreshold) return "Submit & Advance";
    return "Submit Evaluation";
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Evaluate Candidate</h2>
        <p className="text-sm text-gray-500 mt-1">
          {candidateName} &mdash; {jobTitle} &mdash; {currentStage}
        </p>
      </div>

      {/* Core Values */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Core Values
        </h3>
        <div className="space-y-5">
          {CV_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-800 mb-1">{field.label}</label>
              <ul className="text-xs text-gray-500 list-disc list-inside mb-2 space-y-0.5">
                {field.bullets.map((b) => (
                  <li key={b}>{b}</li>
                ))}
              </ul>
              <select
                value={state[field.key] as string}
                onChange={(e) => setField(field.key, e.target.value as CVScore)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              >
                <option value="">Select a rating</option>
                {CV_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* GWC */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">GWC</h3>
        <div className="space-y-4">
          {GWC_FIELDS.map((field) => (
            <div key={field.key}>
              <p className="text-sm font-medium text-gray-800 mb-0.5">{field.label}</p>
              <p className="text-xs text-gray-500 mb-2">{field.description}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setField(field.key, true)}
                  className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${
                    state[field.key] === true
                      ? "bg-green-600 text-white border-green-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setField(field.key, false)}
                  className={`px-4 py-1.5 text-sm rounded-md border transition-colors ${
                    state[field.key] === false
                      ? "bg-red-600 text-white border-red-600"
                      : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  No
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Performance */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Performance
        </h3>
        <div className="space-y-2">
          {PERF_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                state.performance === o.value
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="performance"
                value={o.value}
                checked={state.performance === o.value}
                onChange={() => setField("performance", o.value)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{o.label}</p>
                <p className="text-xs text-gray-500">{o.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Future Readiness */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Future Readiness
        </h3>
        <div className="space-y-2">
          {FUTURE_OPTIONS.map((o) => (
            <label
              key={o.value}
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                state.futureReadiness === o.value
                  ? "border-gray-900 bg-gray-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <input
                type="radio"
                name="futureReadiness"
                value={o.value}
                checked={state.futureReadiness === o.value}
                onChange={() => setField("futureReadiness", o.value)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-gray-800">{o.label}</p>
                <p className="text-xs text-gray-500">{o.description}</p>
              </div>
            </label>
          ))}
        </div>
      </section>

      {/* Notes */}
      <section>
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2">
          Notes <span className="text-gray-400 font-normal normal-case">(optional)</span>
        </h3>
        <textarea
          value={state.notes}
          onChange={(e) => setField("notes", e.target.value)}
          rows={4}
          placeholder="Additional context, observations, or concerns..."
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
        />
      </section>

      {/* Live threshold indicator */}
      <section className="bg-gray-50 rounded-lg p-4 border border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Threshold Criteria
        </p>
        <ThresholdCriteria state={state} />
        {complete && (
          <div
            className={`mt-3 px-3 py-2 rounded-md text-sm font-medium ${
              meetsThreshold
                ? "bg-green-100 text-green-800 border border-green-200"
                : "bg-red-100 text-red-800 border border-red-200"
            }`}
          >
            {meetsThreshold ? "Meets threshold — Recommendation: Advance" : "Does not meet threshold — Recommendation: Do Not Advance"}
          </div>
        )}
      </section>

      {/* Recommendation & override */}
      {complete && (
        <section>
          <label className="flex items-center gap-2 cursor-pointer mb-3">
            <input
              type="checkbox"
              checked={state.override}
              onChange={(e) => setField("override", e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-sm text-gray-700">
              Override recommendation{" "}
              {meetsThreshold ? "(override to Do Not Advance)" : "(override to Advance)"}
            </span>
          </label>

          {state.override && (
            <div className="mt-2">
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Override reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={state.overrideReason}
                onChange={(e) => setField("overrideReason", e.target.value)}
                rows={3}
                placeholder="Explain why you are overriding the automated recommendation..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
          )}
        </section>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-3">
        <button
          onClick={handleSubmit}
          disabled={!complete || submitting || (state.override && !state.overrideReason.trim())}
          className={`px-5 py-2 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 ${
            complete && meetsThreshold && !state.override
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {submitLabel()}
        </button>
      </div>
    </div>
  );
}
