"use client";

import { useState } from "react";
import { Button } from "@levelinteractive/ui";
import { postReportToSlack } from "@/lib/actions/post-report-to-slack";

interface SlackPushButtonProps {
  reportType: "state-of-hiring" | "daily-snapshot" | "pipeline";
  summaryData: Record<string, unknown>;
}

function buildPreview(
  reportType: string,
  summaryData: Record<string, unknown>
): string {
  const date = new Date().toLocaleDateString("en-CA");
  const label =
    reportType === "state-of-hiring"
      ? "State of Hiring"
      : reportType === "daily-snapshot"
      ? "Daily Snapshot"
      : "Pipeline Report";

  const header = `*${label} — ${date}*`;

  const bullets = Object.entries(summaryData)
    .slice(0, 5)
    .map(([key, value]) => {
      const label = key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (s) => s.toUpperCase());
      const display =
        typeof value === "object" ? JSON.stringify(value) : String(value);
      return `• ${label}: ${display}`;
    });

  return [header, ...bullets].join("\n");
}

type SendState = "idle" | "preview" | "sending" | "sent" | "error";

export function SlackPushButton({ reportType, summaryData }: SlackPushButtonProps) {
  const [state, setState] = useState<SendState>("idle");
  const [preview, setPreview] = useState("");
  const [permalink, setPermalink] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function handleOpenPreview() {
    setPreview(buildPreview(reportType, summaryData));
    setState("preview");
  }

  async function handleConfirm() {
    setState("sending");
    try {
      const result = await postReportToSlack(reportType, preview);
      setPermalink(result.messagePermalink);
      setState("sent");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  function handleCancel() {
    setState("idle");
    setPreview("");
  }

  if (state === "sent") {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-green-700 font-medium">Posted to Slack</span>
        {permalink && (
          <a
            href={permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            View message
          </a>
        )}
        <button
          onClick={() => { setState("idle"); setPermalink(null); }}
          className="text-muted-foreground hover:text-foreground text-xs"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <>
      {state === "idle" || state === "error" ? (
        <div className="flex flex-col gap-1">
          <Button variant="outline" size="sm" onClick={handleOpenPreview}>
            Push to Slack
          </Button>
          {state === "error" && (
            <p className="text-xs text-destructive">{errorMsg ?? "Send failed"}</p>
          )}
        </div>
      ) : null}

      {(state === "preview" || state === "sending") && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-semibold text-foreground">
              Preview Slack message
            </h3>
            <pre className="bg-muted rounded p-4 text-sm whitespace-pre-wrap font-mono text-foreground overflow-auto max-h-64">
              {preview}
            </pre>
            <p className="text-xs text-muted-foreground">
              This will be posted to #hiring-reports. Review before sending.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancel}
                disabled={state === "sending"}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => { void handleConfirm(); }}
                disabled={state === "sending"}
              >
                {state === "sending" ? "Sending..." : "Confirm & Send"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
