import { Suspense } from "react"
import { TrendingGrid } from "@/components/trending-grid"
import { Skeleton } from "@/components/ui/skeleton"
import { BookmarkedSkills } from "@/components/bookmarked-skills"
import { createServerClient } from "@/lib/supabase/server"
import type { TrendingSkill, AidbContentMatch } from "@/types"

export const dynamic = "force-dynamic"

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000

async function fetchTrending(sort: string, limit: number): Promise<{ skills: TrendingSkill[]; totalSkills: number }> {
  try {
    const supabase = createServerClient()
    const cutoff = new Date(Date.now() - WINDOW_MS).toISOString()

    let query = supabase
      .from("skills")
      .select("*, embedding")
      .gte("first_seen_at", cutoff)

    if (sort === "new") {
      query = query.order("first_seen_at", { ascending: false })
    } else if (sort === "mentions") {
      query = query.order("mention_count", { ascending: false })
    }

    const { data: rawSkills, error } = await query.limit(sort === "hot" ? 200 : limit)
    if (error || !rawSkills) return { skills: [], totalSkills: 0 }

    const now = Date.now()
    const embeddingMap = new Map<string, number[]>()
    for (const skill of rawSkills) {
      if (skill.embedding) embeddingMap.set(skill.id, skill.embedding)
    }

    let scored: TrendingSkill[] = rawSkills.map((skill) => {
      const daysSinceFirstSeen = Math.max(1, (now - new Date(skill.first_seen_at).getTime()) / (24 * 60 * 60 * 1000))
      const hotScore = skill.mention_count * (1 / daysSinceFirstSeen)
      return {
        id: skill.id,
        name: skill.name,
        description: skill.description,
        full_instructions: skill.full_instructions,
        tools_used: skill.tools_used ?? [],
        triggers: skill.triggers ?? [],
        source_url: skill.source_url,
        source_type: skill.source_type,
        author: skill.author,
        first_seen_at: skill.first_seen_at,
        last_crawled_at: skill.last_crawled_at,
        mention_count: skill.mention_count,
        is_new: skill.is_new,
        raw_skill_md: skill.raw_skill_md,
        category: skill.category,
        upvote_count: skill.upvote_count,
        hot_score: Math.round(hotScore * 100) / 100,
        aidb_content: null,
      }
    })

    if (sort === "hot") {
      scored.sort((a, b) => b.hot_score - a.hot_score)
      scored = scored.slice(0, limit)
    }

    // Fetch AIDB content
    const topEmbeddings = scored.slice(0, 5)
      .map(s => embeddingMap.get(s.id))
      .filter((e): e is number[] => e !== undefined)

    if (topEmbeddings.length > 0) {
      try {
        const avgEmbedding = topEmbeddings[0].map((_: number, i: number) =>
          topEmbeddings.reduce((sum: number, emb: number[]) => sum + emb[i], 0) / topEmbeddings.length
        )
        const { data: aidbMatches } = await supabase.rpc("match_aidb_content", {
          query_embedding: avgEmbedding,
          match_count: 1,
        })
        if (aidbMatches && aidbMatches.length > 0) {
          const m = aidbMatches[0]
          const sharedContent: AidbContentMatch = {
            id: m.id,
            title: m.title,
            content_type: m.content_type,
            description: m.description,
            url: m.url,
            published_at: m.published_at,
            transcript: m.transcript ?? null,
            youtube_video_id: m.youtube_video_id ?? null,
            relevance_score: m.similarity,
          }
          for (let idx = 0; idx < Math.min(5, scored.length); idx++) {
            scored[idx].aidb_content = sharedContent
          }
        }
      } catch {
        // Non-critical
      }
    }

    const { count: totalSkills } = await supabase
      .from("skills")
      .select("*", { count: "exact", head: true })

    return { skills: scored, totalSkills: totalSkills ?? 0 }
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
