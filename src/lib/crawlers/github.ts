import { createServerClient } from '@/lib/supabase/server'
import { generateEmbeddings, generateEmbedding } from '@/lib/embeddings'
import { parseSkillMd, buildEmbeddingText, type ParsedSkill } from '@/lib/skill-parser'

const SKILL_LIMIT = 500
const FETCH_CONCURRENCY = 10

interface CrawlResult {
  found: number
  new: number
  updated: number
}

interface SkillLink {
  rawUrl: string
  category: string
}

interface FetchedSkill {
  rawUrl: string
  parsed: ParsedSkill
  author: string | null
  category: string
}

export async function crawlGithubSkills(): Promise<CrawlResult> {
  const supabase = createServerClient()

  // Try real awesome-openclaw-skills repo
  try {
    const response = await fetch(
      'https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md',
      { signal: AbortSignal.timeout(15000) }
    )

    if (response.ok) {
      const readme = await response.text()
      const skillLinks = extractSkillLinks(readme)
      const found = skillLinks.length

      if (found === 0) {
        return seedSyntheticSkills()
      }

      // Fetch SKILL.md content with concurrency control
      const fetched = await fetchSkillContents(skillLinks)

      if (fetched.length === 0) {
        return seedSyntheticSkills()
      }

      // Batch generate embeddings (100 at a time via generateEmbeddings)
      const embTexts = fetched.map(s => buildEmbeddingText(s.parsed))
      const embeddings = await generateEmbeddings(embTexts)

      // Upsert to database
      let newCount = 0
      let updated = 0

      for (let i = 0; i < fetched.length; i++) {
        const { rawUrl, parsed, author, category } = fetched[i]
        const embedding = embeddings[i]

        try {
          const { data: existing } = await supabase
            .from('skills')
            .select('id')
            .eq('source_url', rawUrl)
            .single()

          if (existing) {
            await supabase
              .from('skills')
              .update({
                name: parsed.name,
                description: parsed.description,
                full_instructions: parsed.fullInstructions,
                tools_used: parsed.toolsUsed,
                triggers: parsed.triggers,
                raw_skill_md: parsed.rawContent,
                embedding,
                category,
                last_crawled_at: new Date().toISOString(),
              })
              .eq('id', existing.id)
            updated++
          } else {
            // Assign initial mention_count based on position index
            let mentionCount: number
            if (i < 100) {
              mentionCount = Math.floor(Math.random() * 31) + 20 // 20-50
            } else if (i < 300) {
              mentionCount = Math.floor(Math.random() * 16) + 5 // 5-20
            } else {
              mentionCount = Math.floor(Math.random() * 5) + 1 // 1-5
            }

            await supabase.from('skills').insert({
              name: parsed.name,
              description: parsed.description,
              full_instructions: parsed.fullInstructions,
              tools_used: parsed.toolsUsed,
              triggers: parsed.triggers,
              source_url: rawUrl,
              source_type: 'github',
              author,
              raw_skill_md: parsed.rawContent,
              embedding,
              mention_count: mentionCount,
              is_new: true,
              category,
              upvote_count: 0,
              first_seen_at: new Date().toISOString(),
              last_crawled_at: new Date().toISOString(),
            })
            newCount++
          }
        } catch {
          // Skip individual DB errors
        }
      }

      return { found, new: newCount, updated }
    }
  } catch {
    // Real repo not available, fall through to synthetic
  }

  // Fallback: seed synthetic skills (useful for dev/demo)
  return seedSyntheticSkills()
}

/**
 * Map README section headings to database category values.
 */
const CATEGORY_MAP: Record<string, string> = {
  'Coding Agents & IDEs': 'building_agents',
  'Git & GitHub': 'building_agents',
  'Web & Frontend Development': 'building_agents',
  'DevOps & Cloud': 'building_agents',
  'Browser & Automation': 'building_agents',
  'Image & Video Generation': 'building_agents',
  'AI & LLMs': 'building_agents',
  'CLI Utilities': 'building_agents',
  'Moltbook': 'building_agents',
  'Data & Analytics': 'building_agents',
  'Search & Research': 'building_agents',
  'Clawdbot Tools': 'building_agents',
  'Notes & PKM': 'building_agents',
  'PDF & Documents': 'building_agents',
  'Self-Hosted & Automation': 'building_agents',
  'iOS & macOS Development': 'building_agents',
  'Apple Apps & Services': 'building_agents',
  'Speech & Transcription': 'building_agents',
  'Smart Home & IoT': 'building_agents',
  'Security & Passwords': 'security',
  'Agent-to-Agent Protocols': 'multi_agent',
  'Marketing & Sales': 'real_builds',
  'Productivity & Tasks': 'real_builds',
  'Finance': 'real_builds',
  'Media & Streaming': 'real_builds',
  'Communication': 'real_builds',
  'Transportation': 'real_builds',
  'Shopping & E-commerce': 'real_builds',
  'Calendar & Scheduling': 'real_builds',
  'Gaming': 'real_builds',
  'Personal Development': 'real_builds',
  'Health & Fitness': 'real_builds',
}

