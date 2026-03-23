export interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  custom_fields: AsanaCustomField[];
  created_at: string;
  modified_at: string;
  completed: boolean;
  permalink_url: string;
}

export interface AsanaCustomField {
  gid: string;
  name: string;
  type: "text" | "number" | "enum" | "date" | "people";
  text_value?: string;
  number_value?: number;
  enum_value?: AsanaEnumOption;
  date_value?: { date: string };
}

export interface AsanaEnumOption {
  gid: string;
  name: string;
  color: string;
}

export interface AsanaWebhookEvent {
  events: AsanaEvent[];
}

export interface AsanaEvent {
  action: "changed" | "added" | "removed" | "deleted" | "undeleted";
  resource: {
    gid: string;
    resource_type: string;
  };
  change?: {
    field: string;
    action: string;
    new_value?: unknown;
    old_value?: unknown;
  };
}

export interface CreateAsanaTaskInput {
  name: string;
  notes?: string;
  custom_fields?: Record<string, string | number>;
  projects?: string[];
}
