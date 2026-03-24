import { authOptions } from "@/lib/auth/config";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { SessionProvider } from "@/components/shared/SessionProvider";
import { UserMenu } from "@/components/shared/UserMenu";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <span className="font-semibold text-gray-900">Level Hire</span>
            <div className="flex items-center gap-6 text-sm">
              <NavLink href="/dashboard">Dashboard</NavLink>
              <NavLink href="/briefs">Briefs</NavLink>
              <NavLink href="/postings">Active Postings</NavLink>
            </div>
          </div>
          <UserMenu user={session.user} />
        </nav>
        <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
      </div>
    </SessionProvider>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-gray-600 hover:text-gray-900 transition-colors">
      {children}
    </Link>
  );
}
