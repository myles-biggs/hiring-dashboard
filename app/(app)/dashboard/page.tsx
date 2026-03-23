import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { ApprovalBadge } from "@/components/brief/ApprovalBadge";
import { HiringBrief } from "@prisma/client";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  const isHR = session?.user.role === "HR" || session?.user.role === "ADMIN";

  const briefs = await prisma.hiringBrief.findMany({
    where: isHR ? {} : { hiringManagerEmail: session?.user.email },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Hiring Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Open roles and pipeline status</p>
        </div>
        <Link
          href="/briefs/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          New brief
        </Link>
      </div>

      {briefs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No hiring briefs yet.</p>
          <Link
            href="/briefs/new"
            className="inline-block mt-4 text-sm font-medium text-gray-900 underline"
          >
            Submit the first brief
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {briefs.map((brief: HiringBrief) => (
            <Link
              key={brief.id}
              href={`/briefs/${brief.id}`}
              className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors flex items-center justify-between"
            >
              <div>
                <p className="font-medium text-gray-900">{brief.roleTitle}</p>
                <p className="text-sm text-gray-500 mt-0.5">{brief.department}</p>
              </div>
              <div className="flex items-center gap-4">
                {brief.targetStartDate && (
                  <p className="text-xs text-gray-400">
                    Start {new Date(brief.targetStartDate).toLocaleDateString("en-CA")}
                  </p>
                )}
                <ApprovalBadge status={brief.approvalStatus} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
