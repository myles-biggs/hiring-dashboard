"use client"

/**
 * LevelHireShellWrapper
 *
 * Client-side dynamic import of LevelHireShell to prevent SSR hydration
 * mismatches from PlatformShell's browser APIs (motion, ResizeObserver, etc.).
 */

import dynamic from "next/dynamic"
import type { ReactNode } from "react"

const Shell = dynamic(
  () => import("./LevelHireShell").then((m) => m.LevelHireShell),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    ),
  }
)

interface LevelHireShellWrapperProps {
  children: ReactNode
  user: {
    id: string
    name: string | null
    email: string
    image?: string | null
    role?: string
  }
  isAdmin: boolean
}

export function LevelHireShellWrapper({ children, user, isAdmin }: LevelHireShellWrapperProps) {
  return (
    <Shell user={user} isAdmin={isAdmin}>
      {children}
    </Shell>
  )
}
