"use client"

import { useSearchParams, useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { AidbContentLink } from "@/components/aidb-content-link"
import type { SkillComparison, SkillSearchResult } from "@/types"

interface SelectedSkill {
  id: string
  name: string
}

function CompareContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const idsParam = searchParams.get("ids") ?? ""

  // Skill picker state
  const [selectedSkills, setSelectedSkills] = useState<SelectedSkill[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SkillSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  // Comparison state
  const [comparison, setComparison] = useState<SkillComparison | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initializedRef = useRef(false)

  // Pre-load skills from URL params on mount
  useEffect(() => {
    if (initializedRef.current || !idsParam) return
    initializedRef.current = true

    const ids = idsParam.split(",").filter(Boolean)
    if (ids.length === 0) return

    Promise.all(
      ids.map(async (id) => {
        try {
          const res = await fetch(`/api/skills/${id}`)
          if (!res.ok) return null
          const data = await res.json()
          return { id: data.skill.id, name: data.skill.name } as SelectedSkill
        } catch {
          return null
        }
      })
    ).then((results) => {
      const valid = results.filter((r): r is SelectedSkill => r !== null)
      if (valid.length > 0) {
        setSelectedSkills(valid)
      }
    })
  }, [idsParam])

  // Fetch comparison when 2+ skills are selected
  const fetchComparison = useCallback(async (skills: SelectedSkill[]) => {
    if (skills.length < 2) {
      setComparison(null)
      return
    }

    setCompareLoading(true)
    setError(null)
    try {
      const ids = skills.map((s) => s.id).join(",")
      const res = await fetch(`/api/skills/compare?ids=${encodeURIComponent(ids)}`)
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? "Failed to compare skills")
        setComparison(null)
        return
      }
      const data: SkillComparison = await res.json()
      setComparison(data)
    } catch {
      setError("Failed to compare skills. Please try again.")
      setComparison(null)
    } finally {
      setCompareLoading(false)
    }
  }, [])

  // Update URL and trigger comparison when selected skills change
  useEffect(() => {
    if (!initializedRef.current && idsParam) return // Wait for pre-load

    const ids = selectedSkills.map((s) => s.id).join(",")
    const currentIds = searchParams.get("ids") ?? ""
    if (ids !== currentIds) {
      router.replace(ids ? `/compare?ids=${ids}` : "/compare")
    }

    fetchComparison(selectedSkills)
  }, [selectedSkills, fetchComparison, router, searchParams, idsParam])

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)

    if (!value.trim()) {
      setSearchResults([])
      setShowDropdown(false)
      return
    }

    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const res = await fetch(`/api/skills/search?q=${encodeURIComponent(value)}&limit=5`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data.results ?? [])
          setShowDropdown(true)
        }
      } catch {
        // Silent fail for search
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }

  const addSkill = (skill: SkillSearchResult) => {
    if (selectedSkills.length >= 5) return
    if (selectedSkills.some((s) => s.id === skill.id)) return
    setSelectedSkills((prev) => [...prev, { id: skill.id, name: skill.name }])
    setSearchQuery("")
    setSearchResults([])
    setShowDropdown(false)
  }

  const removeSkill = (id: string) => {
    setSelectedSkills((prev) => prev.filter((s) => s.id !== id))
  }

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [])

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  // Get average similarity across the matrix
  const avgSimilarity = comparison
    ? (() => {
        const values = Object.values(comparison.similarity_matrix)
        if (values.length === 0) return 0
        return values.reduce((a, b) => a + b, 0) / values.length
      })()
    : 0

  return (
    <div className="space-y-8">
      <div className="space-y-2 pt-4">
        <h1 className="font-mono text-2xl font-bold text-primary">Compare Skills</h1>
        <p className="font-sans text-sm text-muted-foreground">
          Search and select 2-5 skills to compare
        </p>
      </div>

      {/* Skill Search + Selected Chips */}
      <div className="max-w-2xl space-y-3">
        {/* Selected Chips */}
        {selectedSkills.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedSkills.map((skill) => (
              <Badge
                key={skill.id}
                variant="secondary"
                className="gap-1.5 py-1 pl-3 pr-2 font-mono text-xs"
              >
                {skill.name}
                <button
                  onClick={() => removeSkill(skill.id)}
                  className="ml-1 rounded-full p-1 hover:bg-destructive/20 hover:text-destructive"
                  aria-label={`Remove ${skill.name}`}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Search Input with Dropdown */}
        <div ref={dropdownRef} className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true)
            }}
            placeholder={
              selectedSkills.length >= 5
                ? "Maximum 5 skills selected"
                : "Search skills to compare..."
            }
            disabled={selectedSkills.length >= 5}
            className="h-11 bg-card pl-10 font-mono text-base text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30 md:text-sm"
          />

          {/* Search Results Dropdown */}
          {showDropdown && (searchResults.length > 0 || searchLoading) && (
            <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
              {searchLoading && searchResults.length === 0 && (
                <div className="px-4 py-3">
                  <p className="font-mono text-xs text-muted-foreground">Searching...</p>
                </div>
              )}
              {searchResults.map((result) => {
                const alreadySelected = selectedSkills.some((s) => s.id === result.id)
                return (
                  <button
                    key={result.id}
                    onClick={() => !alreadySelected && addSkill(result)}
                    disabled={alreadySelected}
                    className="flex w-full flex-col gap-0.5 px-4 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg hover:bg-primary/10 disabled:opacity-40"
                  >
                    <span className="font-mono text-sm text-primary">
                      {result.name}
                      {alreadySelected && (
                        <span className="ml-2 text-[10px] text-muted-foreground">(selected)</span>
                      )}
                    </span>
                    {result.description && (
                      <span className="line-clamp-1 font-sans text-xs text-muted-foreground">
                        {result.description}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {compareLoading && (
        <div className="space-y-6">
          <Skeleton className="mx-auto h-20 w-40 rounded-xl" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      )}

      {/* Error */}
      {!compareLoading && error && (
        <div className="flex flex-col items-center gap-2 pt-12 text-center">
          <p className="font-mono text-sm text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!compareLoading && !error && !comparison && (
        <div className="flex flex-col items-center gap-2 pt-16 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            {selectedSkills.length === 0
              ? "Search and select skills to compare"
              : "Select at least 2 skills to compare"}
          </p>
          <p className="font-sans text-xs text-muted-foreground">
            {selectedSkills.length === 0
              ? "Use the search bar above to find skills"
              : `${selectedSkills.length} of 2-5 skills selected`}
          </p>
        </div>
      )}

      {/* Comparison Results */}
      {!compareLoading && comparison && (
        <div className="space-y-8">
          {/* Similarity Score */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary/40 sm:h-24 sm:w-24">
              <span className="font-mono text-xl font-bold text-primary sm:text-2xl">
                {Math.round(avgSimilarity * 100)}%
              </span>
            </div>
            <p className="font-mono text-xs text-muted-foreground">Overall Similarity</p>
          </div>

          {/* Side-by-side Skills */}
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div
            className="grid gap-4"
            style={{
              gridTemplateColumns: `repeat(${comparison.skills.length}, minmax(260px, 1fr))`,
              minWidth: comparison.skills.length > 2 ? `${comparison.skills.length * 280}px` : undefined,
            }}
          >
            {comparison.skills.map((skill) => (
              <Card key={skill.id} className="bg-card overflow-hidden">
                <CardHeader>
                  <CardTitle className="font-mono text-sm text-primary">
                    {skill.name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-xs">
                  {/* Description */}
                  <div>
                    <p className="mb-1 font-mono text-muted-foreground">Description</p>
                    <p className="font-sans text-foreground">
                      {skill.description ?? "No description"}
                    </p>
                  </div>

                  {/* Tools */}
                  <div>
                    <p className="mb-1 font-mono text-muted-foreground">Tools</p>
                    <div className="flex flex-wrap gap-1">
                      {skill.tools_used.length > 0 ? (
                        skill.tools_used.map((tool) => (
                          <Badge
                            key={tool}
                            variant={
                              comparison.shared_tools.includes(tool)
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {tool}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>

                  {/* Triggers */}
                  <div>
                    <p className="mb-1 font-mono text-muted-foreground">Triggers</p>
                    <div className="flex flex-wrap gap-1">
                      {skill.triggers.length > 0 ? (
                        skill.triggers.map((trigger) => (
                          <Badge
                            key={trigger}
                            variant={
                              comparison.shared_triggers.includes(trigger)
                                ? "default"
                                : "secondary"
                            }
                            className="text-[10px]"
                          >
                            {trigger}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-muted-foreground">None</span>
                      )}
                    </div>
                  </div>

                  {/* Author */}
                  <div>
                    <p className="mb-1 font-mono text-muted-foreground">Author</p>
                    <p className="font-sans text-foreground">
                      {skill.author ?? "Unknown"}
                    </p>
                  </div>

                  {/* First Seen */}
                  <div>
                    <p className="mb-1 font-mono text-muted-foreground">First Seen</p>
                    <p className="font-mono text-foreground">
                      {new Date(skill.first_seen_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </p>
                  </div>

                  {/* Source */}
                  {skill.source_url && /^https?:\/\//i.test(skill.source_url) && (
                    <div>
                      <p className="mb-1 font-mono text-muted-foreground">Source</p>
                      <a
                        href={skill.source_url.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-primary hover:underline"
                      >
                        View SKILL.md
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </a>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
          </div>

          <Separator />

          {/* Shared Capabilities */}
          {(comparison.shared_tools.length > 0 ||
            comparison.shared_triggers.length > 0) && (
            <section className="space-y-3">
              <h2 className="font-mono text-sm text-primary">Shared Capabilities</h2>
              <div className="flex flex-wrap gap-2">
                {comparison.shared_tools.map((tool) => (
                  <Badge key={`tool-${tool}`} className="font-mono text-[10px]">
                    tool: {tool}
                  </Badge>
                ))}
                {comparison.shared_triggers.map((trigger) => (
                  <Badge key={`trigger-${trigger}`} className="font-mono text-[10px]">
                    trigger: {trigger}
                  </Badge>
                ))}
              </div>
            </section>
          )}

          {/* Unique Features */}
          <section className="space-y-3">
            <h2 className="font-mono text-sm text-foreground">Unique Features</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {comparison.skills.map((skill) => {
                const unique = comparison.unique_features[skill.id]
                if (
                  !unique ||
                  (unique.unique_tools.length === 0 &&
                    unique.unique_triggers.length === 0)
                )
                  return null
                return (
                  <div key={skill.id} className="space-y-2">
                    <h3 className="font-mono text-xs text-primary">{skill.name}</h3>
                    <div className="flex flex-wrap gap-1.5">
                      {unique.unique_tools.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                      {unique.unique_triggers.map((t) => (
                        <Badge key={t} variant="outline" className="text-[10px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* AIDB Content */}
          {comparison.aidb_content.length > 0 && (
            <>
              <Separator />
              <section className="space-y-3">
                <h2 className="font-mono text-sm text-muted-foreground">
                  Related AIDB Content
                </h2>
                <div className="flex flex-wrap gap-3">
                  {comparison.aidb_content.map((content) => (
                    <AidbContentLink
                      key={content.id}
                      title={content.title}
                      url={content.url}
                      content_type={content.content_type}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-8 pt-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-11 max-w-2xl" />
        </div>
      }
    >
      <CompareContent />
    </Suspense>
  )
}
