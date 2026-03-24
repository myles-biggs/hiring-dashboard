"use client";
import { useState } from "react";

type UserRow = {
  id: string;
  name: string | null;
  email: string;
  role: "HIRING_MANAGER" | "TALENT_ACQUISITION" | "ADMIN";
  isApprover: boolean;
  createdAt: Date;
};

const ROLE_LABELS: Record<string, string> = {
  HIRING_MANAGER: "Hiring Manager",
  TALENT_ACQUISITION: "Talent Acquisition",
  ADMIN: "Admin",
};

export function UserTable({ users: initialUsers }: { users: UserRow[] }) {
  const [users, setUsers] = useState(initialUsers);
  const [saving, setSaving] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function update(id: string, patch: { role?: string; isApprover?: boolean }) {
    setSaving(id);
    setErrors((prev) => ({ ...prev, [id]: "" }));

    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });

    setSaving(null);

    if (!res.ok) {
      const d = await res.json();
      setErrors((prev) => ({ ...prev, [id]: d.error ?? "Save failed" }));
      return;
    }

    setUsers((prev) =>
      prev.map((u) =>
        u.id === id ? { ...u, ...patch, role: (patch.role as UserRow["role"]) ?? u.role } : u
      )
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="text-left px-5 py-3 font-medium text-gray-500">User</th>
            <th className="text-left px-5 py-3 font-medium text-gray-500">Role</th>
            <th className="text-left px-5 py-3 font-medium text-gray-500">Approver</th>
            <th className="text-left px-5 py-3 font-medium text-gray-500">Joined</th>
            <th className="px-5 py-3" />
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-b border-gray-100 last:border-0">
              <td className="px-5 py-3">
                <p className="font-medium text-gray-900">{user.name ?? "—"}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </td>
              <td className="px-5 py-3">
                <select
                  value={user.role}
                  onChange={(e) => update(user.id, { role: e.target.value })}
                  disabled={saving === user.id}
                  className="border border-gray-300 rounded-md px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
                >
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </td>
              <td className="px-5 py-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={user.isApprover}
                    onChange={(e) => update(user.id, { isApprover: e.target.checked })}
                    disabled={saving === user.id}
                    className="rounded border-gray-300 disabled:opacity-50"
                  />
                  <span className="text-xs text-gray-600">Can approve</span>
                </label>
              </td>
              <td className="px-5 py-3 text-xs text-gray-400">
                {new Date(user.createdAt).toLocaleDateString("en-CA")}
              </td>
              <td className="px-5 py-3 text-xs">
                {saving === user.id && <span className="text-gray-400">Saving...</span>}
                {errors[user.id] && <span className="text-red-500">{errors[user.id]}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
