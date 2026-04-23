import { prisma } from "@/lib/utils/prisma";

function classifyCountry(country: string | null): "CA" | "US" | "Other" {
  if (!country) return "Other";
  const c = country.trim().toUpperCase();
  if (c === "CA" || c === "CANADA") return "CA";
  if (c === "US" || c === "UNITED STATES" || c === "USA") return "US";
  return "Other";
}

export default async function GeoReportPage() {
  const all = await prisma.candidateCache.findMany({
    select: {
      workableJobId: true,
      country: true,
      city: true,
      brief: { select: { roleTitle: true } },
    },
  });

  const total = all.length;
  let caCount = 0;
  let usCount = 0;
  let otherCount = 0;

  for (const c of all) {
    const bucket = classifyCountry(c.country);
    if (bucket === "CA") caCount++;
    else if (bucket === "US") usCount++;
    else otherCount++;
  }

  // Per-job breakdown
  const jobMap: Record<string, { title: string; ca: number; us: number; other: number; total: number }> = {};
  for (const c of all) {
    if (!jobMap[c.workableJobId]) {
      jobMap[c.workableJobId] = {
        title: c.brief?.roleTitle ?? c.workableJobId,
        ca: 0,
        us: 0,
        other: 0,
        total: 0,
      };
    }
    const bucket = classifyCountry(c.country);
    const row = jobMap[c.workableJobId]!;
    row[bucket === "CA" ? "ca" : bucket === "US" ? "us" : "other"]++;
    row.total++;
  }

  // City breakdown — top 10
  const cityCount: Record<string, number> = {};
  for (const c of all) {
    if (c.city) {
      cityCount[c.city] = (cityCount[c.city] ?? 0) + 1;
    }
  }
  const topCities = Object.entries(cityCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const pct = (n: number) => (total > 0 ? `${Math.round((n / total) * 100)}%` : "—");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Geo Report</h1>
        <p className="text-sm text-gray-500 mt-1">Candidate locations across all cached pipeline data</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total candidates", value: total, sub: null },
          { label: "Canada", value: caCount, sub: pct(caCount) },
          { label: "United States", value: usCount, sub: pct(usCount) },
          { label: "Other / Unknown", value: otherCount, sub: pct(otherCount) },
        ].map(({ label, value, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-xs text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-semibold text-gray-900">{value}</p>
            {sub && <p className="text-xs text-gray-400 mt-0.5">{sub} of total</p>}
          </div>
        ))}
      </div>

      {/* Per-job table */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">By job posting</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">CA</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">US</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Other</th>
                <th className="text-right px-5 py-3 font-medium text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(jobMap)
                .sort((a, b) => b[1].total - a[1].total)
                .map(([jobId, row]) => (
                  <tr key={jobId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{row.title}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.ca}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.us}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{row.other}</td>
                    <td className="px-5 py-3 text-right font-medium text-gray-900">{row.total}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top cities */}
      {topCities.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-gray-900 mb-3">Top cities</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-5 py-3 font-medium text-gray-500">City</th>
                  <th className="text-right px-5 py-3 font-medium text-gray-500">Candidates</th>
                </tr>
              </thead>
              <tbody>
                {topCities.map(([city, count]) => (
                  <tr key={city} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-5 py-3 text-gray-900">{city}</td>
                    <td className="px-5 py-3 text-right text-gray-600">{count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
