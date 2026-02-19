# ClawCamp — Build Prompt for AI Agent

You are building **ClawCamp**, a vector-embedded skill intelligence engine for the OpenClaw ecosystem. This is a real product that needs to be deployed and functional. Read the PRD at `docs/PRD.md` for full specifications.

---

## WHAT YOU ARE BUILDING

A Next.js 15 web application with four capabilities:
1. **Semantic search** — users type natural language, get ranked OpenClaw skills via vector similarity
2. **Skill comparison** — side-by-side breakdown of 2-5 skills with similarity scoring
3. **Trending feed** — what's new and popular in the OpenClaw ecosystem
4. **AIDB content linking** — every skill links to related AI Daily Brief podcast episodes and training

Plus an **OpenClaw skill file** (`SKILL.md`) that connects any OpenClaw agent to the ClawCamp API.

---

## TECH STACK (NON-NEGOTIABLE)

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router, TypeScript) |
| Database | Supabase (PostgreSQL + pgvector extension) |
| Embeddings | OpenAI `text-embedding-3-small` (1536 dimensions) |
| UI | Tailwind CSS v4 + shadcn/ui |
| Hosting | Vercel |
| Cron | Vercel Cron (daily skill crawl) |

---

## BUILD ORDER (FOLLOW THIS SEQUENCE)

### Step 1: Project Initialization

```bash
npx create-next-app@latest clawcamp --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd clawcamp
```

Install dependencies:
```bash
npm install @supabase/supabase-js openai
npx shadcn@latest init
```

Set up environment variables in `.env.local`:
```
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
CRON_SECRET=
```

### Step 2: Database Schema

Create a new Supabase project. Enable the pgvector extension:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Then create all three tables:

```sql
-- Skills table with vector embeddings
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  full_instructions TEXT,
  tools_used TEXT[] DEFAULT '{}',
  triggers TEXT[] DEFAULT '{}',
  source_url TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL CHECK (source_type IN ('clawhub', 'github', 'manual')),
  author TEXT,
  embedding VECTOR(1536),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 0,
  is_new BOOLEAN DEFAULT TRUE,
  raw_skill_md TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON skills USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_skills_first_seen ON skills (first_seen_at DESC);
CREATE INDEX idx_skills_mentions ON skills (mention_count DESC);
CREATE INDEX idx_skills_source_url ON skills (source_url);

-- AIDB content table for podcast episodes, training, newsletters
CREATE TABLE aidb_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('podcast', 'training', 'newsletter')),
  description TEXT,
  url TEXT NOT NULL UNIQUE,
  embedding VECTOR(1536),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON aidb_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);

-- Crawl logs for monitoring
CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  skills_found INTEGER DEFAULT 0,
  skills_new INTEGER DEFAULT 0,
  skills_updated INTEGER DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('success', 'error', 'running')),
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

Create a Supabase SQL function for vector similarity search:

```sql
CREATE OR REPLACE FUNCTION search_skills(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.5,
  match_count INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  tools_used TEXT[],
  triggers TEXT[],
  source_url TEXT,
  source_type TEXT,
  author TEXT,
  first_seen_at TIMESTAMPTZ,
  mention_count INTEGER,
  is_new BOOLEAN,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.description,
    s.tools_used,
    s.triggers,
    s.source_url,
    s.source_type,
    s.author,
    s.first_seen_at,
    s.mention_count,
    s.is_new,
    1 - (s.embedding <=> query_embedding) AS similarity
  FROM skills s
  WHERE 1 - (s.embedding <=> query_embedding) > match_threshold
  ORDER BY s.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

CREATE OR REPLACE FUNCTION match_aidb_content(
  query_embedding VECTOR(1536),
  match_count INT DEFAULT 3
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  content_type TEXT,
  description TEXT,
  url TEXT,
  published_at TIMESTAMPTZ,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.title,
    c.content_type,
    c.description,
    c.url,
    c.published_at,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM aidb_content c
  WHERE c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Step 3: Core Utilities

Create these utility files:

**`src/lib/supabase/server.ts`** — Server-side Supabase client using service role key (for API routes):
```typescript
import { createClient } from '@supabase/supabase-js'

export function createServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}
```

**`src/lib/supabase/client.ts`** — Browser-side Supabase client using anon key:
```typescript
import { createClient } from '@supabase/supabase-js'

export function createBrowserClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

**`src/lib/embeddings.ts`** — OpenAI embedding generation:
```typescript
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text.slice(0, 8000), // token limit safety
  })
  return response.data[0].embedding
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  // Batch in chunks of 100
  const results: number[][] = []
  for (let i = 0; i < texts.length; i += 100) {
    const batch = texts.slice(i, i + 100)
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: batch.map(t => t.slice(0, 8000)),
    })
    results.push(...response.data.map(d => d.embedding))
  }
  return results
}
```

**`src/lib/skill-parser.ts`** — Parse SKILL.md files:
```typescript
export interface ParsedSkill {
  name: string
  description: string
  fullInstructions: string
  toolsUsed: string[]
  triggers: string[]
  rawContent: string
}

