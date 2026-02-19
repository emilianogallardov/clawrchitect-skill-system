import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { generateEmbedding } from '@/lib/embeddings'
import {
  connectChrome,
  loadPlaylistVideos,
  scrapePlaylist,
  matchEpisodeToVideo,
  fetchTranscript,
} from '@/lib/crawlers/youtube-transcripts'

const BATCH_SIZE = 10
const DELAY_MS = 3000

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    console.error('CRON_SECRET is not configured')
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const limit = Math.min(parseInt(searchParams.get('limit') ?? String(BATCH_SIZE), 10), 50)
  const refreshPlaylist = searchParams.get('refresh') === 'true'

  let browser
  let page

  try {
    browser = await connectChrome()
    const context = browser.contexts()[0]
    page = await context.newPage()
  } catch {
    return NextResponse.json({
      error: 'Chrome CDP not available. Ensure Chrome is running with --remote-debugging-port=9222',
    }, { status: 503 })
  }

  try {
    // Load playlist video mapping (from JSON file or scrape live)
    let playlistVideos = loadPlaylistVideos()
    if (playlistVideos.length === 0 || refreshPlaylist) {
      playlistVideos = await scrapePlaylist(page)
    }

    if (playlistVideos.length === 0) {
      await page.close()
      return NextResponse.json({ error: 'Could not load playlist videos' }, { status: 500 })
    }

    const supabase = createServerClient()

    // Find podcast episodes without transcripts
    const { data: episodes, error } = await supabase
      .from('aidb_content')
      .select('id, title, url, youtube_video_id, transcript')
      .eq('content_type', 'podcast')
      .is('transcript', null)
      .order('published_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Transcript enrich query error:', error)
      await page.close()
      return NextResponse.json({ error: 'Failed to fetch episodes' }, { status: 500 })
    }

    if (!episodes || episodes.length === 0) {
      await page.close()
      return NextResponse.json({
        message: 'No episodes need transcript enrichment',
        enriched: 0,
        failed: 0,
        playlist_videos: playlistVideos.length,
      })
    }

    let enriched = 0
    let failed = 0
    const results: Array<{ title: string; status: string; videoId?: string; chars?: number }> = []

    for (const episode of episodes) {
      try {
        let videoId = episode.youtube_video_id

        // Step 1: Match episode to playlist video by title
        if (!videoId) {
          const match = matchEpisodeToVideo(episode.title, playlistVideos)
          if (match) {
            videoId = match.videoId
            await supabase
              .from('aidb_content')
              .update({ youtube_video_id: videoId })
              .eq('id', episode.id)
          }
        }

        if (!videoId) {
          results.push({ title: episode.title, status: 'no_match' })
          failed++
          continue
        }

        // Step 2: Fetch transcript via Chrome CDP
        const transcriptResult = await fetchTranscript(page, videoId)

        if (!transcriptResult || !transcriptResult.transcript) {
          results.push({ title: episode.title, status: 'no_transcript', videoId })
          failed++
          await sleep(DELAY_MS)
          continue
        }

        // Step 3: Store transcript and re-embed
        const embeddingText = `${episode.title} | ${transcriptResult.transcript.slice(0, 6000)}`
        const embedding = await generateEmbedding(embeddingText)

        await supabase
          .from('aidb_content')
          .update({
            transcript: transcriptResult.transcript,
            youtube_video_id: videoId,
            embedding,
          })
          .eq('id', episode.id)

        results.push({
          title: episode.title,
          status: 'enriched',
          videoId,
          chars: transcriptResult.transcript.length,
        })
        enriched++

        await sleep(DELAY_MS)
      } catch (err) {
        console.error(`Transcript enrich error for "${episode.title}":`, err)
        results.push({
          title: episode.title,
          status: `error: ${err instanceof Error ? err.message : 'unknown'}`,
        })
        failed++
      }
    }

    await page.close()

    return NextResponse.json({
      message: `Enriched ${enriched} of ${episodes.length} episodes`,
      enriched,
      failed,
      total_processed: episodes.length,
      playlist_videos: playlistVideos.length,
      results,
    })
  } catch (err) {
    console.error('Transcript enrich API error:', err)
    if (page) await page.close().catch(() => {})
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
