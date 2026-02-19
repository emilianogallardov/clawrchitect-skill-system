"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { SkillCard } from "@/components/skill-card"
import { Skeleton } from "@/components/ui/skeleton"
import type { Skill } from "@/types"

export function BookmarkedSkills() {
  const { bookmarks } = useBookmarks()
  const [skills, setSkills] = useState<Skill[]>([])
  const [fetchedIds, setFetchedIds] = useState("")
  const abortRef = useRef<AbortController | null>(null)

  // Stable dependency based on bookmark IDs, not array identity
  const bookmarkIds = useMemo(
    () => bookmarks.map((b) => b.id).sort().join(","),
    [bookmarks]
  )

  // Derive loading: we have bookmarks but haven't fetched them yet
  const loading = bookmarkIds !== "" && bookmarkIds !== fetchedIds

  useEffect(() => {
    abortRef.current?.abort()

    if (bookmarks.length === 0) return

    const controller = new AbortController()
    abortRef.current = controller

    Promise.all(
      bookmarks.map(async (b) => {
        try {
          const res = await fetch(`/api/skills/${b.id}`, {
            signal: controller.signal,
          })
          if (!res.ok) return null
          const data = await res.json()
          return data.skill as Skill
        } catch {
          return null
        }
      })
    ).then((results) => {
      if (!controller.signal.aborted) {
        setSkills(results.filter((s): s is Skill => s !== null))
        setFetchedIds(bookmarkIds)
      }
    })

    return () => {
      controller.abort()
    }
  }, [bookmarkIds]) // eslint-disable-line react-hooks/exhaustive-deps

  if (bookmarks.length === 0) {
    return (
      <section>
        <h2 className="mb-4 font-mono text-lg font-bold uppercase text-brand">My Skills</h2>
        <p className="font-sans text-sm text-muted-foreground">
          Star skills to save them here
        </p>
      </section>
    )
  }

  if (loading) {
    return (
      <section>
        <h2 className="mb-4 font-mono text-lg font-bold uppercase text-brand">My Skills</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {bookmarks.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-card p-6 space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      </section>
    )
  }

  return (
    <section>
      <h2 className="mb-4 font-mono text-lg font-bold uppercase text-brand">My Skills</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </section>
  )
}
