import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/config";
import { prisma } from "@/lib/utils/prisma";
import { redirect } from "next/navigation";
import { UserTable } from "@/components/admin/UserTable";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, role: true, isApprover: true, createdAt: true },
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-900">User management</h1>
        <p className="text-sm text-gray-500 mt-1">{users.length} users</p>
      </div>
      <UserTable users={users} />
    </div>
  );
}
