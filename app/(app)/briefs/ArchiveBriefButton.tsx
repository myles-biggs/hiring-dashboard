"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ArchiveBriefButton({ briefId }: { briefId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleArchive(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Archive this brief? It will be removed from the active list.")) return;
    setPending(true);
    try {
      const res = await fetch(`/api/briefs/${briefId}/archive`, { method: "POST" });
      if (!res.ok) throw new Error("Archive failed");
      router.refresh();
    } catch {
      alert("Failed to archive brief. Please try again.");
      setPending(false);
    }
  }

  return (
    <button
      onClick={handleArchive}
      disabled={pending}
      className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors px-2 py-1 rounded hover:bg-red-50"
      aria-label="Archive brief"
    >
      {pending ? "Archiving…" : "Archive"}
    </button>
  );
}
