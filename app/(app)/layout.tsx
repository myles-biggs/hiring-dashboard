import { authOptions } from "@/lib/auth/config"
import { getServerSession } from "next-auth"
import { redirect } from "next/navigation"
import { SessionProvider } from "@/components/shared/SessionProvider"
import { LevelHireShellWrapper } from "@/components/shell/LevelHireShellWrapper"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions)
  if (!session) redirect("/login")

  const user = {
    id: session.user.id,
    name: session.user.name ?? null,
    email: session.user.email,
    image: session.user.image ?? null,
    role: session.user.role,
  }

  return (
    <SessionProvider session={session}>
      <LevelHireShellWrapper user={user} isAdmin={session.user.role === "ADMIN"}>
        {children}
      </LevelHireShellWrapper>
    </SessionProvider>
  )
}
