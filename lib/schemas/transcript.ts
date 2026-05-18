import { z } from "zod";

// Zoom recording.transcript_completed webhook payload shape
export const zoomTranscriptWebhookSchema = z.object({
  event: z.literal("recording.transcript_completed"),
  payload: z.object({
    account_id: z.string(),
    object: z.object({
      uuid: z.string(),
      id: z.string(),
      host_email: z.string().email(),
      topic: z.string(),
      start_time: z.string(),
      duration: z.number(),
      recording_files: z.array(
        z.object({
          id: z.string().optional(),
          file_type: z.string(),
          download_url: z.string().url(),
          status: z.string(),
        })
      ),
    }),
  }),
});

export type ZoomTranscriptWebhook = z.infer<typeof zoomTranscriptWebhookSchema>;

// Transcript ingestion input
export const transcriptIngestionSchema = z.object({
  zoomMeetingId: z.string().min(1),
  zoomRecordingId: z.string().optional(),
  transcriptText: z.string().min(1),
  meetingDate: z.coerce.date(),
  interviewerEmails: z.array(z.string().email()),
  matchMethod: z.string().min(1),
  candidateId: z.string().min(1),
});

export type TranscriptIngestionInput = z.infer<typeof transcriptIngestionSchema>;
