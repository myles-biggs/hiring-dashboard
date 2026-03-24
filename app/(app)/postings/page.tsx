import { authOptions } from "@/lib/auth/config";
import { getJobs, getCandidatesForJob } from "@/lib/integrations/workable";
import { getServerSession } from "next-auth";
import Link from "next/link";

export default async function ActivePostingsPage() {
  await getServerSession(authOptions);

  let jobs: Awaited<ReturnType<typeof getJobs>> = [];
  let fetchError: string | null = null;

  try {
    jobs = await getJobs();
  } catch (err) {
    fetchError = err instanceof Error ? err.message : "Failed to load jobs";
  }

  // Fetch candidate counts for each job in parallel
  const jobsWithCounts = await Promise.all(
    jobs.map(async (job) => {
      try {
        const candidates = await getCandidatesForJob(job.shortcode);
        const stageCounts: Record<string, number> = {};
        for (const c of candidates) {
          if (!c.disqualified) {
            stageCounts[c.stage.name] = (stageCounts[c.stage.name] ?? 0) + 1;
          }
        }
        return { job, total: candidates.filter((c) => !c.disqualified).length, stageCounts };
      } catch {
        return { job, total: 0, stageCounts: {} };
      }
    })
  );

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">Active Postings</h1>
        <p className="text-sm text-gray-500 mt-1">Live roles and candidate pipelines from Workable</p>
      </div>

      {fetchError && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-6">
          {fetchError}
        </div>
      )}

      {jobs.length === 0 && !fetchError && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <p className="text-gray-500 text-sm">No active job postings.</p>
        </div>
      )}

      <div className="space-y-3">
        {jobsWithCounts.map(({ job, total, stageCounts }) => (
          <Link
            key={job.shortcode}
            href={`/postings/${job.shortcode}`}
            className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-medium text-gray-900">{job.title}</h2>
                <p className="text-sm text-gray-500 mt-0.5">
                  {job.department ?? "—"} · {job.location?.location_str ?? "Remote"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-lg font-semibold text-gray-900">{total}</span>
                <p className="text-xs text-gray-400">active candidates</p>
              </div>
            </div>

            {Object.keys(stageCounts).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {Object.entries(stageCounts).map(([stage, count]) => (
                  <span
                    key={stage}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
                  >
                    <span className="font-medium">{count}</span>
                    <span>{stage}</span>
                  </span>
                ))}
              </div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
