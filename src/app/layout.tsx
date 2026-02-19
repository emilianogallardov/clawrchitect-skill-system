import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import Link from "next/link"
import "./globals.css"
import { MobileNav } from "@/components/mobile-nav"
import { GlobalSearch } from "@/components/global-search"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: "ClawCamp - OpenClaw Skill Intelligence",
  description: "Discover, search, and compare OpenClaw skills with vector-embedded intelligence powered by AIDB.",
  openGraph: {
    title: 'ClawCamp — OpenClaw Skill Intelligence',
    description: 'Search, compare, and discover OpenClaw skills with vector-powered intelligence. Connected to AIDB learning resources.',
    url: 'https://clawcamp.vercel.app',
    siteName: 'ClawCamp',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ClawCamp — OpenClaw Skill Intelligence',
    description: 'Search, compare, and discover OpenClaw skills with vector-powered intelligence.',
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}
      >
        <header className="sticky top-0 z-50 border-b border-[#3a5040] bg-[#252e28]">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
            <Link href="/" className="font-mono text-xl font-bold tracking-wider">
              <span className="text-[#e4ded2]">CLAW</span>
              <span className="text-primary">CAMP</span>
            </Link>
            <nav className="hidden items-center gap-6 md:flex">
              <Link
                href="/"
                className="font-mono text-sm text-[#a89e8e] transition-colors hover:text-primary"
              >
                Home
              </Link>
              <GlobalSearch />
              <Link
                href="/compare"
                className="font-mono text-sm text-[#a89e8e] transition-colors hover:text-primary"
              >
                Compare
              </Link>
            </nav>
            <MobileNav />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 sm:flex-row">
            <p className="font-mono text-xs text-muted-foreground">
              Powered by{" "}
              <a
                href="https://aidailybrief.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                AIDB
              </a>
            </p>
            <a
              href="https://aidailybrief.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              Learn More
            </a>
          </div>
        </footer>
      </body>
    </html>
  )
}
