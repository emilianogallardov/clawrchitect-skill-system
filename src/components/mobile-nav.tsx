"use client"

import { useState } from "react"
import Link from "next/link"

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-11 w-11 items-center justify-center text-[#a89e8e] transition-colors hover:text-primary"
        aria-label="Toggle navigation"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l12 12M16 4L4 16" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 5h14M3 10h14M3 15h14" />
          </svg>
        )}
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-14 border-b border-[#3a5040] bg-[#252e28] p-4">
          <nav className="flex flex-col gap-4">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="py-1 font-mono text-sm text-[#a89e8e] transition-colors hover:text-primary"
            >
              Home
            </Link>
            <Link
              href="/compare"
              onClick={() => setOpen(false)}
              className="py-1 font-mono text-sm text-[#a89e8e] transition-colors hover:text-primary"
            >
              Compare
            </Link>
          </nav>
        </div>
      )}
    </div>
  )
}
