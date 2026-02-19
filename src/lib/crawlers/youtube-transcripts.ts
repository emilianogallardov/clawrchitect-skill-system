/**
 * YouTube Transcript Fetcher via Chrome CDP
 *
 * Uses a pre-scraped playlist mapping (playlist-videos.json) to match
 * podcast episodes to YouTube video IDs, then extracts transcripts
 * by opening the video and scraping the transcript panel.
 *
 * Playlist: https://www.youtube.com/playlist?list=PLRYSuzHGhXPmKnOpd-f588cNNmTe2S9FP
 * Requires: Chrome running with --remote-debugging-port=9222
 */

import { chromium, type Page, type Browser } from 'playwright'
import { readFileSync } from 'fs'
import { join } from 'path'

const CDP_URL = 'http://localhost:9222'
const PLAYLIST_ID = 'PLRYSuzHGhXPmKnOpd-f588cNNmTe2S9FP'

interface PlaylistVideo {
  videoId: string
  title: string
}

interface TranscriptResult {
  videoId: string
  transcript: string
  segmentCount: number
}

// In-memory cache of playlist videos
let playlistCache: PlaylistVideo[] | null = null

/**
 * Connect to the running Chrome instance via CDP.
 */
export async function connectChrome(): Promise<Browser> {
  return chromium.connectOverCDP(CDP_URL)
}

/**
 * Load the playlist video mapping. First tries the cached JSON file,
 * then falls back to scraping the playlist live via Chrome CDP.
 */
export function loadPlaylistVideos(): PlaylistVideo[] {
  if (playlistCache) return playlistCache

  try {
    const filePath = join(process.cwd(), 'playlist-videos.json')
    const data = JSON.parse(readFileSync(filePath, 'utf-8'))
    playlistCache = data as PlaylistVideo[]
    return playlistCache
  } catch {
    return []
  }
}

/**
 * Scrape all videos from the AIDB playlist via Chrome CDP.
 * Saves result to playlist-videos.json for future use.
 */
export async function scrapePlaylist(page: Page): Promise<PlaylistVideo[]> {
  const playlistUrl = `https://www.youtube.com/playlist?list=${PLAYLIST_ID}`

  await page.goto(playlistUrl, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(4000)

  // Scroll to load all videos
  let previousCount = 0
  let stableCount = 0
  for (let i = 0; i < 100; i++) {
    const count = await page.evaluate(() =>
      document.querySelectorAll('ytd-playlist-video-renderer a#video-title').length
    )
    if (count === previousCount) {
      stableCount++
      if (stableCount >= 5) break
    } else {
      stableCount = 0
    }
    previousCount = count
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
    await page.waitForTimeout(1200)
  }

  const videos = await page.evaluate(() => {
    const links = document.querySelectorAll('ytd-playlist-video-renderer a#video-title')
    return [...links].map(el => {
      const a = el as HTMLAnchorElement
      const href = a.href || ''
      const m = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
      return {
        videoId: m ? m[1] : null,
        title: a.textContent?.trim() || '',
      }
    }).filter((v): v is PlaylistVideo => v.videoId !== null)
  })

  // Cache and save
  playlistCache = videos
  try {
    const { writeFileSync } = await import('fs')
    writeFileSync(join(process.cwd(), 'playlist-videos.json'), JSON.stringify(videos, null, 2))
  } catch {
    // Non-critical
  }

  return videos
}

/**
 * Match an episode title to a video in the playlist using fuzzy title matching.
 */
export function matchEpisodeToVideo(episodeTitle: string, videos: PlaylistVideo[]): PlaylistVideo | null {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
  const epNorm = normalize(episodeTitle)
  const epWords = new Set(epNorm.split(/\s+/).filter(w => w.length > 2))

  let bestMatch: PlaylistVideo | null = null
  let bestScore = 0

  for (const video of videos) {
    const vidNorm = normalize(video.title)

    // Exact match after normalization
    if (epNorm === vidNorm) return video

    // Word overlap scoring
    const vidWords = new Set(vidNorm.split(/\s+/).filter(w => w.length > 2))
    let overlap = 0
    for (const w of epWords) {
      if (vidWords.has(w)) overlap++
    }

    const minSize = Math.min(epWords.size, vidWords.size)
    if (minSize === 0) continue

    const score = overlap / minSize
    if (score > bestScore) {
      bestScore = score
      bestMatch = video
    }
  }

  // Require at least 50% word overlap
  return bestScore >= 0.5 ? bestMatch : null
}

/**
 * Fetch the full transcript for a YouTube video by its video ID.
 * Opens the video in Chrome, clicks "Show transcript", and extracts segment text.
 */
export async function fetchTranscript(
  page: Page,
  videoId: string
): Promise<TranscriptResult | null> {
  try {
    await page.goto(`https://www.youtube.com/watch?v=${videoId}`, {
      waitUntil: 'networkidle',
      timeout: 15000,
    }).catch(() => {})
    await page.waitForTimeout(4000)

    // Expand description to reveal "Show transcript" button
    try {
      await page.locator('#expand, tp-yt-paper-button#expand').first().click({ timeout: 3000 })
      await page.waitForTimeout(1500)
    } catch {
      // May already be expanded
    }

    // Click "Show transcript"
    try {
      await page.locator('button:has-text("Show transcript")').first().click({ timeout: 5000 })
    } catch {
      return null
    }

    // Wait for transcript segments to render
    try {
      await page.waitForSelector('ytd-transcript-segment-renderer .segment-text', { timeout: 10000 })
    } catch {
      await page.waitForTimeout(5000)
    }

    await page.waitForTimeout(2000)

    // Extract transcript text
    const result = await page.evaluate(() => {
      const selectors = [
        'ytd-transcript-segment-renderer .segment-text',
        'yt-formatted-string.segment-text',
        '.ytd-transcript-segment-list-renderer .segment-text',
        'ytd-transcript-segment-renderer yt-formatted-string',
      ]

      for (const sel of selectors) {
        const els = document.querySelectorAll(sel)
        if (els.length > 0) {
          const segments = [...els]
            .map(el => el.textContent?.trim())
            .filter((t): t is string => Boolean(t))
          return { segments, count: els.length }
        }
      }

      // Fallback: text walker on transcript panel
      const bodyEl = document.querySelector('#segments-container, ytd-transcript-segment-list-renderer')
      if (bodyEl) {
        const walker = document.createTreeWalker(bodyEl, NodeFilter.SHOW_TEXT)
        const texts: string[] = []
        let node: Node | null
        while ((node = walker.nextNode())) {
          const t = node.textContent?.trim()
          if (t && t.length > 1 && !/^\d+:\d+$/.test(t)) {
            texts.push(t)
          }
        }
        return { segments: texts, count: texts.length }
      }

      return { segments: [] as string[], count: 0 }
    })

    if (result.segments.length === 0) return null

    return {
      videoId,
      transcript: result.segments.join(' '),
      segmentCount: result.count,
    }
  } catch (err) {
    console.warn(`Transcript fetch failed for ${videoId}:`, err instanceof Error ? err.message : err)
    return null
  }
}
