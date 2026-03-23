"use client";

import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";

interface Props {
  roles: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RoleGate({ roles, children, fallback = null }: Props) {
  const { data: session } = useSession();
  if (!session) return null;
  if (!roles.includes(session.user.role)) return <>{fallback}</>;
  return <>{children}</>;
}
