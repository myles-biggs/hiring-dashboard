import { authOptions } from "@/lib/auth/config";
import { sendCandidateEmail } from "@/lib/integrations/workable";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const schema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shortcode: string; candidateId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { shortcode, candidateId } = await params;
  const parsed = schema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  try {
    await sendCandidateEmail(
      shortcode,
      candidateId,
      parsed.data.subject,
      parsed.data.body,
      session.user.email ?? undefined
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Email send failed:", err);
    const msg = err instanceof Error ? err.message : "Failed to send email";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
