"use client";

import { WorkableStageOption } from "@/lib/integrations/workable";
import { WorkableCandidate, WorkableEmailTemplate } from "@/types/workable";
import { useEffect, useState } from "react";

interface VetData {
  workableCandidateId: string;
  aiVetScore: number | null;
  aiVetStatus: string | null;
  aiVetSummary: string | null;
  aiVetQuestions: string[];
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

// ─── Email Modal ──────────────────────────────────────────────────────────────

function EmailModal({
  jobShortcode,
  candidate,
  onClose,
}: {
  jobShortcode: string;
  candidate: WorkableCandidate;
  onClose: () => void;
}) {
  const [templates, setTemplates] = useState<WorkableEmailTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/postings/templates")
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setLoadingTemplates(false));
  }, []);

  function applyTemplate(t: WorkableEmailTemplate) {
    setSubject(t.subject);
    // Strip basic HTML tags for the textarea
    setBody(t.body.replace(/<[^>]+>/g, "").trim());
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    setSending(true);
    setError(null);
    const res = await fetch(
      `/api/postings/${jobShortcode}/candidates/${candidate.id}/email`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body }),
      }
    );
    setSending(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to send.");
      return;
    }
    setSent(true);
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">
        Email {candidate.name}
      </h2>
      <p className="text-sm text-gray-500 mb-5">{candidate.email}</p>

      {sent ? (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3 mb-4">
          Email sent successfully.
        </div>
      ) : (
        <>
          {/* Template picker */}
          {loadingTemplates ? (
            <p className="text-xs text-gray-400 mb-4">Loading templates…</p>
          ) : templates.length > 0 ? (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Workable templates
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => applyTemplate(t)}
                    className="text-xs px-3 py-1.5 border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Subject</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Subject"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Message</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your message…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 mt-3">{error}</p>
          )}

          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={send}
              disabled={sending || !subject.trim() || !body.trim()}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {sending ? "Sending…" : "Send email"}
            </button>
          </div>
        </>
      )}

      {sent && (
        <div className="flex justify-end mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      )}
    </Modal>
  );
}

// ─── Schedule Modal ───────────────────────────────────────────────────────────

const DURATIONS = [
  { label: "15 min", value: 15 },
  { label: "30 min", value: 30 },
  { label: "45 min", value: 45 },
  { label: "1 hour", value: 60 },
  { label: "90 min", value: 90 },
];

