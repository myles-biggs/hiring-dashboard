"use server";

import { authOptions } from "@/lib/auth/config";
import { requireRole } from "@/lib/auth/roles";
import { disqualifyCandidate } from "@/lib/integrations/workable";
import type { DispositionAction } from "@/lib/schemas/disposition";
import { prisma } from "@/lib/utils/prisma";
import { DispositionStatus } from "@prisma/client";
import { getServerSession } from "next-auth";

export async function approveDisposition(
  dispositionId: string,
  notes?: string
): Promise<void> {
  const session = await getServerSession(authOptions);
  requireRole(session, "TALENT_ACQUISITION", "ADMIN");

  const disposition = await prisma.disposition.findUnique({
    where: { id: dispositionId },
    include: { candidate: true },
  });
  if (!disposition) throw new Error(`Disposition not found: ${dispositionId}`);

  await prisma.disposition.update({
    where: { id: dispositionId },
    data: {
      status: DispositionStatus.APPROVED,
      approvedBy: session!.user.email ?? undefined,
      approvedAt: new Date(),
      notes: notes ?? disposition.notes,
    },
  });

  if (disposition.recommendedAction === "DISQUALIFY") {
    try {
      await disqualifyCandidate(
        disposition.candidate.workableJobShortcode,
        disposition.candidate.workableCandidateId,
        "Does not meet minimum requirements for this role."
      );
      await prisma.disposition.update({
        where: { id: dispositionId },
        data: { workableUpdated: true },
      });
    } catch (err) {
      console.error("Workable disqualify failed:", err);
      await prisma.disposition.update({
        where: { id: dispositionId },
        data: {
          workableError: err instanceof Error ? err.message : "Unknown Workable error",
        },
      });
    }
  }
}

export async function overrideDisposition(
  dispositionId: string,
  newAction: DispositionAction,
  notes: string
): Promise<void> {
  const session = await getServerSession(authOptions);
  requireRole(session, "TALENT_ACQUISITION", "ADMIN");

  const disposition = await prisma.disposition.findUnique({
    where: { id: dispositionId },
    include: { candidate: true },
  });
  if (!disposition) throw new Error(`Disposition not found: ${dispositionId}`);

  await prisma.disposition.update({
    where: { id: dispositionId },
    data: {
      status: DispositionStatus.OVERRIDDEN,
      recommendedAction: newAction,
      notes,
      approvedBy: session!.user.email ?? undefined,
      approvedAt: new Date(),
    },
  });

  if (newAction === "DISQUALIFY") {
    try {
      await disqualifyCandidate(
        disposition.candidate.workableJobShortcode,
        disposition.candidate.workableCandidateId,
        notes
      );
      await prisma.disposition.update({
        where: { id: dispositionId },
        data: { workableUpdated: true },
      });
    } catch (err) {
      console.error("Workable disqualify failed on override:", err);
      await prisma.disposition.update({
        where: { id: dispositionId },
        data: {
          workableError: err instanceof Error ? err.message : "Unknown Workable error",
        },
      });
    }
  }
}
