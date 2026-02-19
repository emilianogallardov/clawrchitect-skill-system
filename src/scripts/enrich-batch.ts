/**
 * Fast batch transcript enrichment.
 * Usage: npx tsx src/scripts/enrich-batch.ts [--limit=147]
 *
 * Phase 1: Bulk title-match all episodes to playlist videos (instant)
 * Phase 2: Fetch transcripts via Chrome CDP (sequential, ~12s each)
 * Phase 3: Batch embed and store (parallel API calls)
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { chromium, type Page } from 'playwright'
import { readFileSync } from 'fs'
import { join } from 'path'

const CDP_URL = 'http://localhost:9222'

const args = Object.fromEntries(
  process.argv.slice(2).map(a => {
    const [k, v] = a.replace('--', '').split('=')
    return [k, v]
  })
)
const LIMIT = parseInt(args.limit ?? '200', 10)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

interface PlaylistVideo { videoId: string; title: string }
interface Episode { id: string; title: string; youtube_video_id: string | null }
interface EnrichedEpisode { id: string; title: string; videoId: string; transcript: string }

function loadPlaylist(): PlaylistVideo[] {
  return JSON.parse(readFileSync(join(process.cwd(), 'playlist-videos.json'), 'utf-8'))
}

function matchTitle(epTitle: string, videos: PlaylistVideo[]): PlaylistVideo | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const epNorm = normalize(epTitle)
  const epWords = new Set(epNorm.split(/\s+/).filter(w => w.length > 2))

  let best: PlaylistVideo | null = null
  let bestScore = 0

  for (const v of videos) {
    const vNorm = normalize(v.title)
    if (epNorm === vNorm) return v

    const vWords = new Set(vNorm.split(/\s+/).filter(w => w.length > 2))
    let overlap = 0
    for (const w of epWords) if (vWords.has(w)) overlap++

    const minSize = Math.min(epWords.size, vWords.size)
    if (minSize === 0) continue
    const score = overlap / minSize
    if (score > bestScore) { bestScore = score; best = v }
  }

  return bestScore >= 0.5 ? best : null
}

async function fetchTranscript(
  page: Page,
  videoId: string
): Promise<string | null> {
  try {
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
      waitUntil: 'networkidle', timeout: 15000,
    }).catch(() => {})
    await page.waitForTimeout(3000)

    try {
      await page.locator('#expand, tp-yt-paper-button#expand').first().click({ timeout: 3000 })
      await page.waitForTimeout(1000)
    } catch { /* ok */ }

    try {
      await page.locator('button:has-text("Show transcript")').first().click({ timeout: 5000 })
    } catch { return null }

    try {
      await page.waitForSelector('ytd-transcript-segment-renderer .segment-text', { timeout: 10000 })
    } catch {
      await page.waitForTimeout(4000)
    }
    await page.waitForTimeout(1500)

    const text = await page.evaluate(() => {
      const els = document.querySelectorAll('ytd-transcript-segment-renderer .segment-text')
      if (els.length > 0) {
        return [...els].map(el => el.textContent?.trim()).filter(Boolean).join(' ')
      }
      const body = document.querySelector('#segments-container, ytd-transcript-segment-list-renderer')
      if (body) {
        const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT)
        const texts: string[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          const t = node.textContent?.trim()
          if (t && t.length > 1 && !/^\d+:\d+$/.test(t)) texts.push(t)
        }
        return texts.join(' ')
      }
      return null
    })

    return text && text.length > 50 ? text : null
  } catch (err) {
    console.error(`  Error ${videoId}:`, err instanceof Error ? err.message : err)
    return null
  }
}

async function batchEmbed(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100)
    const res = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(t => t.slice(0, 8000)),
    })
    results.push(...res.data.map(d => d.embedding))
  }
  return results
}

