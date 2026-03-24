import { AsanaTask, CreateAsanaTaskInput } from "@/types/asana";

const BASE_URL = "https://app.asana.com/api/1.0";

export const ASANA_PROJECT_ID = "1203510595037020";
export const ASANA_WORKSPACE_ID = "17858393614543";

// Custom field GIDs — mapped from Hiring Pipeline project
export const FIELD_GIDS = {
  roleType:        "1209235075530974", // enum: Existing Role | New Role
  hiringStage:     "1209235075533107", // enum: pipeline stages
  roleTitle:       "1213780476746030",
  department:      "1213780476746032",
  hiringManager:   "1213780476746034",
  employmentType:  "1213780476746036", // enum: Full Time | Part Time
  salaryMin:       "1213780476746040",
  salaryMax:       "1213780476746042",
  yearsExperience: "1213780476746044",
  targetStartDate: "1213780476746046",
  approvalStatus:  "1213780476746048", // enum: approved | pending | rejected
  approverName:    "1213780476746053",
  approvedAt:      "1213780476746055",
  workableJobId:   "1213780476746057",
  hardSkills:      "1213780476746059",
  softSkills:      "1213779786972252",
  roleSummary:     "1213779786972254",
} as const;

// Enum option GIDs
export const ENUM_OPTIONS = {
  roleType: {
    existingRole: "1209235075530975",
    newRole:      "1209235075530976",
  },
  hiringStage: {
    intake:              "1209235075533108",
    proactiveSourcing:   "1209235075533109",
    newRoleRequest:      "1209235075533110",
    approvedToPost:      "1209235075533111",
    resumeScreen:        "1209235075533112",
    initialInterview:    "1209235075533113",
    smeInterview:        "1209235075533114",
    assessment:          "1209235075533115",
    assessmentReview:    "1209235075533116",
    executiveInterview:  "1209235075533117",
    offersMade:          "1209235075533118",
    hired:               "1209235075533119",
    pausedClosed:        "1209235075533120",
  },
  employmentType: {
    fullTime:  "1213780476746037",
    partTime:  "1213780476746038",
  },
  approvalStatus: {
    approved: "1213780476746049",
    pending:  "1213780476746050",
    rejected: "1213780476746051",
  },
} as const;

async function asanaFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
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

  return (await res.json()).data as T;
}

export interface BriefFieldValues {
  roleTitle:        string;
  department:       string;
  hiringManager:    string;
  employmentType:   "Full Time" | "Part Time";
  roleType:         "Existing Role" | "New Role";
  salaryRangeMin?:  number;
  salaryRangeMax?:  number;
  yearsExperience?: number;
  targetStartDate?: string; // YYYY-MM-DD
  hardSkills?:      string;
  softSkills?:      string;
  roleSummary?:     string;
}

export async function createBriefTask(briefId: string, fields: BriefFieldValues): Promise<AsanaTask> {
  const customFields: Record<string, string | number> = {
    [FIELD_GIDS.roleTitle]:       fields.roleTitle,
    [FIELD_GIDS.department]:      fields.department,
    [FIELD_GIDS.hiringManager]:   fields.hiringManager,
    [FIELD_GIDS.employmentType]:  fields.employmentType === "Full Time"
      ? ENUM_OPTIONS.employmentType.fullTime
      : ENUM_OPTIONS.employmentType.partTime,
    [FIELD_GIDS.roleType]:        fields.roleType === "Existing Role"
      ? ENUM_OPTIONS.roleType.existingRole
      : ENUM_OPTIONS.roleType.newRole,
    [FIELD_GIDS.approvalStatus]:  ENUM_OPTIONS.approvalStatus.pending,
    [FIELD_GIDS.hiringStage]:     ENUM_OPTIONS.hiringStage.newRoleRequest,
  };

  if (fields.salaryRangeMin != null) customFields[FIELD_GIDS.salaryMin] = fields.salaryRangeMin;
  if (fields.salaryRangeMax != null) customFields[FIELD_GIDS.salaryMax] = fields.salaryRangeMax;
  if (fields.yearsExperience != null) customFields[FIELD_GIDS.yearsExperience] = fields.yearsExperience;
  if (fields.targetStartDate) customFields[FIELD_GIDS.targetStartDate] = fields.targetStartDate;
  if (fields.hardSkills) customFields[FIELD_GIDS.hardSkills] = fields.hardSkills;
  if (fields.softSkills) customFields[FIELD_GIDS.softSkills] = fields.softSkills;
  if (fields.roleSummary) customFields[FIELD_GIDS.roleSummary] = fields.roleSummary;

  const input: CreateAsanaTaskInput = {
    name: `[Hiring Brief] ${fields.roleTitle}`,
    notes: `Level Hire brief ID: ${briefId}\nDepartment: ${fields.department}\nHiring Manager: ${fields.hiringManager}`,
    projects: [ASANA_PROJECT_ID],
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
  status: "approved" | "rejected",
  approverName: string
): Promise<void> {
  await asanaFetch(`/tasks/${taskGid}`, {
    method: "PUT",
    body: JSON.stringify({
      data: {
        custom_fields: {
          [FIELD_GIDS.approvalStatus]: status === "approved"
            ? ENUM_OPTIONS.approvalStatus.approved
            : ENUM_OPTIONS.approvalStatus.rejected,
          [FIELD_GIDS.approverName]: approverName,
          [FIELD_GIDS.approvedAt]: new Date().toISOString().split("T")[0],
          [FIELD_GIDS.hiringStage]: status === "approved"
            ? ENUM_OPTIONS.hiringStage.approvedToPost
            : ENUM_OPTIONS.hiringStage.pausedClosed,
        },
      },
    }),
  });
}

export async function updateWorkableJobId(taskGid: string, workableJobId: string): Promise<void> {
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
        resource: ASANA_PROJECT_ID,
        target: targetUrl,
        filters: [
          { resource_type: "task", action: "changed", fields: ["custom_fields"] },
        ],
      },
    }),
  });
}
