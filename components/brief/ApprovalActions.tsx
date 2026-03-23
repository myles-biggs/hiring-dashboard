"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ApprovalActions({ briefId }: { briefId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "APPROVED" | "REJECTED") {
    setLoading(action);
    setError(null);

    const res = await fetch(`/api/briefs/${briefId}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, note }),
    });

    if (!res.ok) {
      setError("Action failed. Please try again.");
      setLoading(null);
      return;
    }

    router.refresh();
    setLoading(null);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="font-semibold text-gray-900 mb-4">Approval decision</h2>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          Note (optional)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Add context for the hiring manager..."
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 mb-4">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={() => act("APPROVED")}
          disabled={loading !== null}
          className="px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {loading === "APPROVED" ? "Approving..." : "Approve"}
        </button>
        <button
          onClick={() => act("REJECTED")}
          disabled={loading !== null}
          className="px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
        >
          {loading === "REJECTED" ? "Rejecting..." : "Reject"}
        </button>
      </div>
    </div>
  );
}