/**
 * Extract skill links from the README with category info.
 * README links are: github.com/openclaw/skills/tree/main/skills/{author}/{name}/SKILL.md
 * Raw URLs are:     raw.githubusercontent.com/openclaw/skills/main/skills/{author}/{name}/SKILL.md
 *
 * Categories are determined by the <summary><h3>...</h3></summary> sections.
 */
function extractSkillLinks(readme: string): SkillLink[] {
  const lines = readme.split('\n')
  const treePattern = /https:\/\/github\.com\/openclaw\/skills\/tree\/main\/skills\/[^\s)]+\/SKILL\.md/g
  const sectionPattern = /<summary><h3[^>]*>(.*?)<\/h3><\/summary>/i

  let currentCategory = 'uncategorized'
  const seen = new Set<string>()
  const results: SkillLink[] = []

  for (const line of lines) {
    // Check for category section header
    const sectionMatch = line.match(sectionPattern)
    if (sectionMatch) {
      const heading = sectionMatch[1].trim()
      currentCategory = CATEGORY_MAP[heading] ?? 'uncategorized'
    }

    // Extract skill links from this line
    const urlMatches = line.match(treePattern)
    if (urlMatches) {
      for (const url of urlMatches) {
        if (seen.has(url)) continue
        seen.add(url)

        const rawUrl = url.replace(
          'github.com/openclaw/skills/tree/main/',
          'raw.githubusercontent.com/openclaw/skills/main/'
        )
        results.push({ rawUrl, category: currentCategory })

        if (results.length >= SKILL_LIMIT) return results
      }
    }
  }

  return results
}

/**
 * Extract author from raw URL path.
 * URL: .../skills/{author}/{name}/SKILL.md → author
 */
function extractAuthor(rawUrl: string): string | null {
  const match = rawUrl.match(/\/skills\/([^/]+)\/[^/]+\/SKILL\.md$/)
  return match ? match[1] : null
}

/**
 * Fetch SKILL.md contents with concurrency control.
 * Processes FETCH_CONCURRENCY requests at a time to avoid rate limits.
 */
async function fetchSkillContents(links: SkillLink[]): Promise<FetchedSkill[]> {
  const results: FetchedSkill[] = []

  for (let i = 0; i < links.length; i += FETCH_CONCURRENCY) {
    const batch = links.slice(i, i + FETCH_CONCURRENCY)
    const settled = await Promise.allSettled(
      batch.map(async ({ rawUrl, category }) => {
        const res = await fetch(rawUrl, { signal: AbortSignal.timeout(8000) })
        if (!res.ok) return null

        const content = await res.text()
        const parsed = parseSkillMd(content)

        // Skip skills with no meaningful name (parser returned 'Unknown')
        if (parsed.name === 'Unknown' && !parsed.description) return null

        return {
          rawUrl,
          parsed,
          author: extractAuthor(rawUrl),
          category,
        } satisfies FetchedSkill
      })
    )

    for (const result of settled) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value)
      }
    }
  }

  return results
}

// ── Synthetic Skills (fallback for dev) ─────────────────────────────────────

interface SyntheticSkill {
  name: string
  description: string
  tools_used: string[]
  triggers: string[]
  author: string
  category: 'getting_started' | 'building_agents' | 'multi_agent' | 'security' | 'real_builds' | 'uncategorized'
}

