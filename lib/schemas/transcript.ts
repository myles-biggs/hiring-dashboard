import { z } from "zod";

export const zoomRecordingFileSchema = z.object({
  id: z.string(),
  file_type: z.string(),
  download_url: z.string(),
  recording_start: z.string(),
});

export const zoomTranscriptCompletedPayloadSchema = z.object({
  event: z.literal("recording.transcript_completed"),
  payload: z.object({
    object: z.object({
      id: z.union([z.string(), z.number()]).transform(String),
      topic: z.string(),
      start_time: z.string(),
      host_email: z.string(),
      recording_files: z.array(zoomRecordingFileSchema),
    }),
  }),
});

export type ZoomTranscriptCompletedPayload = z.infer<
  typeof zoomTranscriptCompletedPayloadSchema
>;
