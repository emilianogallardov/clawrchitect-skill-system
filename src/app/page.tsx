import { Suspense } from "react"
import { TrendingGrid } from "@/components/trending-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { BookmarkedSkills } from "@/components/bookmarked-skills"
import type { TrendingSkill } from "@/types"

export const dynamic = "force-dynamic"

function getBaseUrl() {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return `http://localhost:${process.env.PORT ?? 3000}`
}

async function fetchTrending(sort: string, limit: number): Promise<{ skills: TrendingSkill[]; totalSkills: number }> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/skills/trending?window=7d&sort=${sort}&limit=${limit}`,
      { next: { revalidate: 300 } }
    )
    if (!res.ok) return { skills: [], totalSkills: 0 }
    const data = await res.json()
    return { skills: data.skills ?? [], totalSkills: data.total_skills ?? 0 }
  } catch {
    return { skills: [], totalSkills: 0 }
  }
}

function SkeletonGrid({ count }: { count: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border border-border bg-card p-6 space-y-3">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex justify-between pt-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}

async function HeroCount() {
  const { totalSkills } = await fetchTrending("hot", 1)
  const display = totalSkills > 0 ? `${totalSkills.toLocaleString()}+` : ""
  return (
    <p className="max-w-lg font-sans text-sm text-muted-foreground">
      Search and explore {display} agent skills with vector-powered intelligence.
    </p>
  )
}

async function TrendingSection() {
  const { skills } = await fetchTrending("hot", 12)
  if (skills.length === 0) {
    return (
      <section>
        <h2 className="mb-4 font-mono text-lg font-bold uppercase text-brand">Trending This Week</h2>
        <p className="font-sans text-sm text-muted-foreground">No trending skills found. Check back soon.</p>
      </section>
    )
  }
  return <TrendingGrid skills={skills} title="Trending This Week" />
}

async function NewSkillsSection() {
  const { skills } = await fetchTrending("new", 6)
  if (skills.length === 0) {
    return (
      <section>
        <h2 className="mb-4 font-mono text-lg font-bold uppercase text-brand">Just Landed</h2>
        <p className="font-sans text-sm text-muted-foreground">No new skills this week.</p>
      </section>
    )
  }
  return <TrendingGrid skills={skills} title="Just Landed" />
}

export default function HomePage() {
  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="flex flex-col items-center gap-6 pt-8 pb-4 text-center">
        <h1 className="font-mono text-3xl font-bold uppercase text-brand sm:text-4xl">
          Discover OpenClaw Skills
        </h1>
        <Suspense fallback={<p className="max-w-lg font-sans text-sm text-muted-foreground">Search and explore agent skills with vector-powered intelligence.</p>}>
          <HeroCount />
        </Suspense>
      </section>

      {/* My Skills */}
      <Suspense>
        <BookmarkedSkills />
      </Suspense>

      {/* Trending */}
      <Suspense fallback={<SkeletonGrid count={12} />}>
        <TrendingSection />
      </Suspense>

      {/* New Skills */}
      <Suspense fallback={<SkeletonGrid count={6} />}>
        <NewSkillsSection />
      </Suspense>
    </div>
  )
}
