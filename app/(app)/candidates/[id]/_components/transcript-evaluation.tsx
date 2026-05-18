// Integration: import and render in app/(app)/candidates/[id]/page.tsx once Phase 2A merges
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const DIMENSION_LABELS: Record<string, string> = {
  getsIt: "Gets It",
  wantsIt: "Wants It",
  capacityToDoIt: "Capacity to Do It",
  noEgoAllIn: "No Ego All In",
  betterEveryDay: "Better Every Day",
  relentlessForResults: "Relentless for Results",
  drivenByTruth: "Driven by Truth",
  aiForward: "AI Forward",
};

interface EvaluationData {
  id: string;
  score: number;
  bucket: string;
  dimensionScores: Record<string, number> | null;
  createdAt: Date;
}

interface TranscriptData {
  id: string;
  meetingDate: Date;
  interviewerEmails: string[];
  matchMethod: string;
}

interface TranscriptEvaluationProps {
  evaluation: EvaluationData;
  transcript: TranscriptData;
}

function StarDisplay({ score, max = 5 }: { score: number; max?: number }) {
  const clamped = Math.min(Math.max(Math.round(score), 0), max);
  return (
    <span aria-label={`${clamped} out of ${max}`} className="text-amber-400">
      {"★".repeat(clamped)}
      <span className="text-muted-foreground/40">{"★".repeat(max - clamped)}</span>
    </span>
  );
}

function starRatingFromScore(score: number): number {
  if (score >= 36) return 5;
  if (score >= 30) return 4;
  if (score >= 24) return 3;
  if (score >= 16) return 2;
  return 1;
}

function starBadgeVariant(
  starRating: number
): "default" | "secondary" | "destructive" | "outline" {
  if (starRating >= 4) return "default";
  if (starRating === 3) return "secondary";
  return "outline";
}

export function TranscriptEvaluation({
  evaluation,
  transcript,
}: TranscriptEvaluationProps) {
  const { score, dimensionScores } = evaluation;
  const starRating = starRatingFromScore(score);
  const dimKeys = Object.keys(DIMENSION_LABELS);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Culture Fit Evaluation</CardTitle>
          <Badge variant={starBadgeVariant(starRating)}>
            <StarDisplay score={starRating} /> {starRating}/5
          </Badge>
        </div>
        <div className="text-sm text-muted-foreground">
          {score}/40 &middot; {evaluation.bucket} &middot; Interview{" "}
          {new Date(transcript.meetingDate).toLocaleDateString()}
        </div>
      </CardHeader>

      <CardContent>
        {dimensionScores && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 font-medium">Dimension</th>
                <th className="pb-2 font-medium">Score</th>
              </tr>
            </thead>
            <tbody>
              {dimKeys.map((key) => {
                const dimScore = dimensionScores[key] ?? 0;
                return (
                  <tr
                    key={key}
                    className={cn(
                      "border-b last:border-0",
                      dimScore <= 2 && "bg-destructive/5"
                    )}
                  >
                    <td className="py-2 pr-4 font-medium">
                      {DIMENSION_LABELS[key] ?? key}
                    </td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      <StarDisplay score={dimScore} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}