async function main() {
  const startTime = Date.now()
  console.log(`\n=== Transcript Enrichment (limit=${LIMIT}) ===\n`)

  // ─── Phase 1: Bulk title matching ───
  console.log('Phase 1: Matching episodes to playlist videos...')
  const playlist = loadPlaylist()

  const { data: episodes, error } = await supabase
    .from('aidb_content')
    .select('id, title, youtube_video_id')
    .eq('content_type', 'podcast')
    .is('transcript', null)
    .gte('published_at', '2025-08-01T00:00:00Z')
    .order('published_at', { ascending: false })
    .limit(LIMIT)

  if (error || !episodes) {
    console.error('Query error:', error)
    process.exit(1)
  }

  console.log(`  ${episodes.length} episodes need transcripts`)
  console.log(`  ${playlist.length} playlist videos available`)

  // Match all episodes to videos
  const matched: Array<{ ep: Episode; videoId: string }> = []
  const unmatched: string[] = []

  for (const ep of episodes) {
    let videoId = ep.youtube_video_id
    if (!videoId) {
      const m = matchTitle(ep.title, playlist)
      if (m) videoId = m.videoId
    }
    if (videoId) {
      matched.push({ ep, videoId })
    } else {
      unmatched.push(ep.title)
    }
  }

  console.log(`  Matched: ${matched.length} | Unmatched: ${unmatched.length}`)
  if (unmatched.length > 0) {
    console.log(`  Unmatched titles:`)
    unmatched.slice(0, 10).forEach(t => console.log(`    - ${t}`))
    if (unmatched.length > 10) console.log(`    ... and ${unmatched.length - 10} more`)
  }

  // Bulk update video IDs
  const needsVideoIdUpdate = matched.filter(m => !m.ep.youtube_video_id)
  if (needsVideoIdUpdate.length > 0) {
    console.log(`  Storing ${needsVideoIdUpdate.length} video IDs...`)
    for (const m of needsVideoIdUpdate) {
      await supabase.from('aidb_content').update({ youtube_video_id: m.videoId }).eq('id', m.ep.id)
    }
  }

  const matchTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  Done in ${matchTime}s\n`)

  // ─── Phase 2: Fetch transcripts via Chrome CDP ───
  console.log(`Phase 2: Fetching ${matched.length} transcripts via Chrome CDP...`)
  const browser = await chromium.connectOverCDP(CDP_URL)
  const context = browser.contexts()[0]
  const page = await context.newPage()

  const enriched: EnrichedEpisode[] = []
  let failCount = 0

  for (let i = 0; i < matched.length; i++) {
    const { ep, videoId } = matched[i]
    const n = i + 1

    const transcript = await fetchTranscript(page, videoId)

    if (transcript) {
      enriched.push({ id: ep.id, title: ep.title, videoId, transcript })
      const chars = transcript.length.toLocaleString()
      console.log(`  [${n}/${matched.length}] OK (${chars} chars): ${ep.title.substring(0, 60)}`)
    } else {
      failCount++
      console.log(`  [${n}/${matched.length}] FAIL: ${ep.title.substring(0, 60)} [${videoId}]`)
    }
  }

  await page.close()

  const fetchTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`  Transcripts: ${enriched.length} ok, ${failCount} failed (${fetchTime}s elapsed)\n`)

  // ─── Phase 3: Batch embed and store ───
  if (enriched.length > 0) {
    console.log(`Phase 3: Embedding and storing ${enriched.length} transcripts...`)

    const embTexts = enriched.map(e => `${e.title} | ${e.transcript.slice(0, 6000)}`)
    const embeddings = await batchEmbed(embTexts)

    for (let i = 0; i < enriched.length; i++) {
      await supabase
        .from('aidb_content')
        .update({
          transcript: enriched[i].transcript,
          youtube_video_id: enriched[i].videoId,
          embedding: embeddings[i],
        })
        .eq('id', enriched[i].id)
    }
    console.log(`  Stored ${enriched.length} enriched episodes`)
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\n=== Complete ===`)
  console.log(`Enriched: ${enriched.length}/${episodes.length}`)
  console.log(`Failed: ${failCount + unmatched.length} (${unmatched.length} unmatched, ${failCount} no transcript)`)
  console.log(`Time: ${totalTime}s`)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
