"use client";

import { HiringBrief } from "@prisma/client";
import { useState } from "react";

export function JDView({ brief }: { brief: HiringBrief }) {
  const [activeTab, setActiveTab] = useState<"en" | "fr">("en");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jdEnglish, setJdEnglish] = useState(brief.jdEnglish);
  const [jdFrench, setJdFrench] = useState(brief.jdFrench);

  async function generate() {
    setGenerating(true);
    setError(null);

    const res = await fetch(`/api/jd/${brief.id}`, { method: "POST" });

    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Generation failed. Please try again.");
      setGenerating(false);
      return;
    }

    const data = await res.json();
    setJdEnglish(data.jdEnglish);
    setJdFrench(data.jdFrench);
    setGenerating(false);
  }

  function copy(text: string | null) {
    if (!text) return;
    navigator.clipboard.writeText(text);
  }

  if (!jdEnglish) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500 text-sm mb-6">
          No JD generated yet. Click below to generate using the approved brief data.
        </p>
        {error && (
          <p className="text-sm text-red-600 mb-4">{error}</p>
        )}
        <button
          onClick={generate}
          disabled={generating}
          className="px-6 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {generating ? "Generating..." : "Generate JD"}
        </button>
      </div>
    );
  }

  const hasFrench = !!jdFrench;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
        <div className="flex gap-1">
          <TabButton active={activeTab === "en"} onClick={() => setActiveTab("en")}>
            English
          </TabButton>
          {hasFrench && (
            <TabButton active={activeTab === "fr"} onClick={() => setActiveTab("fr")}>
              French (QC)
            </TabButton>
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={generate}
            disabled={generating}
            className="text-xs text-gray-500 hover:text-gray-700 transition-colors disabled:opacity-50"
          >
            {generating ? "Regenerating..." : "Regenerate"}
          </button>
          <button
            onClick={() => copy(activeTab === "en" ? jdEnglish : jdFrench)}
            className="text-xs font-medium text-gray-900 hover:text-gray-700 transition-colors"
          >
            Copy
          </button>
        </div>
      </div>

      <div className="p-6">
        <div className="prose prose-sm max-w-none text-gray-800 whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {activeTab === "en" ? jdEnglish : jdFrench}
        </div>
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
