import { notFound } from "next/navigation"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { AidbContentLink } from "@/components/aidb-content-link"
import { SimilarityBadge } from "@/components/similarity-badge"
import { BookmarkButton } from "@/components/bookmark-button"
import { InstallButton } from "@/components/install-button"
import { SkillInstructions } from "@/components/skill-instructions"
import { createServerClient } from "@/lib/supabase/server"
import type { Skill, AidbContentMatch } from "@/types"

interface SkillDetailData {
  skill: Skill
  related_aidb_content: AidbContentMatch[]
  similar_skills: Array<{
    id: string
    name: string
    description: string | null
    similarity: number
  }>
}

async function fetchSkill(id: string): Promise<SkillDetailData | null> {
  try {
    const supabase = createServerClient()

    const { data: skill, error } = await supabase
      .from("skills")
      .select("*, embedding")
      .eq("id", id)
      .single()

    if (error || !skill) return null

    // Get related AIDB content
    let related_aidb_content: AidbContentMatch[] = []
    if (skill.embedding) {
      try {
        const { data: aidbMatches } = await supabase.rpc("match_aidb_content", {
          query_embedding: skill.embedding,
          match_count: 5,
        })
        if (aidbMatches) {
          related_aidb_content = aidbMatches.map((m: { id: string; title: string; content_type: string; description: string | null; url: string; published_at: string | null; transcript: string | null; youtube_video_id: string | null; similarity: number }) => ({
            id: m.id,
            title: m.title,
            content_type: m.content_type as AidbContentMatch["content_type"],
            description: m.description,
            url: m.url,
            published_at: m.published_at,
            transcript: m.transcript ?? null,
            youtube_video_id: m.youtube_video_id ?? null,
            relevance_score: m.similarity,
          }))
        }
      } catch {
        // Non-critical
      }
    }

    // Get similar skills
    let similar_skills: Array<{ id: string; name: string; description: string | null; similarity: number }> = []
    if (skill.embedding) {
      try {
        const { data: matches } = await supabase.rpc("search_skills", {
          query_embedding: skill.embedding,
          match_threshold: 0.5,
          match_count: 6,
        })
        if (matches) {
          similar_skills = matches
            .filter((m: { id: string }) => m.id !== id)
            .slice(0, 5)
            .map((m: { id: string; name: string; description: string | null; similarity: number }) => ({
              id: m.id,
              name: m.name,
              description: m.description,
              similarity: m.similarity,
            }))
        }
      } catch {
        // Non-critical
      }
    }

    const { embedding: _, ...skillData } = skill
    void _

    return {
      skill: skillData as Skill,
      related_aidb_content,
      similar_skills,
    }
  } catch {
    return null
  }
}

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const data = await fetchSkill(id)

  if (!data) notFound()

  const { skill, related_aidb_content, similar_skills } = data

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Hero */}
      <section className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-mono text-2xl font-bold uppercase text-brand sm:text-3xl">
            {skill.name}
          </h1>
          <Badge variant="outline" className="text-xs">
            {skill.source_type}
          </Badge>
        </div>
        {skill.author && (
          <p className="font-sans text-sm text-muted-foreground">
            by {skill.author}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {skill.source_url && /^https?:\/\//i.test(skill.source_url) && (
            <a
              href={skill.source_url.replace('raw.githubusercontent.com', 'github.com').replace('/main/', '/blob/main/')}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-mono text-xs text-primary hover:underline"
            >
              View SKILL.md on GitHub
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
            </a>
          )}
          <BookmarkButton skillId={skill.id} skillName={skill.name} variant="full" />
          <InstallButton sourceUrl={skill.source_url} sourceType={skill.source_type} />
        </div>
      </section>

      {/* Description */}
      {skill.description && (
        <section className="space-y-2">
          <h2 className="font-mono text-sm text-muted-foreground">Description</h2>
          <p className="font-sans text-sm leading-relaxed text-foreground">
            {skill.description}
          </p>
        </section>
      )}

      {/* Full Instructions */}
      {skill.full_instructions && (
        <section className="space-y-2">
          <h2 className="font-mono text-sm text-muted-foreground">About This Skill</h2>
          <SkillInstructions content={skill.full_instructions} />
        </section>
      )}

      <Separator />

      {/* Metadata */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Tools */}
        <div className="min-w-0 space-y-2">
          <h3 className="font-mono text-xs text-muted-foreground">Tools Used</h3>
          <div className="flex flex-wrap gap-1.5">
            {skill.tools_used.length > 0 ? (
              skill.tools_used.map((tool) => (
                <Badge key={tool} variant="secondary" className="font-mono text-[10px]">
                  {tool}
                </Badge>
              ))
            ) : (
              <span className="font-sans text-xs text-muted-foreground">None listed</span>
            )}
          </div>
        </div>

        {/* Triggers */}
        <div className="col-span-2 min-w-0 space-y-2 lg:col-span-1">
          <h3 className="font-mono text-xs text-muted-foreground">Triggers</h3>
          <div className="flex flex-wrap gap-1.5">
            {skill.triggers.length > 0 ? (
              skill.triggers.slice(0, 3).map((trigger) => (
                <Badge key={trigger} variant="secondary" className="max-w-full font-mono text-[10px]">
                  <span className="truncate">{trigger}</span>
                </Badge>
              ))
            ) : (
              <span className="font-sans text-xs text-muted-foreground">None listed</span>
            )}
          </div>
        </div>

        {/* First Seen */}
        <div className="min-w-0 space-y-2">
          <h3 className="font-mono text-xs text-muted-foreground">First Seen</h3>
          <p className="font-mono text-sm text-foreground">
            {new Date(skill.first_seen_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </p>
        </div>

        {/* Mentions */}
        <div className="min-w-0 space-y-2">
          <h3 className="font-mono text-xs text-muted-foreground">Mentions</h3>
          <p className="font-mono text-sm text-primary">{skill.mention_count}</p>
        </div>
      </section>

      <Separator />

      {/* Related AIDB Content */}
      {related_aidb_content.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-sm text-muted-foreground">Related from AIDB</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {related_aidb_content.slice(0, 3).map((content) => (
              <Card key={content.id} className="bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="font-sans text-sm">{content.title}</CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  {content.description && (
                    <p className="mb-3 line-clamp-2 font-sans text-xs text-muted-foreground">
                      {content.description}
                    </p>
                  )}
                  <AidbContentLink
                    title={content.content_type}
                    url={content.url}
                    content_type={content.content_type}
                  />
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {/* Similar Skills */}
      {similar_skills.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-sm text-muted-foreground">Similar Skills</h2>
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-hide sm:mx-0 sm:px-0">
            {similar_skills.map((sim) => (
              <Link
                key={sim.id}
                href={`/skills/${sim.id}`}
                className="glow-warm flex w-[200px] shrink-0 snap-start flex-col gap-2 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/30 sm:w-[220px]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-mono text-sm text-primary">
                    {sim.name}
                  </span>
                  <SimilarityBadge score={sim.similarity} />
                </div>
                {sim.description && (
                  <p className="line-clamp-2 font-sans text-xs text-muted-foreground">
                    {sim.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Compare Button */}
      <div className="flex justify-center pb-4">
        <Button asChild variant="outline" className="font-mono">
          <Link href={`/compare?ids=${skill.id}`}>Compare with...</Link>
        </Button>
      </div>
    </div>
  )
}
