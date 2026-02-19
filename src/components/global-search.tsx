"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { SkillSearchResult } from "@/types"

export function GlobalSearch() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SkillSearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setOpen(false)
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setOpen(true)

    try {
      const res = await fetch(
        `/api/skills/search?q=${encodeURIComponent(q.trim())}&limit=5`,
        { signal: controller.signal }
      )
      if (!res.ok) { setResults([]); return }
      const data = await res.json()
      setResults(data.results ?? [])
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return
      setResults([])
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }, [])

  const handleChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => search(value), 300)
    },
    [search]
  )

  const navigateTo = useCallback(
    (id: string) => {
      setOpen(false)
      setQuery("")
      setResults([])
      router.push(`/skills/${id}`)
    },
    [router]
  )

  // Close on outside click
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", onMouseDown)
    return () => document.removeEventListener("mousedown", onMouseDown)
  }, [])

  // Close on Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [])

  // Cleanup timers
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#7a7264]" />
        <Input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => { if (query.trim() && results.length > 0) setOpen(true) }}
          placeholder="Search skills..."
          className="h-8 w-full border-[#3a5040] bg-[#1e2820] pl-8 font-mono text-xs text-[#e4ded2] placeholder:text-[#7a7264] focus-visible:border-primary focus-visible:ring-primary/30 md:w-[260px]"
        />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-md border border-border bg-card shadow-lg md:w-[360px]">
          {loading && (
            <p className="px-3 py-2 font-mono text-xs text-muted-foreground">
              Searching...
            </p>
          )}

          {!loading && results.length === 0 && query.trim() && (
            <p className="px-3 py-2 font-mono text-xs text-muted-foreground">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}

          {!loading && results.length > 0 && (
            <ul>
              {results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => navigateTo(result.id)}
                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-primary/5 cursor-pointer"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-mono text-xs text-brand">
                        {result.name}
                      </p>
                      {result.description && (
                        <p className="truncate font-sans text-[10px] text-muted-foreground">
                          {result.description}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "shrink-0 text-[9px]",
                        result.category !== "uncategorized" && "border-primary/30 text-primary"
                      )}
                    >
                      {result.category.replace(/_/g, " ")}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
