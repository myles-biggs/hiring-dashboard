"use client";

import { signOut } from "next-auth/react";
import { ROLE_LABELS, Role } from "@/lib/auth/roles";

interface Props {
  user: {
    name?: string | null;
    email: string;
    role: Role;
  };
}

export function UserMenu({ user }: Props) {
  return (
    <div className="flex items-center gap-4">
      <div className="text-right">
        <p className="text-sm font-medium text-gray-900">{user.name ?? user.email}</p>
        <p className="text-xs text-gray-500">{ROLE_LABELS[user.role]}</p>
      </div>
      <button
        onClick={() => signOut({ callbackUrl: "/login" })}
        className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        Sign out
      </button>
    </div>
  );
}
