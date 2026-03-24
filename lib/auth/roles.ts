import { Session } from "next-auth";
import { NextResponse } from "next/server";

// Defined here to avoid importing @prisma/client in client components
export type Role = "TALENT_ACQUISITION" | "HIRING_MANAGER" | "ADMIN";

export function hasRole(session: Session, ...roles: Role[]): boolean {
  return roles.includes(session.user.role as Role);
}

export function requireRole(session: Session | null, ...roles: Role[]): void {
  if (!session) {
    throw new AuthError(401, "Unauthorized");
  }
  if (!roles.includes(session.user.role as Role)) {
    throw new AuthError(403, "Forbidden");
  }
}

export function requireApprover(session: Session | null): void {
  if (!session?.user.isApprover && session?.user.role !== "ADMIN") {
    throw new AuthError(403, "Approver permission required");
  }
}

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
  }
}

export function handleAuthError(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

export const ROLE_LABELS: Record<Role, string> = {
  TALENT_ACQUISITION: "Talent Acquisition",
  HIRING_MANAGER: "Hiring Manager",
  ADMIN: "Admin",
};
