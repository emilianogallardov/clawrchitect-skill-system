import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { AidbContentMatch } from '@/types'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!id) {
    return NextResponse.json({ error: 'Skill ID is required' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    const { data: skill, error } = await supabase
      .from('skills')
      .select('*, embedding')
      .eq('id', id)
      .single()

    if (error || !skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 })
    }

    // Get related AIDB content
    let relatedAidbContent: AidbContentMatch[] = []
    if (skill.embedding) {
      try {
        const { data: aidbMatches } = await supabase.rpc('match_aidb_content', {
          query_embedding: skill.embedding,
          match_count: 5,
        })
        if (aidbMatches) {
          relatedAidbContent = aidbMatches.map((m: { id: string; title: string; content_type: string; description: string | null; url: string; published_at: string | null; transcript: string | null; youtube_video_id: string | null; similarity: number }) => ({
            id: m.id,
            title: m.title,
            content_type: m.content_type as AidbContentMatch['content_type'],
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
    let similarSkills: Array<{ id: string; name: string; description: string | null; similarity: number }> = []
    if (skill.embedding) {
      try {
        const { data: matches } = await supabase.rpc('search_skills', {
          query_embedding: skill.embedding,
          match_threshold: 0.5,
          match_count: 6,
        })
        if (matches) {
          similarSkills = matches
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

    // Strip embedding from response
    const { embedding: _, ...skillData } = skill
    void _

    return NextResponse.json({
      skill: skillData,
      related_aidb_content: relatedAidbContent,
      similar_skills: similarSkills,
    })
  } catch (err) {
    console.error('Skill detail API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
