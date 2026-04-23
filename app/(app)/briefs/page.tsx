import { prisma } from "@/lib/utils/prisma";
import Link from "next/link";
import { ApprovalBadge } from "@/components/brief/ApprovalBadge";
import { HiringBrief } from "@prisma/client";

export default async function BriefsListPage() {
  const briefs = await prisma.hiringBrief.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Hiring briefs</h1>
        <Link
          href="/briefs/new"
          className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors"
        >
          New brief
        </Link>
      </div>

      {briefs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No briefs yet.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Department</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Hiring manager</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Status</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Submitted</th>
              </tr>
            </thead>
            <tbody>
              {briefs.map((brief: HiringBrief) => (
                <tr key={brief.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-5 py-3">
                    <Link href={`/briefs/${brief.id}`} className="font-medium text-gray-900 hover:underline">
                      {brief.roleTitle}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-gray-500">{brief.department}</td>
                  <td className="px-5 py-3 text-gray-500">{brief.hiringManagerEmail}</td>
                  <td className="px-5 py-3">
                    <ApprovalBadge status={brief.approvalStatus} />
                  </td>
                  <td className="px-5 py-3 text-gray-400">
                    {new Date(brief.createdAt).toLocaleDateString("en-CA")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
