import { createServerClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/lib/embeddings'

interface AidbCrawlResult {
  found: number
  new: number
  updated: number
}

interface AidbEpisode {
  title: string
  content_type: 'podcast' | 'training' | 'newsletter' | 'intel' | 'program'
  description: string
  url: string
  published_at: string
}

// Real AIDB podcast RSS feed (Anchor/Spotify)
const PODCAST_RSS_URL = 'https://anchor.fm/s/f7cac464/podcast/rss'

// Real AIDB ecosystem content (programs, intel, training)
const AIDB_ECOSYSTEM_CONTENT: AidbEpisode[] = [
  // Programs
  {
    title: 'CampClaw: 12-Step Agent Building Sprint',
    content_type: 'program',
    description: 'Self-directed cohort learning program by AIDB Training. Build 12 agent projects over 30 days. Includes daily newsletters, weekly check-ins, team collaboration, and a curated resource library.',
    url: 'https://campclaw.ai/home',
    published_at: '2026-02-19T00:00:00Z',
  },
  {
    title: 'AIDB New Year: 10-Week AI Mission Program',
    content_type: 'program',
    description: '10-week AI mission program with 6,544+ participants. Structured AI learning journey with weekly missions, community support, and hands-on projects.',
    url: 'https://aidbnewyear.com/',
    published_at: '2026-01-01T00:00:00Z',
  },
  {
    title: 'Enterprise Claw: Executive AI Agent Sprint',
    content_type: 'program',
    description: 'Executive-level AI agent sprint launching March 2026. Designed for business leaders to understand and deploy AI agents in enterprise contexts.',
    url: 'https://enterpriseclaw.ai/',
    published_at: '2026-03-01T00:00:00Z',
  },
  {
    title: 'Superintelligent: Agent Readiness Audit',
    content_type: 'program',
    description: 'AI readiness assessment program by AIDB. Evaluate your organization\'s preparedness for AI agent deployment with structured audit framework.',
    url: 'https://besuper.ai/',
    published_at: '2026-02-01T00:00:00Z',
  },
  // Intel
  {
    title: 'AIDB Intel: AI Research & Benchmarks Hub',
    content_type: 'intel',
    description: 'AIDB\'s research arm covering AI benchmarks, model comparisons, and industry analysis. In-depth technical reports on AI capabilities and trends.',
    url: 'https://aidbintel.com/',
    published_at: '2026-02-15T00:00:00Z',
  },
  // Training (aidailybrief.ai sub-sections)
  {
    title: 'AIDB Training Hub',
    content_type: 'training',
    description: 'Central training hub for AI Daily Brief education programs. Includes courses on agent building, prompt engineering, RAG pipelines, and AI deployment strategies.',
    url: 'https://aidailybrief.ai/',
    published_at: '2026-02-15T00:00:00Z',
  },
  // Newsletter
  {
    title: 'The AI Daily Brief Newsletter',
    content_type: 'newsletter',
    description: 'Daily AI news and analysis delivered via Beehiiv. Covers breaking AI developments, new model releases, agent frameworks, and practical tutorials.',
    url: 'https://aidailybrief.beehiiv.com/',
    published_at: '2026-02-17T00:00:00Z',
  },
  // Community
  {
    title: 'AIDB Operators Community (Circle)',
    content_type: 'training',
    description: 'Private community for AIDB members on Circle. Discussion forums, resource sharing, peer support, and direct access to AIDB instructors and content creators.',
    url: 'https://aidboperators.circle.so/',
    published_at: '2026-01-15T00:00:00Z',
  },
]

export async function crawlAidbContent(): Promise<AidbCrawlResult> {
  let totalFound = 0
  let totalNew = 0
  let totalUpdated = 0

  // 1. Crawl real podcast RSS feed
  try {
    const response = await fetch(PODCAST_RSS_URL, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'ClawCamp/1.0 AIDB-Crawler' },
    })

    if (response.ok) {
      const xml = await response.text()
      const episodes = parseRssFeed(xml)
      if (episodes.length > 0) {
        const result = await storeEpisodes(episodes)
        totalFound += result.found
        totalNew += result.new
        totalUpdated += result.updated
      }
    }
  } catch {
    console.warn('Could not fetch AIDB podcast RSS, skipping podcast crawl')
  }

  // 2. Store ecosystem content (programs, intel, training, newsletter)
  const ecosystemResult = await storeEpisodes(AIDB_ECOSYSTEM_CONTENT)
  totalFound += ecosystemResult.found
  totalNew += ecosystemResult.new
  totalUpdated += ecosystemResult.updated

  return { found: totalFound, new: totalNew, updated: totalUpdated }
}

function parseRssFeed(xml: string): AidbEpisode[] {
  const items: AidbEpisode[] = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/g
  let match

  while ((match = itemRegex.exec(xml)) !== null) {
    const item = match[1]
    const title = extractTag(item, 'title')
    const description = extractTag(item, 'description')
      ?.replace(/<[^>]+>/g, '')  // Strip HTML tags
      .trim()
    const link = extractTag(item, 'link')
    const pubDate = extractTag(item, 'pubDate')

    if (!title || !link) continue

    items.push({
      title,
      content_type: 'podcast',
      description: description || title,
      url: link,
      published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    })
  }

  return items
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA sections
  const cdataPattern = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`)
  const cdataMatch = xml.match(cdataPattern)
  if (cdataMatch) return cdataMatch[1].trim()

  // Handle plain text
  const plainPattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)
  const plainMatch = xml.match(plainPattern)
  if (plainMatch) return plainMatch[1].trim()

  return null
}

async function storeEpisodes(episodes: AidbEpisode[]): Promise<AidbCrawlResult> {
  const supabase = createServerClient()
  let newCount = 0
  let updated = 0

  const texts = episodes.map(ep => `${ep.title} | ${ep.description}`)
  const embeddings = await generateEmbeddings(texts)

  for (let i = 0; i < episodes.length; i++) {
    const episode = episodes[i]
    const embedding = embeddings[i]

    const { data: existing } = await supabase
      .from('aidb_content')
      .select('id')
      .eq('url', episode.url)
      .single()

    if (existing) {
      await supabase
        .from('aidb_content')
        .update({
          title: episode.title,
          content_type: episode.content_type,
          description: episode.description,
          published_at: episode.published_at,
          embedding,
        })
        .eq('id', existing.id)
      updated++
    } else {
      await supabase.from('aidb_content').insert({
        title: episode.title,
        content_type: episode.content_type,
        description: episode.description,
        url: episode.url,
        published_at: episode.published_at,
        embedding,
      })
      newCount++
    }
  }

  return { found: episodes.length, new: newCount, updated }
}
