"use client";

import { approveDisposition, overrideDisposition } from "@/lib/actions/disposition";
import type { DispositionAction } from "@/lib/schemas/disposition";
import { useState, useTransition } from "react";

interface Props {
  dispositionId: string;
  recommendedAction: string;
  status: string;
  notes?: string;
}

export default function ApprovalControls({
  dispositionId,
  recommendedAction,
  status,
  notes,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [overrideAction, setOverrideAction] = useState<DispositionAction>("HOLD");
  const [overrideNotes, setOverrideNotes] = useState("");
  const [showOverride, setShowOverride] = useState(false);

  const isSettled = status === "APPROVED" || status === "OVERRIDDEN";

  function handleApprove() {
    startTransition(async () => {
      try {
        await approveDisposition(dispositionId);
        setResult({ ok: true, message: "Disposition approved." });
      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : "Approval failed.",
        });
      }
    });
  }

  function handleOverride() {
    if (!overrideNotes.trim()) {
      setResult({ ok: false, message: "Notes are required for an override." });
      return;
    }
    startTransition(async () => {
      try {
        await overrideDisposition(dispositionId, overrideAction, overrideNotes);
        setResult({ ok: true, message: `Disposition overridden to ${overrideAction}.` });
      } catch (err) {
        setResult({
          ok: false,
          message: err instanceof Error ? err.message : "Override failed.",
        });
      }
    });
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
        Recommendation
      </h2>

      <div className="mb-4 flex items-center gap-3">
        <span className="text-base font-medium">{recommendedAction}</span>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
          {status}
        </span>
      </div>

      {notes && <p className="mb-4 text-sm text-gray-600">{notes}</p>}

      {result && (
        <p
          className={`mb-4 rounded px-3 py-2 text-sm ${
            result.ok
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {result.message}
        </p>
      )}

      {!isSettled && !result?.ok && (
        <div className="flex flex-col gap-3">
          <button
            onClick={handleApprove}
            disabled={isPending}
            className="rounded bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isPending ? "Processing..." : "Approve"}
          </button>

          <button
            onClick={() => setShowOverride((v) => !v)}
            className="text-left text-sm text-gray-500 underline"
          >
            {showOverride ? "Cancel override" : "Override recommendation"}
          </button>

          {showOverride && (
            <div className="rounded border border-gray-200 p-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                New action
              </label>
              <select
                value={overrideAction}
                onChange={(e) => setOverrideAction(e.target.value as DispositionAction)}
                className="mb-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="ADVANCE">ADVANCE</option>
                <option value="HOLD">HOLD</option>
                <option value="DISQUALIFY">DISQUALIFY</option>
              </select>

              <label className="mb-1 block text-xs font-medium text-gray-600">
                Notes (required)
              </label>
              <textarea
                value={overrideNotes}
                onChange={(e) => setOverrideNotes(e.target.value)}
                rows={3}
                className="mb-3 w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
                placeholder="Explain the reason for this override..."
              />

              <button
                onClick={handleOverride}
                disabled={isPending}
                className="rounded bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {isPending ? "Processing..." : "Override"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