export function parseSkillMd(content: string): ParsedSkill {
  const rawContent = content

  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/)
  let name = 'Unknown'
  let description = ''

  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1]
    const nameMatch = frontmatter.match(/name:\s*(.+)/)
    const descMatch = frontmatter.match(/description:\s*(.+)/)
    if (nameMatch) name = nameMatch[1].trim().replace(/^["']|["']$/g, '')
    if (descMatch) description = descMatch[1].trim().replace(/^["']|["']$/g, '')
    content = content.slice(frontmatterMatch[0].length)
  }

  const fullInstructions = content.trim()

  // Extract tools mentioned (common patterns)
  const toolPatterns = /(?:tools?|using|requires?|integrates?):\s*[`"]?(\w[\w-]*)[`"]?/gi
  const toolsUsed: string[] = []
  let toolMatch
  while ((toolMatch = toolPatterns.exec(fullInstructions)) !== null) {
    toolsUsed.push(toolMatch[1].toLowerCase())
  }

  // Extract trigger phrases
  const triggerPatterns = /(?:trigger|when user (?:says?|asks?|types?)|activate when).*?[""`]([^""`]+)[""`]/gi
  const triggers: string[] = []
  let triggerMatch
  while ((triggerMatch = triggerPatterns.exec(fullInstructions)) !== null) {
    triggers.push(triggerMatch[1].toLowerCase())
  }

  return { name, description, fullInstructions, toolsUsed, triggers, rawContent }
}

export function buildEmbeddingText(skill: ParsedSkill): string {
  const parts = [skill.name, skill.description]
  if (skill.fullInstructions) {
    parts.push(skill.fullInstructions.slice(0, 500))
  }
  return parts.filter(Boolean).join(' | ')
}
```

### Step 4: Ingestion Pipeline

**`src/lib/crawlers/github.ts`** — Crawl awesome-openclaw-skills repo:

This should:
1. Use GitHub API (or raw fetch) to get the README.md of `VoltAgent/awesome-openclaw-skills`
2. Parse all skill links from the README
3. For each link that points to a SKILL.md or repo, fetch the SKILL.md content
4. Parse with `parseSkillMd()`
5. Generate embedding with `buildEmbeddingText()` → `generateEmbedding()`
6. Upsert to `skills` table (dedupe on `source_url`)

**`src/lib/crawlers/aidb-content.ts`** — Ingest AIDB podcast episodes:

This should:
1. Fetch the AIDB podcast RSS feed (find it from Apple Podcasts or the site)
2. Parse XML → extract title, description, link, pubDate for each episode
3. Generate embedding from `{title} | {description}`
4. Upsert to `aidb_content` table (dedupe on `url`)

**`src/app/api/crawl/route.ts`** — Crawl endpoint:
```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Verify CRON_SECRET
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Run crawlers, log results
  // ... invoke github crawler, aidb content crawler
  // ... log to crawl_logs table

  return NextResponse.json({ success: true })
}
```

**IMPORTANT:** Also create a **seed script** at `src/scripts/seed.ts` that can be run manually via `npx tsx src/scripts/seed.ts` to do the initial data population. This is critical for getting data in fast without waiting for the cron.

### Step 5: API Routes

Build all four API endpoints as specified in the PRD:

**`src/app/api/skills/search/route.ts`**
- Extract `q`, `limit`, `offset` from search params
- Generate embedding for `q`
- Call `search_skills` RPC function
- For each result, call `match_aidb_content` with the skill's embedding to get related AIDB content
- Return JSON response

**`src/app/api/skills/compare/route.ts`**
- Extract `ids` from search params (comma-separated)
- Fetch all skills by ID
- Calculate pairwise cosine similarity from stored embeddings (do this in JS, not SQL)
- Analyze tools_used and triggers for overlap
- Find AIDB content matching the average embedding of all skills
- Return structured comparison JSON

**`src/app/api/skills/trending/route.ts`**
- Extract `window`, `sort`, `limit` from search params
- Build query with time window filter
- For `hot` sort: calculate composite score as `mention_count * (1 / days_since_first_seen)`
- Include AIDB content for top results
- Return JSON

**`src/app/api/skills/[id]/route.ts`**
- Fetch skill by ID
- Get related AIDB content via `match_aidb_content`
- Get similar skills via vector search using this skill's embedding
- Return full detail JSON

### Step 6: Web UI

**Design system:**
- Background: `#0a0a0a` (near black)
- Primary accent: `#00ff41` (matrix green)
- Secondary text: `#888888`
- Card backgrounds: `#111111` with `border: 1px solid #1a1a1a`
- Fonts: `JetBrains Mono` or `Fira Code` for headers/data, system sans-serif for body
- Green glow effect on hover: `box-shadow: 0 0 20px rgba(0, 255, 65, 0.1)`

**Layout (`src/app/layout.tsx`):**
- Dark theme wrapper
- Header: "CLAWCAMP" in monospace + navigation links + search bar
- Footer: "Powered by AIDB" + link to install OpenClaw skill

**Home page (`src/app/page.tsx`):**
- Server component that fetches trending data
- Two-column grid: "Trending This Week" and "Just Landed"
- Each card: skill name (green monospace), description, mention count or "New" badge, AIDB content link
- Click card → `/skills/[id]`

**Search page (`src/app/search/page.tsx`):**
- Client component with search input (debounced, 300ms)
- Calls `/api/skills/search?q=...` on submit
- Results list with relevance score badge (percentage)
- Each result shows AIDB content link if available
- Empty state: "Type to search 5,700+ OpenClaw skills"

**Skill detail page (`src/app/skills/[id]/page.tsx`):**
- Server component
- Hero section: skill name + source badge + author
- Description section
- Metadata grid: tools, triggers, first seen date, mention count
- "Related from AIDB" section: cards linking to podcast episodes / training
- "Similar Skills" section: horizontal scroll of skill cards with similarity %
- "Compare with..." button

**Compare page (`src/app/compare/page.tsx`):**
- Client component, reads `?ids=` from search params
- Fetches comparison data from `/api/skills/compare`
- Similarity score displayed large at top
- Side-by-side columns for each skill
- Shared/unique features highlighted
- AIDB content section at bottom

### Step 7: OpenClaw Skill File

Create `openclaw-skill/SKILL.md` at the project root with the content specified in the PRD section 7.2.

Update the API base URL in the skill file to match the actual Vercel deployment URL.

### Step 8: Deployment

1. Push to GitHub
2. Connect repo to Vercel
3. Set all environment variables in Vercel dashboard
4. Add `vercel.json` for cron configuration:
```json
{
  "crons": [
    {
      "path": "/api/crawl",
      "schedule": "0 6 * * *"
    }
  ]
}
```
5. Deploy
6. Run seed script to populate initial data
7. Verify all endpoints work
8. Verify UI loads and searches function

---

## CRITICAL REQUIREMENTS

1. **IT MUST BE DEPLOYED AND WORKING.** A broken deploy is worse than no deploy. Test every endpoint after deploy.

2. **The seed script is non-negotiable.** Without data, the app is an empty shell. The seed must populate at minimum 50-100 skills with real embeddings so the demo is convincing.

3. **AIDB content links must work.** If we can't get the RSS feed working, manually seed 10-15 real AIDB podcast episodes with titles and URLs. The AIDB content flywheel is what makes this more than just another search engine.

4. **The terminal aesthetic must be consistent.** Dark background, green accents, monospace data. This matches the AIDB brand and shows attention to their ecosystem.

5. **The OpenClaw skill file must be syntactically correct.** Follow the OpenClaw SKILL.md format exactly — YAML frontmatter with `name` and `description`, then markdown body.

6. **Error handling on all API routes.** Return proper HTTP status codes, never crash on bad input. A 500 error in the demo kills the application.

7. **Loading states on all UI pages.** Skeleton loaders or spinners. Empty states with helpful text. The app should never show a blank white page.

8. **Mobile responsive.** The terminal aesthetic should scale. Don't use fixed widths. Test on mobile viewport.

---

## FILE STRUCTURE

```
clawcamp/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout, dark theme, header/footer
│   │   ├── page.tsx                # Home: trending feed
│   │   ├── search/
│   │   │   └── page.tsx            # Search results page
│   │   ├── skills/
│   │   │   └── [id]/
│   │   │       └── page.tsx        # Skill detail page
│   │   ├── compare/
│   │   │   └── page.tsx            # Compare view
│   │   └── api/
│   │       ├── crawl/
│   │       │   └── route.ts        # Cron crawl endpoint
│   │       └── skills/
│   │           ├── search/
│   │           │   └── route.ts    # Semantic search
│   │           ├── trending/
│   │           │   └── route.ts    # Trending feed
│   │           ├── compare/
│   │           │   └── route.ts    # Skill comparison
│   │           └── [id]/
│   │               └── route.ts    # Skill detail
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── server.ts           # Server Supabase client
│   │   │   └── client.ts           # Browser Supabase client
│   │   ├── embeddings.ts           # OpenAI embedding utilities
│   │   ├── skill-parser.ts         # SKILL.md parser
│   │   └── crawlers/
│   │       ├── github.ts           # GitHub repo crawler
│   │       └── aidb-content.ts     # AIDB RSS/content crawler
│   ├── components/
│   │   ├── ui/                     # shadcn/ui components
│   │   ├── skill-card.tsx          # Reusable skill card
│   │   ├── aidb-content-link.tsx   # AIDB content display component
│   │   ├── search-bar.tsx          # Search input component
│   │   ├── comparison-table.tsx    # Side-by-side comparison
│   │   ├── trending-grid.tsx       # Trending skills grid
│   │   └── similarity-badge.tsx    # Percentage similarity display
│   ├── scripts/
│   │   └── seed.ts                 # Manual seed script
│   └── types/
│       └── index.ts                # TypeScript type definitions
├── openclaw-skill/
│   └── SKILL.md                    # OpenClaw skill file for distribution
├── docs/
│   ├── PRD.md                      # This PRD
│   └── AGENT-PROMPT.md             # This file
├── vercel.json                     # Cron config
├── .env.local                      # Environment variables (git ignored)
└── README.md                       # Project overview with screenshots
```

---

## TYPES

Define these in `src/types/index.ts`:

```typescript
export interface Skill {
  id: string
  name: string
  description: string | null
  full_instructions: string | null
  tools_used: string[]
  triggers: string[]
  source_url: string
  source_type: 'clawhub' | 'github' | 'manual'
  author: string | null
  first_seen_at: string
  last_crawled_at: string
  mention_count: number
  is_new: boolean
  raw_skill_md: string | null
}

export interface SkillSearchResult extends Skill {
  relevance_score: number
  aidb_content: AidbContentMatch | null
}

export interface AidbContent {
  id: string
  title: string
  content_type: 'podcast' | 'training' | 'newsletter'
  description: string | null
  url: string
  published_at: string | null
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
```

---

## FINAL CHECKLIST BEFORE DECLARING DONE

- [ ] `npm run build` succeeds with zero errors
- [ ] Deployed to Vercel with working URL
- [ ] Database has 50+ real skills with embeddings
- [ ] Database has 10+ real AIDB podcast episodes
- [ ] `/` loads and shows trending skills
- [ ] Search works: type a query, get relevant results
- [ ] Skill detail pages load with AIDB content links
- [ ] Compare page works with 2 skill IDs
- [ ] All AIDB content links point to real URLs
- [ ] OpenClaw SKILL.md file is in the repo
- [ ] Mobile responsive — no horizontal scroll on small screens
- [ ] No console errors in browser
- [ ] All API endpoints return proper JSON (no 500s)
- [ ] README exists with project description
