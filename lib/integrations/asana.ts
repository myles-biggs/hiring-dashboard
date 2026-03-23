import { AsanaTask, CreateAsanaTaskInput } from "@/types/asana";

const BASE_URL = "https://app.asana.com/api/1.0";

const FIELD_GIDS = {
  roleTitle: process.env.ASANA_FIELD_ROLE_TITLE!,
  department: process.env.ASANA_FIELD_DEPARTMENT!,
  hiringManager: process.env.ASANA_FIELD_HIRING_MANAGER!,
  employmentType: process.env.ASANA_FIELD_EMPLOYMENT_TYPE!,
  salaryMin: process.env.ASANA_FIELD_SALARY_MIN!,
  salaryMax: process.env.ASANA_FIELD_SALARY_MAX!,
  yearsExperience: process.env.ASANA_FIELD_YEARS_EXPERIENCE!,
  reportingStructure: process.env.ASANA_FIELD_REPORTING_STRUCTURE!,
  targetStartDate: process.env.ASANA_FIELD_TARGET_START_DATE!,
  approvalStatus: process.env.ASANA_FIELD_APPROVAL_STATUS!,
  approverName: process.env.ASANA_FIELD_APPROVER_NAME!,
  approvedAt: process.env.ASANA_FIELD_APPROVED_AT!,
  workableJobId: process.env.ASANA_FIELD_WORKABLE_JOB_ID!,
};

async function asanaFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.ASANA_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Asana API error ${res.status}: ${body}`);
  }

  const json = await res.json();
  return json.data as T;
}

export interface BriefFieldValues {
  roleTitle: string;
  department: string;
  hiringManagerEmail: string;
  employmentType: string;
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  yearsExperience: string;
  reportingStructure: string;
  targetStartDate?: string;
}

export async function createBriefTask(
  briefId: string,
  fields: BriefFieldValues
): Promise<AsanaTask> {
  const customFields: Record<string, string | number> = {};

  if (FIELD_GIDS.roleTitle) customFields[FIELD_GIDS.roleTitle] = fields.roleTitle;
  if (FIELD_GIDS.department) customFields[FIELD_GIDS.department] = fields.department;
  if (FIELD_GIDS.hiringManager) customFields[FIELD_GIDS.hiringManager] = fields.hiringManagerEmail;
  if (FIELD_GIDS.employmentType) customFields[FIELD_GIDS.employmentType] = fields.employmentType;
  if (FIELD_GIDS.salaryMin && fields.salaryRangeMin) customFields[FIELD_GIDS.salaryMin] = fields.salaryRangeMin;
  if (FIELD_GIDS.salaryMax && fields.salaryRangeMax) customFields[FIELD_GIDS.salaryMax] = fields.salaryRangeMax;
  if (FIELD_GIDS.yearsExperience) customFields[FIELD_GIDS.yearsExperience] = fields.yearsExperience;
  if (FIELD_GIDS.reportingStructure) customFields[FIELD_GIDS.reportingStructure] = fields.reportingStructure;
  if (FIELD_GIDS.targetStartDate && fields.targetStartDate) customFields[FIELD_GIDS.targetStartDate] = fields.targetStartDate;
  if (FIELD_GIDS.approvalStatus) customFields[FIELD_GIDS.approvalStatus] = "Pending";

  const input: CreateAsanaTaskInput = {
    name: `[Hiring Brief] ${fields.roleTitle}`,
    notes: `Level Hire brief ID: ${briefId}\nDepartment: ${fields.department}\nHiring Manager: ${fields.hiringManagerEmail}`,
    projects: [process.env.ASANA_PROJECT_ID!],
    custom_fields: customFields,
  };

  return asanaFetch<AsanaTask>("/tasks", {
    method: "POST",
    body: JSON.stringify({ data: input }),
  });
}

export async function getTask(taskGid: string): Promise<AsanaTask> {
  return asanaFetch<AsanaTask>(
    `/tasks/${taskGid}?opt_fields=gid,name,notes,custom_fields,created_at,modified_at,completed,permalink_url`
  );
}

export async function updateApprovalStatus(
  taskGid: string,
  status: "Approved" | "Rejected" | "Escalated",
  approverName: string
): Promise<void> {
  const customFields: Record<string, string> = {};

  if (FIELD_GIDS.approvalStatus) customFields[FIELD_GIDS.approvalStatus] = status;
  if (FIELD_GIDS.approverName) customFields[FIELD_GIDS.approverName] = approverName;
  if (FIELD_GIDS.approvedAt) customFields[FIELD_GIDS.approvedAt] = new Date().toISOString().split("T")[0];

  await asanaFetch(`/tasks/${taskGid}`, {
    method: "PUT",
    body: JSON.stringify({ data: { custom_fields: customFields } }),
  });
}

export async function updateWorkableJobId(
  taskGid: string,
  workableJobId: string
): Promise<void> {
  if (!FIELD_GIDS.workableJobId) return;

  await asanaFetch(`/tasks/${taskGid}`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        custom_fields: { [FIELD_GIDS.workableJobId]: workableJobId },
      },
    }),
  });
}

export async function registerWebhook(targetUrl: string): Promise<void> {
  await asanaFetch("/webhooks", {
    method: "POST",
    body: JSON.stringify({
      data: {
        resource: process.env.ASANA_PROJECT_ID,
        target: targetUrl,
        filters: [
          {
            resource_type: "task",
            action: "changed",
            fields: ["custom_fields"],
          },
        ],
      },
    }),
  });
}
