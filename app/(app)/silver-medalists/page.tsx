import { prisma } from "@/lib/utils/prisma";
import Link from "next/link";

export default async function SilverMedalistsPage() {
  const medalists = await prisma.candidateCache.findMany({
    where: { isSilverMedalist: true },
    orderBy: { aiVetScore: "desc" },
    include: {
      brief: {
        select: { roleTitle: true },
      },
    },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Silver Medalists</h1>
        <p className="text-sm text-gray-500 mt-1">
          Strong candidates to consider for future openings
        </p>
      </div>

      {medalists.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No silver medalists yet.</p>
          <p className="text-gray-400 text-xs mt-1">
            Star a candidate from the pipeline to add them here.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Candidate</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">AI Score</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Note</th>
                <th className="text-left px-5 py-3 font-medium text-gray-500">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {medalists.map((m) => {
                const roleLabel = m.brief?.roleTitle ?? m.workableJobId;
                const score = m.aiVetScore;
                const scoreColor =
                  score == null
                    ? "text-gray-400"
                    : score >= 80
                    ? "text-green-700 bg-green-100"
                    : score >= 60
                    ? "text-yellow-700 bg-yellow-100"
                    : "text-red-700 bg-red-100";

                return (
                  <tr key={m.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3">
                      <span className="font-medium text-gray-900">{m.name}</span>
                      {m.email && (
                        <span className="block text-xs text-gray-400">{m.email}</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-600">{roleLabel}</td>
                    <td className="px-5 py-3">
                      {score != null ? (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${scoreColor}`}>
                          {score}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-gray-500 max-w-xs">
                      {m.silverMedalistNote ?? <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/postings/${m.workableJobId}`}
                        className="text-xs text-gray-500 underline hover:text-gray-700"
                      >
                        View pipeline →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
