import { ApprovalStatus } from "@prisma/client";

const CONFIG: Record<ApprovalStatus, { label: string; classes: string }> = {
  PENDING: { label: "Pending approval", classes: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  APPROVED: { label: "Approved", classes: "bg-green-50 text-green-700 border-green-200" },
  REJECTED: { label: "Rejected", classes: "bg-red-50 text-red-700 border-red-200" },
  ESCALATED: { label: "Escalated to Bill", classes: "bg-orange-50 text-orange-700 border-orange-200" },
};

export function ApprovalBadge({ status }: { status: ApprovalStatus }) {
  const { label, classes } = CONFIG[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${classes}`}>
      {label}
    </span>
  );
}
