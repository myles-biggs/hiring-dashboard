import { z } from "zod";

export const dispositionActionSchema = z.enum([
  "ADVANCE",
  "SCHEDULE_INTERVIEW",
  "PANEL_REVIEW",
  "SECOND_OPINION",
  "HOLD",
  "DISQUALIFY",
]);

export type DispositionAction = z.infer<typeof dispositionActionSchema>;

export const dispositionStatusSchema = z.enum([
  "RECOMMENDED",
  "APPROVED",
  "OVERRIDDEN",
]);

export type DispositionStatus = z.infer<typeof dispositionStatusSchema>;

export const approvalInputSchema = z.object({
  dispositionId: z.string().min(1),
  action: dispositionActionSchema,
  notes: z.string().optional(),
});

export type ApprovalInput = z.infer<typeof approvalInputSchema>;
