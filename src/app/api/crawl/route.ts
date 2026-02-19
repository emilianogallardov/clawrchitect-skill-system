import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { crawlGithubSkills } from '@/lib/crawlers/github'
import { crawlAidbContent } from '@/lib/crawlers/aidb-content'
import { crawlCampclawResources } from '@/lib/crawlers/campclaw-resources'

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

  const supabase = createServerClient()

  // Create crawl log entry
  const { data: logEntry } = await supabase
    .from('crawl_logs')
    .insert({
      source: 'scheduled',
      skills_found: 0,
      skills_new: 0,
      skills_updated: 0,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single()

  try {
    const [githubResult, aidbResult, campclawResult] = await Promise.all([
      crawlGithubSkills(),
      crawlAidbContent(),
      crawlCampclawResources(),
    ])

    const totalFound = githubResult.found + campclawResult.found
    const totalNew = githubResult.new + campclawResult.new
    const totalUpdated = githubResult.updated + campclawResult.updated

    // Update crawl log
    if (logEntry) {
      await supabase
        .from('crawl_logs')
        .update({
          skills_found: totalFound,
          skills_new: totalNew,
          skills_updated: totalUpdated,
          status: 'success',
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id)
    }

    return NextResponse.json({
      success: true,
      github: githubResult,
      aidb: aidbResult,
      campclaw: campclawResult,
      completed_at: new Date().toISOString(),
    })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    console.error('Crawl error:', err)

    if (logEntry) {
      await supabase
        .from('crawl_logs')
        .update({
          status: 'error',
          error_message: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', logEntry.id)
    }

    return NextResponse.json({ error: 'Crawl failed', details: errorMessage }, { status: 500 })
  }
}