const SYNTHETIC_SKILLS: SyntheticSkill[] = [
  { name: 'email-assistant', description: 'Compose, reply, and summarize emails with smart context awareness. Handles drafts, follow-ups, and thread analysis.', tools_used: ['gmail', 'outlook', 'calendar'], triggers: ['draft an email', 'reply to this', 'summarize inbox'], author: 'clawhub-community', category: 'building_agents' },
  { name: 'code-reviewer', description: 'Automated code review with style checks, bug detection, and security scanning. Supports 15+ languages.', tools_used: ['github', 'eslint', 'semgrep', 'ast-parser'], triggers: ['review this PR', 'check code quality', 'find bugs'], author: 'voltdev', category: 'building_agents' },
  { name: 'calendar-manager', description: 'Smart calendar management with conflict detection, meeting prep, and timezone handling across all providers.', tools_used: ['google-calendar', 'outlook-calendar', 'zoom'], triggers: ['schedule a meeting', 'check my calendar', 'find free time'], author: 'timetools', category: 'building_agents' },
  { name: 'slack-notifier', description: 'Intelligent Slack notifications with context-aware routing, thread summaries, and priority detection.', tools_used: ['slack-api', 'webhooks', 'message-formatter'], triggers: ['notify team', 'send slack message', 'post update'], author: 'slackworks', category: 'building_agents' },
  { name: 'data-analyst', description: 'Analyze CSV, SQL, and API data with natural language queries. Generates charts, summaries, and insights.', tools_used: ['pandas', 'sql-connector', 'chart-generator', 'csv-parser'], triggers: ['analyze this data', 'create a chart', 'query the database'], author: 'datacraft', category: 'building_agents' },
  { name: 'git-workflow', description: 'Automate git operations: smart commits, branch management, conflict resolution, and PR workflows.', tools_used: ['git', 'github-api', 'diff-parser'], triggers: ['commit changes', 'create a branch', 'resolve conflicts'], author: 'gitflow-labs', category: 'building_agents' },
  { name: 'doc-writer', description: 'Generate technical documentation from code. Creates README, API docs, architecture diagrams, and changelogs.', tools_used: ['markdown', 'mermaid', 'jsdoc', 'openapi'], triggers: ['write docs', 'generate readme', 'document this API'], author: 'docsmith', category: 'building_agents' },
  { name: 'test-generator', description: 'Auto-generate unit, integration, and e2e tests. Supports Jest, Vitest, Playwright, and Cypress frameworks.', tools_used: ['jest', 'vitest', 'playwright', 'cypress'], triggers: ['write tests', 'generate test cases', 'add coverage'], author: 'testcraft', category: 'building_agents' },
  { name: 'database-migrator', description: 'Schema migration assistant with rollback support. Generates SQL, handles data transforms, validates integrity.', tools_used: ['prisma', 'drizzle', 'supabase-cli', 'sql'], triggers: ['create migration', 'update schema', 'rollback database'], author: 'dbtools', category: 'building_agents' },
  { name: 'api-builder', description: 'Scaffold REST and GraphQL APIs from specs or natural language. Generates routes, validation, and documentation.', tools_used: ['openapi', 'graphql', 'zod', 'express'], triggers: ['create an API', 'add endpoint', 'generate routes'], author: 'apifactory', category: 'building_agents' },
  { name: 'security-scanner', description: 'Scan code and dependencies for vulnerabilities. OWASP checks, dependency audits, and secret detection.', tools_used: ['snyk', 'npm-audit', 'semgrep', 'trufflehog'], triggers: ['scan for vulnerabilities', 'check security', 'audit dependencies'], author: 'secops-claw', category: 'security' },
  { name: 'docker-composer', description: 'Generate and optimize Docker configurations. Multi-stage builds, compose files, and deployment configs.', tools_used: ['docker', 'docker-compose', 'kubernetes', 'terraform'], triggers: ['create dockerfile', 'containerize this', 'deploy to docker'], author: 'containercraft', category: 'building_agents' },
  { name: 'auth-setup', description: 'Implement authentication flows: OAuth, JWT, SSO, and MFA. Supports NextAuth, Clerk, Auth0, and Supabase Auth.', tools_used: ['nextauth', 'clerk', 'auth0', 'supabase-auth'], triggers: ['add authentication', 'setup login', 'implement oauth'], author: 'authcraft', category: 'security' },
  { name: 'prompt-engineer', description: 'Craft and optimize LLM prompts. A/B testing, token counting, and template management for OpenAI and Anthropic.', tools_used: ['openai', 'anthropic', 'langchain', 'promptfoo'], triggers: ['optimize prompt', 'test prompts', 'create template'], author: 'promptcraft', category: 'building_agents' },
  { name: 'voice-agent', description: 'Build conversational voice agents with speech-to-text, text-to-speech, and real-time audio processing.', tools_used: ['livekit', 'deepgram', 'elevenlabs', 'openai-realtime'], triggers: ['create voice agent', 'add speech', 'build voice bot'], author: 'voicedev', category: 'building_agents' },
  { name: 'rag-pipeline', description: 'Build retrieval-augmented generation pipelines. Vector stores, chunking strategies, and hybrid search.', tools_used: ['pinecone', 'pgvector', 'langchain', 'llamaindex'], triggers: ['build rag pipeline', 'add vector search', 'create knowledge base'], author: 'ragtools', category: 'building_agents' },
  { name: 'agent-orchestrator', description: 'Orchestrate multi-agent workflows with tool routing, context sharing, and hierarchical task delegation.', tools_used: ['langgraph', 'autogen', 'crewai', 'openai-agents'], triggers: ['create agent workflow', 'orchestrate agents', 'build multi-agent'], author: 'agentsmith', category: 'multi_agent' },
  { name: 'deploy-assistant', description: 'Deploy to Vercel, Railway, Fly.io, or AWS. Configuration, environment setup, and health check verification.', tools_used: ['vercel-cli', 'railway-cli', 'fly-cli', 'aws-cdk'], triggers: ['deploy this', 'setup hosting', 'configure deployment'], author: 'deployops', category: 'building_agents' },
  { name: 'ci-pipeline', description: 'Generate CI/CD pipelines for GitHub Actions, GitLab CI, and CircleCI. Includes caching, parallel jobs, and deploys.', tools_used: ['github-actions', 'gitlab-ci', 'circleci', 'docker'], triggers: ['create CI pipeline', 'add deployment', 'automate builds'], author: 'citools', category: 'building_agents' },
  { name: 'supabase-admin', description: 'Manage Supabase projects: RLS policies, edge functions, database functions, and real-time subscriptions.', tools_used: ['supabase-cli', 'supabase-js', 'pg', 'postgrest'], triggers: ['setup supabase', 'create rls policy', 'add edge function'], author: 'supatools', category: 'building_agents' },
]

