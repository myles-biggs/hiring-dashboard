import { authOptions } from "@/lib/auth/config";
import { getEmailTemplates } from "@/lib/integrations/workable";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const templates = await getEmailTemplates();
    return NextResponse.json({ templates });
  } catch (err) {
    console.error("Failed to fetch email templates:", err);
    return NextResponse.json({ templates: [] });
  }
}
