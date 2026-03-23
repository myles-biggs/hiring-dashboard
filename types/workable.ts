export interface WorkableCandidate {
  id: string;
  name: string;
  firstname: string;
  lastname: string;
  email: string;
  headline: string;
  stage: WorkableStage;
  disqualified: boolean;
  disqualification_reason?: string;
  sourced: boolean;
  profile_url: string;
  job: WorkableJobRef;
  created_at: string;
  updated_at: string;
  resume_url?: string;
  linkedin_url?: string;
  cover_letter?: string;
  summary?: string;
  education_entries?: EducationEntry[];
  experience_entries?: ExperienceEntry[];
}

export interface WorkableStage {
  kind: string;
  name: string;
  position: number;
}

export interface WorkableJobRef {
  id: string;
  title: string;
  shortcode: string;
  url: string;
}

export interface WorkableJob {
  id: string;
  title: string;
  shortcode: string;
  state: "published" | "draft" | "closed" | "archived";
  department: string;
  url: string;
  application_url: string;
  shortlink: string;
  location: WorkableLocation;
  created_at: string;
  published_on?: string;
}

export interface WorkableLocation {
  location_str: string;
  country: string;
  country_code: string;
  region: string;
  region_code: string;
  city: string;
  zip_code: string;
  telecommuting: boolean;
}

export interface EducationEntry {
  school: string;
  degree: string;
  field_of_study: string;
  start_date: string;
  end_date?: string;
}

export interface ExperienceEntry {
  title: string;
  company: string;
  summary: string;
  start_date: string;
  end_date?: string;
  current: boolean;
}

export interface WorkableWebhookPayload {
  event_type: "candidate_created" | "candidate_updated" | "job_created" | "job_updated";
  data: {
    candidate?: WorkableCandidate;
    job?: WorkableJob;
  };
}
