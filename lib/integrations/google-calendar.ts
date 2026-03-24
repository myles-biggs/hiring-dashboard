import { google } from "googleapis";

function getCalendarClient() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return google.calendar({ version: "v3", auth });
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
