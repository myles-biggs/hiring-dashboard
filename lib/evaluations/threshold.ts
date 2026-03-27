type CVScore = "+" | "+/-" | "-";

export function calculateThreshold(data: {
  cvTruth: CVScore;
  cvResults: CVScore;
  cvBetterEveryDay: CVScore;
  cvNoEgo: CVScore;
  gwcGetsIt: boolean;
  gwcWantsIt: boolean;
  gwcCapacity: boolean;
  performance: string;
  futureReadiness: string;
}): boolean {
  const cvScores = [data.cvTruth, data.cvResults, data.cvBetterEveryDay, data.cvNoEgo];
  const plusCount = cvScores.filter((s) => s === "+").length;
  const minusCount = cvScores.filter((s) => s === "-").length;
  const cvPasses = plusCount >= 2 && minusCount === 0;

  const gwcPasses = data.gwcGetsIt && data.gwcWantsIt && data.gwcCapacity;

  const PERF_ORDER = ["UNDERPERFORMING", "INCONSISTENT", "STRONG", "OUTSTANDING"];
  const FUTURE_ORDER = ["RESISTANT", "STATIC", "FORWARD_LOOKING", "TRAILBLAZER"];
  const perfPasses = PERF_ORDER.indexOf(data.performance) >= PERF_ORDER.indexOf("STRONG");
  const futurePasses =
    FUTURE_ORDER.indexOf(data.futureReadiness) >= FUTURE_ORDER.indexOf("FORWARD_LOOKING");

  return cvPasses && gwcPasses && perfPasses && futurePasses;
}
