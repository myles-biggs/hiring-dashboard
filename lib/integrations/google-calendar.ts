import { google, calendar_v3 } from "googleapis";

function getCalendarClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/gmail.send",
    ],
  });

  return google.calendar({ version: "v3", auth });
}

export interface ParsedInterviewEvent {
  candidateNameHint: string | null;
  interviewerEmails: string[];
  meetingLink: string | null;
}

/**
 * Extracts candidate name hint, interviewer emails, and meeting link from a
 * Google Calendar event. Recognises titles matching:
 *   "Interview - {Name}" or "{Name} Interview"
 */
export function parseInterviewEvent(
  event: calendar_v3.Schema$Event
): ParsedInterviewEvent {
  const title = event.summary ?? "";

  // Extract candidate name hint from common title patterns
  let candidateNameHint: string | null = null;
  const prefixMatch = /^Interview\s*[-–]\s*(.+)$/i.exec(title);
  const suffixMatch = /^(.+?)\s+Interview$/i.exec(title);
  if (prefixMatch) {
    candidateNameHint = prefixMatch[1]?.trim() ?? null;
  } else if (suffixMatch) {
    candidateNameHint = suffixMatch[1]?.trim() ?? null;
  }

  // Organizer email to exclude from interviewer list
  const organizerEmail = event.organizer?.email?.toLowerCase();

  const interviewerEmails = (event.attendees ?? [])
    .map((a) => a.email ?? "")
    .filter((e) => e && e.toLowerCase() !== organizerEmail);

  // Meet link
  const meetingLink =
    event.conferenceData?.entryPoints?.find(
      (ep) => ep.entryPointType === "video"
    )?.uri ?? null;

  return { candidateNameHint, interviewerEmails, meetingLink };
}

export interface ScheduleInterviewParams {
  candidateName: string;
  candidateEmail: string;
  interviewerEmails: string[];
  title: string;
  startIso: string; // ISO 8601
  durationMinutes: number;
  addMeet: boolean;
  description?: string;
}

export interface CalendarEventResult {
  eventId: string;
  htmlLink: string;
  meetLink?: string;
}

export async function scheduleInterview(
  params: ScheduleInterviewParams
): Promise<CalendarEventResult> {
  const calendar = getCalendarClient();
  const calendarId = process.env.GOOGLE_CALENDAR_ID ?? "primary";

  const start = new Date(params.startIso);
  const end = new Date(start.getTime() + params.durationMinutes * 60 * 1000);

  const attendees = [
    { email: params.candidateEmail, displayName: params.candidateName },
    ...params.interviewerEmails.map((e) => ({ email: e })),
  ];

  const event = {
    summary: params.title,
    description: params.description ?? undefined,
    start: { dateTime: start.toISOString(), timeZone: "America/New_York" },
    end: { dateTime: end.toISOString(), timeZone: "America/New_York" },
    attendees,
    reminders: {
      useDefault: false,
      overrides: [
        { method: "email", minutes: 24 * 60 },
        { method: "popup", minutes: 10 },
      ],
    },
    ...(params.addMeet
      ? {
          conferenceData: {
            createRequest: {
              requestId: `level-hire-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
  };

  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
    conferenceDataVersion: params.addMeet ? 1 : 0,
    sendUpdates: "all",
  });

  const data = response.data;
  return {
    eventId: data.id ?? "",
    htmlLink: data.htmlLink ?? "",
    meetLink: data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ?? undefined,
  };
}

const HIRING_CALENDAR_ID =
  process.env.GOOGLE_HIRING_CALENDAR_ID ??
  "c_ed1c45a8be1971c46b26e4db26edb9e7badf1a2747ed5eee08e1d0e934f19d31@group.calendar.google.com";

export interface HiringCalendarEvent {
  id: string;
  title: string;
  startIso: string;
  endIso: string;
  attendeeEmails: string[];
  meetLink: string | null;
  parsed: ParsedInterviewEvent;
}

export async function listHiringCalendarEvents(
  from: Date,
  to: Date
): Promise<HiringCalendarEvent[]> {
  const calendar = getCalendarClient();

  const res = await calendar.events.list({
    calendarId: HIRING_CALENDAR_ID,
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    singleEvents: true,
    maxResults: 500,
  });

  return (res.data.items ?? []).map((ev) => ({
    id: ev.id ?? "",
    title: ev.summary ?? "(no title)",
    startIso: ev.start?.dateTime ?? ev.start?.date ?? "",
    endIso: ev.end?.dateTime ?? ev.end?.date ?? "",
    attendeeEmails: (ev.attendees ?? []).map((a) => a.email ?? "").filter(Boolean),
    meetLink:
      ev.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video")
        ?.uri ?? null,
    parsed: parseInterviewEvent(ev),
  }));
}
