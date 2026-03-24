"use client";

import { HiringBrief } from "@prisma/client";
import { useState } from "react";

export function JDView({ brief }: { brief: HiringBrief }) {
  const [activeTab, setActiveTab] = useState<"en" | "fr">("en");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [jdEnglish, setJdEnglish] = useState(brief.jdEnglish ?? "");
  const [jdFrench, setJdFrench] = useState(brief.jdFrench ?? "");
  const [workableJobId, setWorkableJobId] = useState(brief.workableJobId);

  async function generate() {
    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch(`/api/jd/${brief.id}`, { method: "POST" });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Generation failed. Please try again.");
        return;
      }

      const data = await res.json();
      setJdEnglish(data.jdEnglish ?? "");
      setJdFrench(data.jdFrench ?? "");
      setEditing(false);
    } catch {
      setError("Request timed out or failed. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function saveEdits() {
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/jd/${brief.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jdEnglish, jdFrench: jdFrench || null }),
    });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Save failed. Please try again.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditing(false);
    setSuccess("Changes saved.");
    setTimeout(() => setSuccess(null), 3000);
  }

  async function postToWorkable() {
    setPosting(true);
    setError(null);
    setSuccess(null);

    const res = await fetch(`/api/briefs/${brief.id}/publish`, { method: "POST" });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "Failed to post to Workable.");
      setPosting(false);
      return;
    }

    setWorkableJobId(body.workableJobId);
    setPosting(false);
    setSuccess("Job posted to Workable successfully.");
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text);
  }

  if (!jdEnglish) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm mb-6">
          No job post generated yet. Click below to generate using the approved brief data.
        </p>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}
        <button
          onClick={generate}
          disabled={generating}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? "Generating..." : "Generate job post"}
        </button>
      </div>
    );
  }

  const activeContent = activeTab === "en" ? jdEnglish : jdFrench;

  return (
    <div className="space-y-4">
      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}
      {success && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex gap-1">
            <TabButton active={activeTab === "en"} onClick={() => setActiveTab("en")}>
              English
            </TabButton>
            {jdFrench && (
              <TabButton active={activeTab === "fr"} onClick={() => setActiveTab("fr")}>
                French (QC)
              </TabButton>
            )}
          </div>
          <div className="flex items-center gap-3">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdits}
                  disabled={saving}
                  className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save changes"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
                >
                  {generating ? "Regenerating..." : "Regenerate"}
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => copy(activeContent)}
                  className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors"
                >
                  Copy
                </button>
              </>
            )}
          </div>
        </div>

        <div className="p-6">
          {editing ? (
            <textarea
              value={activeTab === "en" ? jdEnglish : jdFrench}
              onChange={(e) =>
                activeTab === "en"
                  ? setJdEnglish(e.target.value)
                  : setJdFrench(e.target.value)
              }
              rows={30}
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent font-mono leading-relaxed resize-y"
            />
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans text-sm leading-relaxed">
              {activeContent}
            </div>
          )}
        </div>
      </div>

      {/* Post to Workable */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">Post to Workable</p>
          {workableJobId ? (
            <p className="text-xs text-gray-500 mt-0.5">
              Live — job ID:{" "}
              <a
                href={`https://${process.env.NEXT_PUBLIC_WORKABLE_SUBDOMAIN}.workable.com/jobs/${workableJobId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono underline"
              >
                {workableJobId}
              </a>
            </p>
          ) : (
            <p className="text-xs text-gray-500 mt-0.5">
              Review both language versions above, then post when ready.
            </p>
          )}
        </div>
        {workableJobId ? (
          <span className="px-3 py-1.5 bg-green-100 text-green-800 text-xs font-medium rounded-full">
            Posted
          </span>
        ) : (
          <button
            onClick={postToWorkable}
            disabled={posting}
            className="px-5 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {posting ? "Posting..." : "Post to Workable"}
          </button>
        )}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
        active ? "bg-gray-900 text-white" : "text-gray-600 hover:text-gray-900"
      }`}
    >
      {children}
    </button>
  );
}
