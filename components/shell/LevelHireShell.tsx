"use client"

/**
 * Level Hire Shell
 *
 * Wraps the app in LevelAppShell from @levelinteractive/ui.
 * Runs in standaloneMode because Level Hire uses its own NextAuth
 * session rather than the main dashboard JWT.
 */

import { LevelAppShell, type LevelAppShellProps } from "@levelinteractive/ui"
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  ClipboardCheck,
  Medal,
  BarChart2,
  Settings,
  PenLine,
} from "lucide-react"
import type { ReactNode } from "react"

const BASE_NAV_ITEMS: LevelAppShellProps["primaryNavItems"] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: <LayoutDashboard size={20} />,
    href: "/dashboard",
  },
  {
    id: "briefs",
    label: "Briefs",
    icon: <FileText size={20} />,
    href: "/briefs",
  },
  {
    id: "postings",
    label: "Active Postings",
    icon: <Briefcase size={20} />,
    href: "/postings",
  },
  {
    id: "evaluate",
    label: "Evaluate",
    icon: <ClipboardCheck size={20} />,
    href: "/evaluate",
  },
  {
    id: "silver-medalists",
    label: "Silver Medalists",
    icon: <Medal size={20} />,
    href: "/silver-medalists",
  },
  {
    id: "reports",
    label: "Reports",
    icon: <BarChart2 size={20} />,
    href: "/reports/hiring",
  },
]

const GENERATE_JOB_POST_NAV_ITEM: LevelAppShellProps["primaryNavItems"][number] = {
  id: "generate-job-post",
  label: "Generate Job Post",
  icon: <PenLine size={20} />,
  href: "/job-posts/new",
}

const ADMIN_NAV_ITEM: LevelAppShellProps["primaryNavItems"][number] = {
  id: "admin",
  label: "Admin",
  icon: <Settings size={20} />,
  href: "/admin/users",
}

interface LevelHireShellProps {
  children: ReactNode
  user: {
    id: string
    name: string | null
    email: string
    image?: string | null
    role?: string
  }
  isAdmin: boolean
  enableBriefFlow: boolean
}

export function LevelHireShell({ children, user, isAdmin, enableBriefFlow }: LevelHireShellProps) {
  const canGenerateJobPost =
    user.role === "TALENT_ACQUISITION" || user.role === "ADMIN"

  const navItems = [
    ...BASE_NAV_ITEMS.filter((item) => item.id !== "briefs" || enableBriefFlow),
    ...(canGenerateJobPost ? [GENERATE_JOB_POST_NAV_ITEM] : []),
    ...(isAdmin ? [ADMIN_NAV_ITEM] : []),
  ]

  return (
    <LevelAppShell
      moduleName="Level Hire"
      user={user}
      primaryNavItems={navItems}
      modulesWithSecondaryNav={[]}
      standaloneMode={true}
    >
      {children}
    </LevelAppShell>
  )
}
