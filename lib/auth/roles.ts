import { Role } from "@prisma/client";
import { Session } from "next-auth";
import { NextResponse } from "next/server";

export { Role };

export function hasRole(session: Session, ...roles: Role[]): boolean {
  return roles.includes(session.user.role);
}

export function requireRole(session: Session | null, ...roles: Role[]): void {
  if (!session) {
    throw new AuthError(401, "Unauthorized");
  }
  if (!roles.includes(session.user.role)) {
    throw new AuthError(403, "Forbidden");
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
  HR: "HR / People Ops",
  HIRING_MANAGER: "Hiring Manager",
  APPROVER: "Approver",
  ADMIN: "Admin",
};
