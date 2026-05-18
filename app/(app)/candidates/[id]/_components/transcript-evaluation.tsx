// Integration: import and render in app/(app)/candidates/[id]/page.tsx once Phase 2A merges
"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DimensionScores } from "@/lib/schemas/evaluation";
import { cn } from "@/lib/utils";

interface EvaluationData {
  id: string;
  starRating: number;
  totalScore: number;
  dimensionScores: DimensionScores;
  createdAt: Date;
}

interface TranscriptData {
  id: string;
  meetingDate: Date;
  hostEmail: string;
  matchMethod: "PARTICIPANT_EMAIL" | "MEETING_TOPIC";
}

interface TranscriptEvaluationProps {
  evaluation: EvaluationData;
  transcript: TranscriptData;
}

const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  getsIt: "Gets It",
  wantsIt: "Wants It",
  capacityToDoIt: "Capacity to Do It",
  noEgoAllIn: "No Ego All In",
  betterEveryDay: "Better Every Day",
  relentlessForResults: "Relentless for Results",
  drivenByTruth: "Driven by Truth",
  aiForward: "AI Forward",
};

function StarDisplay({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <span aria-label={`${score} out of ${max}`} className="text-amber-400">
      {"★".repeat(score)}
      <span className="text-muted-foreground/40">{"★".repeat(max - score)}</span>
    </span>
  );
}

function starBadgeVariant(
  starRating: number
): "default" | "secondary" | "destructive" | "outline" {
  if (starRating >= 4) return "default";
  if (starRating === 3) return "secondary";
  return "outline";
}

function cultureBucketLabel(totalScore: number): string {
  if (totalScore >= 36) return "Strong";
  if (totalScore >= 30) return "Strong";
  if (totalScore >= 24) return "Moderate";
  if (totalScore >= 16) return "Weak";
  return "Poor";
}

export function TranscriptEvaluation({
  evaluation,
  transcript,
}: TranscriptEvaluationProps) {
  const { starRating, totalScore, dimensionScores } = evaluation;
  const bucket = cultureBucketLabel(totalScore);

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
          {totalScore}/40 &middot; {bucket} &middot; Interview{" "}
          {new Date(transcript.meetingDate).toLocaleDateString()}
        </div>
      </CardHeader>

      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 font-medium">Dimension</th>
              <th className="pb-2 font-medium">Score</th>
              <th className="pb-2 font-medium">Evidence</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(DIMENSION_LABELS) as (keyof DimensionScores)[]).map((key) => {
              const dim = dimensionScores[key];
              return (
                <tr
                  key={key}
                  className={cn(
                    "border-b last:border-0",
                    dim.score <= 2 && "bg-destructive/5"
                  )}
                >
                  <td className="py-2 pr-4 font-medium">{DIMENSION_LABELS[key]}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <StarDisplay score={dim.score} />
                  </td>
                  <td className="py-2 text-muted-foreground">
                    <ul className="space-y-1">
                      {dim.evidence.map((quote, i) => (
                        <li key={i} className="italic before:content-['“'] after:content-['”']">
                          {quote}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
