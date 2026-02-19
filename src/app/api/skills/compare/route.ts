import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import type { SkillComparison, AidbContentMatch } from '@/types'

function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

function averageEmbeddings(embeddings: number[][]): number[] {
  const len = embeddings[0].length
  const avg = new Array<number>(len).fill(0)
  for (const emb of embeddings) {
    for (let i = 0; i < len; i++) {
      avg[i] += emb[i]
    }
  }
  for (let i = 0; i < len; i++) {
    avg[i] /= embeddings.length
  }
  return avg
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const idsParam = searchParams.get('ids')

  if (!idsParam) {
    return NextResponse.json({ error: 'Query parameter "ids" is required (comma-separated)' }, { status: 400 })
  }

  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean)

  if (ids.length < 2 || ids.length > 5) {
    return NextResponse.json({ error: 'Provide between 2 and 5 skill IDs' }, { status: 400 })
  }

  try {
    const supabase = createServerClient()

    const { data: skills, error } = await supabase
      .from('skills')
      .select('*, embedding')
      .in('id', ids)

    if (error) {
      console.error('Compare query error:', error)
      return NextResponse.json({ error: 'Failed to fetch skills' }, { status: 500 })
    }

    if (!skills || skills.length !== ids.length) {
      const foundIds = new Set(skills?.map(s => s.id) ?? [])
      const missing = ids.filter(id => !foundIds.has(id))
      return NextResponse.json({ error: `Skills not found: ${missing.join(', ')}` }, { status: 404 })
    }

    // Parse embeddings (Supabase may return as string)
    const parseEmbedding = (emb: unknown): number[] | null => {
      if (!emb) return null
      if (Array.isArray(emb)) return emb
      if (typeof emb === 'string') {
        try { return JSON.parse(emb) } catch { return null }
      }
      return null
    }

    // Build similarity matrix
    const similarityMatrix: Record<string, number> = {}
    for (let i = 0; i < skills.length; i++) {
      for (let j = i + 1; j < skills.length; j++) {
        const embA = parseEmbedding(skills[i].embedding)
        const embB = parseEmbedding(skills[j].embedding)
        if (embA && embB) {
          const sim = cosineSimilarity(embA, embB)
          const key = `${skills[i].id}:${skills[j].id}`
          similarityMatrix[key] = Math.round(sim * 1000) / 1000
        }
      }
    }

    // Analyze tools and triggers overlap
    const allToolSets = skills.map(s => new Set<string>(s.tools_used ?? []))
    const allTriggerSets = skills.map(s => new Set<string>(s.triggers ?? []))

    // Shared = present in ALL skills
    const sharedTools: string[] = [...allToolSets[0]].filter(tool =>
      allToolSets.every(set => set.has(tool))
    )
    const sharedTriggers: string[] = [...allTriggerSets[0]].filter(trigger =>
      allTriggerSets.every(set => set.has(trigger))
    )

    // Unique features per skill
    const uniqueFeatures: Record<string, { unique_tools: string[]; unique_triggers: string[] }> = {}
    for (const skill of skills) {
      const otherTools = new Set(
        skills.filter(s => s.id !== skill.id).flatMap(s => s.tools_used ?? [])
      )
      const otherTriggers = new Set(
        skills.filter(s => s.id !== skill.id).flatMap(s => s.triggers ?? [])
      )
      uniqueFeatures[skill.id] = {
        unique_tools: (skill.tools_used ?? []).filter((t: string) => !otherTools.has(t)),
        unique_triggers: (skill.triggers ?? []).filter((t: string) => !otherTriggers.has(t)),
      }
    }

    // AIDB content from averaged embedding
    let aidbContent: AidbContentMatch[] = []
    const embeddings = skills.map(s => parseEmbedding(s.embedding)).filter((e): e is number[] => e !== null)
    if (embeddings.length > 0) {
      const avgEmbed = averageEmbeddings(embeddings)
      try {
        const { data: aidbMatches } = await supabase.rpc('match_aidb_content', {
          query_embedding: avgEmbed,
          match_count: 5,
        })
        if (aidbMatches) {
          aidbContent = aidbMatches.map((m: { id: string; title: string; content_type: string; description: string | null; url: string; published_at: string | null; transcript: string | null; youtube_video_id: string | null; similarity: number }) => ({
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

    // Strip embeddings from response
    const cleanSkills = skills.map(({ embedding: _unused, ...rest }) => {
      void _unused
      return rest
    })

    const comparison: SkillComparison = {
      skills: cleanSkills,
      similarity_matrix: similarityMatrix,
      shared_tools: sharedTools,
      shared_triggers: sharedTriggers,
      unique_features: uniqueFeatures,
      aidb_content: aidbContent,
    }

    return NextResponse.json(comparison)
  } catch (err) {
    console.error('Compare API error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
