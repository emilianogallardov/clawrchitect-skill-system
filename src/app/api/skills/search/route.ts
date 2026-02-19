import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import type { SkillSearchResult, AidbContentMatch } from '@/types'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const q = searchParams.get('q')
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '10', 10) || 10, 1), 50)
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

  if (!q || !q.trim()) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 })
  }

  if (q.trim().length > 500) {
    return NextResponse.json({ error: 'Query too long (max 500 characters)' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const embedding = await generateEmbedding(q.trim())

    const { data: matches, error: searchError } = await supabase.rpc('search_skills', {
      query_embedding: embedding,
      match_threshold: 0.3,
      match_count: limit + offset,
    })

    if (searchError) {
      console.error('search_skills RPC error:', searchError)
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }

    const paged = (matches ?? []).slice(offset, offset + limit)

    // Fetch AIDB content once for the query (not per-result)
    let sharedAidbContent: AidbContentMatch | null = null
    try {
      const { data: aidbMatches } = await supabase.rpc('match_aidb_content', {
        query_embedding: embedding,
        match_count: 1,
      })
      if (aidbMatches && aidbMatches.length > 0) {
        const m = aidbMatches[0]
        sharedAidbContent = {
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
      }
    } catch {
      // Non-critical: skip AIDB match
    }

    const results: SkillSearchResult[] = paged.map((match: { id: string; name: string; description: string | null; full_instructions: string | null; tools_used: string[]; triggers: string[]; source_url: string; source_type: string; author: string | null; first_seen_at: string; last_crawled_at: string; mention_count: number; is_new: boolean; raw_skill_md: string | null; category: string; upvote_count: number; similarity: number }) => ({
      id: match.id,
      name: match.name,
      description: match.description,
      full_instructions: match.full_instructions,
      tools_used: match.tools_used ?? [],
      triggers: match.triggers ?? [],
      source_url: match.source_url,
      source_type: match.source_type as SkillSearchResult['source_type'],
      author: match.author,
      first_seen_at: match.first_seen_at,
      last_crawled_at: match.last_crawled_at,
      mention_count: match.mention_count,
      is_new: match.is_new,
      raw_skill_md: null,
      category: (match.category ?? 'uncategorized') as SkillSearchResult['category'],
      upvote_count: match.upvote_count ?? 0,
      relevance_score: match.similarity,
      aidb_content: sharedAidbContent,
    } satisfies SkillSearchResult))

    return NextResponse.json({
      results,
      total: matches?.length ?? 0,
      query: q.trim(),
    })
  } catch (err) {
    console.error('Search API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
