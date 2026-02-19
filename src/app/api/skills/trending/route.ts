import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { TrendingSkill, AidbContentMatch } from '@/types'

type WindowOption = '24h' | '7d' | '30d'
type SortOption = 'new' | 'mentions' | 'hot'

const WINDOW_MS: Record<WindowOption, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const window = (searchParams.get('window') ?? '7d') as WindowOption
  const sort = (searchParams.get('sort') ?? 'hot') as SortOption
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 1), 100)

  if (!WINDOW_MS[window]) {
    return NextResponse.json({ error: 'Invalid window. Use 24h, 7d, or 30d' }, { status: 400 })
  }

  if (!['new', 'mentions', 'hot'].includes(sort)) {
    return NextResponse.json({ error: 'Invalid sort. Use new, mentions, or hot' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()
    const cutoff = new Date(Date.now() - WINDOW_MS[window]).toISOString()

    let query = supabase
      .from('skills')
      .select('*, embedding')
      .gte('first_seen_at', cutoff)

    if (sort === 'new') {
      query = query.order('first_seen_at', { ascending: false })
    } else if (sort === 'mentions') {
      query = query.order('mention_count', { ascending: false })
    }
    // For 'hot' sort, we fetch all and sort in JS

    const { data: skills, error } = await query.limit(sort === 'hot' ? 200 : limit)

    if (error) {
      console.error('Trending query error:', error)
      return NextResponse.json({ error: 'Failed to fetch trending skills' }, { status: 500 })
    }

    const now = Date.now()
    const rawSkills = skills ?? []

    // Extract embeddings from raw data before casting to TrendingSkill
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

    if (sort === 'hot') {
      scored.sort((a, b) => b.hot_score - a.hot_score)
      scored = scored.slice(0, limit)
    }

    // Fetch AIDB content using a single averaged embedding from top 5 results
    const topEmbeddings = scored.slice(0, 5)
      .map(s => embeddingMap.get(s.id))
      .filter((e): e is number[] => e !== undefined)

    if (topEmbeddings.length > 0) {
      try {
        const avgEmbedding = topEmbeddings[0].map((_: number, i: number) =>
          topEmbeddings.reduce((sum: number, emb: number[]) => sum + emb[i], 0) / topEmbeddings.length
        )
        const { data: aidbMatches } = await supabase.rpc('match_aidb_content', {
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

    // Get total skill count (lightweight, uses count only)
    const { count: totalSkills } = await supabase
      .from('skills')
      .select('*', { count: 'exact', head: true })

    return NextResponse.json({
      skills: scored,
      window,
      sort,
      total: scored.length,
      total_skills: totalSkills ?? 0,
    })
  } catch (err) {
    console.error('Trending API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
