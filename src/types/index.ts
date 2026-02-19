export interface Skill {
  id: string
  name: string
  description: string | null
  full_instructions: string | null
  tools_used: string[]
  triggers: string[]
  source_url: string
  source_type: 'clawhub' | 'github' | 'manual' | 'campclaw' | 'x_twitter' | 'rss'
  author: string | null
  first_seen_at: string
  last_crawled_at: string
  mention_count: number
  is_new: boolean
  raw_skill_md: string | null
  category: 'getting_started' | 'building_agents' | 'multi_agent' | 'security' | 'real_builds' | 'aidb_episodes' | 'community_submitted' | 'uncategorized'
  upvote_count: number
}

export interface SkillSearchResult extends Skill {
  relevance_score: number
  aidb_content: AidbContentMatch | null
}

export interface AidbContent {
  id: string
  title: string
  content_type: 'podcast' | 'training' | 'newsletter' | 'intel' | 'program'
  description: string | null
  url: string
  published_at: string | null
  transcript: string | null
  youtube_video_id: string | null
}

export interface AidbContentMatch extends AidbContent {
  relevance_score: number
}

export interface SkillComparison {
  skills: Skill[]
  similarity_matrix: Record<string, number>
  shared_tools: string[]
  shared_triggers: string[]
  unique_features: Record<string, {
    unique_tools: string[]
    unique_triggers: string[]
  }>
  aidb_content: AidbContentMatch[]
}

export interface TrendingSkill extends Skill {
  hot_score: number
  aidb_content: AidbContentMatch | null
}

export interface CrawlLog {
  id: string
  source: string
  skills_found: number
  skills_new: number
  skills_updated: number
  status: 'success' | 'error' | 'running'
  error_message: string | null
  started_at: string
  completed_at: string | null
}
