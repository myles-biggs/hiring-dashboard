import { z } from "zod";

export const dispositionActionSchema = z.enum(["ADVANCE", "HOLD", "DISQUALIFY"]);

export type DispositionAction = z.infer<typeof dispositionActionSchema>;