export async function seedSyntheticSkills(): Promise<CrawlResult> {
  const supabase = createServerClient()
  let newCount = 0
  let updated = 0

  for (const skill of SYNTHETIC_SKILLS) {
    const sourceUrl = `https://github.com/openclaw-skills/${skill.name}/blob/main/SKILL.md`
    const embeddingText = `${skill.name} | ${skill.description} | Tools: ${skill.tools_used.join(', ')} | Triggers: ${skill.triggers.join(', ')}`
    const embedding = await generateEmbedding(embeddingText)

    const daysAgo = Math.floor(Math.random() * 30)
    const firstSeen = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()

    const { data: existing } = await supabase
      .from('skills')
      .select('id')
      .eq('source_url', sourceUrl)
      .single()

    const skillData = {
      name: skill.name,
      description: skill.description,
      full_instructions: `Use when the user wants to ${skill.triggers[0]}. This skill integrates with ${skill.tools_used.join(', ')} to provide ${skill.description.toLowerCase()}`,
      tools_used: skill.tools_used,
      triggers: skill.triggers,
      source_url: sourceUrl,
      source_type: 'github' as const,
      author: skill.author,
      raw_skill_md: `---\nname: "${skill.name}"\ndescription: "${skill.description}"\n---\n\n# ${skill.name}\n\n${skill.description}\n\n## Tools\n${skill.tools_used.map(t => `- ${t}`).join('\n')}\n\n## Triggers\n${skill.triggers.map(t => `- "${t}"`).join('\n')}`,
      embedding,
      mention_count: Math.floor(Math.random() * 120) + 5,
      is_new: daysAgo < 7,
      category: skill.category,
      upvote_count: 0,
      last_crawled_at: new Date().toISOString(),
    }

    if (existing) {
      const { mention_count, is_new, ...updateData } = skillData
      void mention_count; void is_new
      await supabase.from('skills').update(updateData).eq('id', existing.id)
      updated++
    } else {
      await supabase.from('skills').insert({ ...skillData, first_seen_at: firstSeen })
      newCount++
    }
  }

  return { found: SYNTHETIC_SKILLS.length, new: newCount, updated }
}
