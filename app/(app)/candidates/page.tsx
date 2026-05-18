import { authOptions } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/utils/prisma";
import { getServerSession } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";

interface PageProps {
  searchParams: Promise<{ action?: string; job?: string }>;
}

export default async function CandidatesPage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  try {
    requireRole(session, "TALENT_ACQUISITION", "ADMIN");
  } catch {
    redirect("/dashboard");
  }

  const { action, job } = await searchParams;

  const candidates = await prisma.candidate.findMany({
    where: {
      ...(job ? { workableJobShortcode: job } : {}),
      ...(action
        ? {
            dispositions: {
              some: { recommendedAction: action as "ADVANCE" | "HOLD" | "DISQUALIFY" },
            },
          }
        : {}),
    },
    include: {
      dispositions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Candidates</h1>
        <div className="flex gap-3 text-sm">
          <FilterLink label="All" href="/candidates" active={!action} />
          <FilterLink label="Advance" href="/candidates?action=ADVANCE" active={action === "ADVANCE"} />
          <FilterLink label="Hold" href="/candidates?action=HOLD" active={action === "HOLD"} />
          <FilterLink label="Disqualify" href="/candidates?action=DISQUALIFY" active={action === "DISQUALIFY"} />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Recommended Action</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applied</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {candidates.map((c) => {
              const disposition = c.dispositions[0];
              return (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/candidates/${c.id}`} className="font-medium text-blue-600 hover:underline">
                      {c.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{c.workableJobTitle}</td>
                  <td className="px-4 py-3">
                    {disposition ? (
                      <ActionBadge action={disposition.recommendedAction} />
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {disposition ? (
                      <span className="text-gray-700">{disposition.status}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.createdAt.toLocaleDateString()}
                  </td>
                </tr>
              );
            })}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  No candidates found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded px-3 py-1 ${
        active
          ? "bg-blue-600 text-white"
          : "border border-gray-300 text-gray-600 hover:bg-gray-50"
      }`}
    >
      {label}
    </Link>
  );
}

function ActionBadge({ action }: { action: string }) {
  const styles: Record<string, string> = {
    ADVANCE: "bg-green-100 text-green-700",
    HOLD: "bg-yellow-100 text-yellow-700",
    DISQUALIFY: "bg-red-100 text-red-700",
  };
  const style = styles[action] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${style}`}>
      {action}
    </span>
  );
}
