import { authOptions } from "@/lib/auth/config";
import { scheduleInterview } from "@/lib/integrations/google-calendar";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  candidateName: z.string(),
  candidateEmail: z.string().email(),
  title: z.string().min(1),
  startIso: z.string(),
  durationMinutes: z.number().int().min(15).max(480),
  addMeet: z.boolean(),
  interviewerEmails: z.array(z.string().email()).min(1),
  description: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await params; // shortcode/candidateId available if needed for notes

  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    const result = await scheduleInterview(parsed.data);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Schedule failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to create calendar event";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