function ScheduleModal({
  jobShortcode,
  jobTitle,
  candidate,
  onClose,
}: {
  jobShortcode: string;
  jobTitle: string;
  candidate: WorkableCandidate;
  onClose: () => void;
}) {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + 1);
  defaultDate.setHours(10, 0, 0, 0);

  const [title, setTitle] = useState(`Interview – ${candidate.name} for ${jobTitle}`);
  const [date, setDate] = useState(defaultDate.toISOString().slice(0, 10));
  const [time, setTime] = useState("10:00");
  const [duration, setDuration] = useState(60);
  const [addMeet, setAddMeet] = useState(true);
  const [interviewers, setInterviewers] = useState("");
  const [description, setDescription] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [result, setResult] = useState<{ htmlLink: string; meetLink?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function schedule() {
    const interviewerEmails = interviewers
      .split(/[\s,]+/)
      .map((e) => e.trim())
      .filter(Boolean);

    if (!interviewerEmails.length) {
      setError("Add at least one interviewer email.");
      return;
    }

    const startIso = new Date(`${date}T${time}:00`).toISOString();

    setScheduling(true);
    setError(null);

    const res = await fetch(
      `/api/postings/${jobShortcode}/candidates/${candidate.id}/schedule`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateName: candidate.name,
          candidateEmail: candidate.email,
          title,
          startIso,
          durationMinutes: duration,
          addMeet,
          interviewerEmails,
          description,
        }),
      }
    );

    setScheduling(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Failed to schedule.");
      return;
    }

    setResult(await res.json());
  }

  return (
    <Modal onClose={onClose}>
      <h2 className="text-lg font-semibold text-gray-900 mb-1">Schedule interview</h2>
      <p className="text-sm text-gray-500 mb-5">{candidate.name} · {candidate.email}</p>

      {result ? (
        <div className="space-y-4">
          <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
            Calendar invite sent to {candidate.name} and all interviewers.
          </div>
          <div className="space-y-2">
            <a
              href={result.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-900 underline block"
            >
              View in Google Calendar →
            </a>
            {result.meetLink && (
              <a
                href={result.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-green-700 underline block"
              >
                Google Meet link →
              </a>
            )}
          </div>
          <div className="flex justify-end mt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">Event title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 block mb-1">Time (ET)</label>
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-2">Duration</label>
              <div className="flex gap-2 flex-wrap">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => setDuration(d.value)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      duration === d.value
                        ? "bg-gray-900 text-white border-gray-900"
                        : "border-gray-300 text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Interviewer emails <span className="text-gray-400">(comma or space separated)</span>
              </label>
              <input
                value={interviewers}
                onChange={(e) => setInterviewers(e.target.value)}
                placeholder="name@level.agency, name2@level.agency"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Description <span className="text-gray-400">(optional)</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Interview agenda, prep notes…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 resize-none"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addMeet}
                onChange={(e) => setAddMeet(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Add Google Meet link</span>
            </label>
          </div>

          {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

          <div className="flex justify-end gap-3 mt-5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={schedule}
              disabled={scheduling}
              className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
            >
              {scheduling ? "Scheduling…" : "Schedule interview"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

// ─── Shared Modal Shell ───────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
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
  jdEnglish,
}: Props) {
  const [candidates, setCandidates] = useState(initialCandidates);
  const [vetMap, setVetMap] = useState(initialVetMap);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [vettingId, setVettingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"applied" | "score">("score");
  const [filterStatus, setFilterStatus] = useState<"all" | "Qualified" | "Unqualified">("all");
  const [vettingAll, setVettingAll] = useState(false);
  const [vetAllSummary, setVetAllSummary] = useState<string | null>(null);
  const [closePrompt, setClosePrompt] = useState<{ candidateId: string; stageSlug: string } | null>(null);
  const [closing, setClosing] = useState(false);
  const [jobClosed, setJobClosed] = useState(false);
  const [emailTarget, setEmailTarget] = useState<WorkableCandidate | null>(null);
  const [scheduleTarget, setScheduleTarget] = useState<WorkableCandidate | null>(null);

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

  async function moveCandidate(candidateId: string, targetStageSlug: string) {
    const targetStage = stages.find((s) => s.slug === targetStageSlug);
    if (targetStage?.kind === "hired") {
      setClosePrompt({ candidateId, stageSlug: targetStageSlug });
      return;
    }
    await executeMoveCandidate(candidateId, targetStageSlug);
  }

  async function executeMoveCandidate(candidateId: string, targetStageSlug: string) {
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

  async function confirmHiredAndClose() {
    if (!closePrompt) return;
    await executeMoveCandidate(closePrompt.candidateId, closePrompt.stageSlug);
    setClosing(true);
    const res = await fetch(`/api/postings/${jobShortcode}/close`, { method: "POST" });
    if (!res.ok) {
      const body = await res.json();
      setError(body.error ?? "Failed to close job.");
    } else {
      setJobClosed(true);
    }
    setClosing(false);
    setClosePrompt(null);
  }

  async function confirmHiredOnly() {
    if (!closePrompt) return;
    await executeMoveCandidate(closePrompt.candidateId, closePrompt.stageSlug);
    setClosePrompt(null);
  }

  async function runVetAll() {
    setVettingAll(true);
    setVetAllSummary(null);
    setError(null);

    const res = await fetch(`/api/postings/${jobShortcode}/vet-all`, { method: "POST" });
    const body = await res.json();

    setVettingAll(false);

    if (!res.ok) {
      setError(body.error ?? "Bulk vetting failed.");
      return;
    }

    // Merge results into vetMap
    if (body.results?.length > 0) {
      setVetMap((prev) => {
        const next = { ...prev };
        for (const r of body.results) {
          next[r.candidateId] = {
            ...next[r.candidateId],
            workableCandidateId: r.candidateId,
            aiVetScore: r.score,
            aiVetStatus: r.score >= 60 ? "Qualified" : "Unqualified",
            aiVetSummary: next[r.candidateId]?.aiVetSummary ?? null,
            aiVetQuestions: next[r.candidateId]?.aiVetQuestions ?? [],
          };
        }
        return next;
      });
    }

    setVetAllSummary(
      body.vetted > 0
        ? `${body.vetted} candidate${body.vetted !== 1 ? "s" : ""} vetted${body.skipped > 0 ? `, ${body.skipped} already scored` : ""}`
        : `All candidates already scored`
    );
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

  const currentStageIndex = (candidate: WorkableCandidate) =>
    activeStages.findIndex((s) => s.name === candidate.stage.name);

  return (
    <div className="space-y-6">
      {/* Modals */}
      {emailTarget && (
        <EmailModal
          jobShortcode={jobShortcode}
          candidate={emailTarget}
          onClose={() => setEmailTarget(null)}
        />
      )}
      {scheduleTarget && (
        <ScheduleModal
          jobShortcode={jobShortcode}
          jobTitle={jobTitle}
          candidate={scheduleTarget}
          onClose={() => setScheduleTarget(null)}
        />
      )}

      {/* Hired confirmation */}
      {closePrompt && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-8 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Mark as Hired</h2>
            <p className="text-sm text-gray-600 mb-6">
              Do you want to close this job posting on Workable now that a candidate has been hired?
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setClosePrompt(null)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmHiredOnly}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Mark hired, keep open
              </button>
              <button
                onClick={confirmHiredAndClose}
                disabled={closing}
                className="px-4 py-2 text-sm bg-gray-900 text-white rounded-lg hover:bg-gray-800 disabled:opacity-50 transition-colors"
              >
                {closing ? "Closing…" : "Mark hired & close posting"}
              </button>
            </div>
          </div>
        </div>
      )}

      {jobClosed && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-4 py-3">
          Job posting closed on Workable.
        </div>
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
            className="text-xs px-3 py-1.5 bg-gray-900 text-white rounded-full hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            {vettingAll ? "Vetting all…" : "Vet all unvetted"}
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
                          <p className="text-xs text-gray-400 mt-0.5">
                            Applied {new Date(candidate.created_at).toLocaleDateString("en-CA")}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                          <button
                            onClick={() => runVet(candidate)}
                            disabled={vettingId === candidate.id}
                            title="Run AI vet"
                            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                          >
                            {vettingId === candidate.id ? "Vetting…" : vet ? "Re-vet" : "AI Vet"}
                          </button>

                          <button
                            onClick={() => setEmailTarget(candidate)}
                            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Email
                          </button>

                          <button
                            onClick={() => setScheduleTarget(candidate)}
                            className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 transition-colors"
                          >
                            Schedule
                          </button>

                          {prevStage && (
                            <button
                              onClick={() => moveCandidate(candidate.id, prevStage.slug)}
                              disabled={movingId === candidate.id}
                              className="text-xs px-2.5 py-1.5 border border-gray-300 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-colors"
                            >
                              ← {prevStage.name}
                            </button>
                          )}

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
