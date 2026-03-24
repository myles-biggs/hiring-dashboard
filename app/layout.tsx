import type { Metadata, Viewport } from "next"
import { Inter_Tight, DM_Sans } from "next/font/google"
import "./globals.css"

// Level Agency Brand Typography
const interTight = Inter_Tight({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-heading",
  weight: ["400", "500", "600", "700", "800", "900"],
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
})

export const metadata: Metadata = {
  title: {
    default: "Level Hire",
    template: "%s | Level Hire",
  },
  description: "Internal hiring platform for Level Agency",
  robots: {
    index: false,
    follow: false,
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

// Force dynamic rendering since we use cookies for authentication
export const dynamic = "force-dynamic"

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${interTight.variable} ${dmSans.variable}`}>
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  )
}
