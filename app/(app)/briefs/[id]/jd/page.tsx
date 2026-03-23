import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { JDView } from "@/components/brief/JDView";

export default async function JDPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  const brief = await prisma.hiringBrief.findUnique({ where: { id } });

  if (!brief) notFound();

  const isHR = session?.user.role === "HR" || session?.user.role === "ADMIN";
  const isOwner = brief.hiringManagerEmail === session?.user.email;

  if (!isHR && !isOwner) notFound();

  if (brief.approvalStatus !== "APPROVED") {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-gray-500">This brief must be approved before generating a JD.</p>
        <Link href={`/briefs/${id}`} className="text-sm font-medium text-gray-900 underline mt-4 block">
          Back to brief
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <Link href={`/briefs/${id}`} className="text-sm text-gray-500 hover:text-gray-700 mb-2 block">
          ← Back to brief
        </Link>
        <h1 className="text-2xl font-semibold text-gray-900">Job description — {brief.roleTitle}</h1>
        {brief.jdGeneratedAt && (
          <p className="text-xs text-gray-400 mt-1">
            Generated {new Date(brief.jdGeneratedAt).toLocaleDateString("en-CA")}
          </p>
        )}
      </div>

      <JDView brief={brief} />
    </div>
  );
}
