const ZOOM_BASE_URL = "https://api.zoom.us/v2";

interface TokenCache {
  token: string;
  expiresAt: number;
}

let _tokenCache: TokenCache | null = null;

export async function getAccessToken(): Promise<string> {
  if (_tokenCache && Date.now() < _tokenCache.expiresAt) {
    return _tokenCache.token;
  }

  const accountId = process.env.ZOOM_ACCOUNT_ID;
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;

  if (!accountId || !clientId || !clientSecret) {
    throw new Error("ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET must be set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${accountId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom OAuth error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  // Subtract 60s buffer to avoid using an expiring token
  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return _tokenCache.token;
}

async function zoomFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();

  const res = await fetch(`${ZOOM_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zoom API error ${res.status} for ${path}: ${body}`);
  }

  return res.json() as Promise<T>;
}

export interface ZoomMeeting {
  id: string;
  topic: string;
  start_time: string;
  host_email: string;
  duration: number;
}

export async function getMeetingDetails(meetingId: string): Promise<ZoomMeeting> {
  return zoomFetch<ZoomMeeting>(`/meetings/${meetingId}`);
}

function stripVttFormatting(vtt: string): string {
  return vtt
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      // Remove WEBVTT header, timestamp lines, blank lines, and NOTE lines
      if (trimmed === "WEBVTT") return false;
      if (trimmed === "") return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) return false;
      if (/^NOTE/.test(trimmed)) return false;
      if (/^\d+$/.test(trimmed)) return false;
      return true;
    })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function getTranscript(recordingFileId: string): Promise<string> {
  const token = await getAccessToken();

  // The download URL pattern for Zoom transcript files
  const downloadUrl = `https://api.zoom.us/v2/meetings/${recordingFileId}/recordings`;
  const res = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    throw new Error(`Zoom transcript download error ${res.status} for file ${recordingFileId}`);
  }

  const vtt = await res.text();
  return stripVttFormatting(vtt);
}

interface ZoomParticipant {
  user_email: string;
  name: string;
}

interface ZoomParticipantsResponse {
  participants: ZoomParticipant[];
}

export async function getMeetingParticipants(meetingId: string): Promise<string[]> {
  const data = await zoomFetch<ZoomParticipantsResponse>(
    `/report/meetings/${meetingId}/participants`
  );
  return data.participants
    .map((p) => p.user_email)
    .filter((email): email is string => Boolean(email));
}
