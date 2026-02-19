# ClawCamp Resource Library — Product Requirements Document

**Version:** 1.0
**Date:** 2026-02-17
**Status:** Ready for build
**Target:** AIDB Clawrchitect application — deployed MVP

---

## 1. Overview

ClawCamp is a vector-embedded skill intelligence engine for the OpenClaw ecosystem. It crawls, indexes, and semantically understands 5,700+ OpenClaw skills, enabling users to discover, compare, and evaluate skills — with every interaction funneling back to AIDB content (podcast episodes, training modules, newsletters).

It ships as two products:
1. **A web application** — browse, search, compare, and discover OpenClaw skills
2. **An OpenClaw skill** — install one skill, get the full intelligence layer inside your agent

### 1.1 Why This Exists

The OpenClaw ecosystem has 5,700+ skills on ClawHub with keyword search only. Users have no way to:
- Semantically search ("find a skill that manages my calendar")
- Compare alternatives side-by-side
- Know what's new or trending
- Connect skill discovery to learning resources

ClawCamp solves all four while driving AIDB engagement metrics (subscribers, signups, enrollments) by linking every skill to related AIDB content.

### 1.2 Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Skills indexed | 5,700+ (full ClawHub corpus) | DB count |
| Search latency | < 500ms p95 | Vercel analytics |
| AIDB content click-through | > 10% of skill detail views | Event tracking |
| OpenClaw skill installs | Tracked via API calls from skill | Request logs |

---

## 2. Target Users

| User | Need | How ClawCamp Helps |
|------|------|-------------------|
| **OpenClaw power user** | Find the right skill among thousands | Semantic search + comparison |
| **OpenClaw newcomer** | Discover what's possible | Trending feed + AIDB learning links |
| **AIDB community member** | Stay current on OpenClaw ecosystem | Trending feed, daily updates |
| **Skill developer** | See how their skill compares to alternatives | Compare view |

---

## 3. Tech Stack

| Component | Technology | Justification |
|-----------|-----------|---------------|
| Framework | Next.js 15 (App Router) | Fast SSR, API routes, Vercel-native |
| Language | TypeScript | Type safety, developer experience |
| Database | Supabase (PostgreSQL + pgvector) | Free tier, pgvector for embeddings, familiar |
| Embeddings | OpenAI `text-embedding-3-small` | Cheap ($0.02/1M tokens), 1536 dimensions, good quality |
| UI | Tailwind CSS v4 + shadcn/ui | Rapid styling, consistent components |
| Hosting | Vercel (free tier) | Zero-config Next.js deployment |
| Cron | Vercel Cron | Daily skill crawl jobs |
| Domain | Vercel preview URL or `clawcamp.dev` | Deploy first, domain later |

### 3.1 Cost Estimate

| Item | Cost |
|------|------|
| Vercel free tier | $0 |
| Supabase free tier (500MB) | $0 |
| OpenAI embeddings (~5,700 skills) | ~$0.50 one-time |
| OpenAI embeddings (daily delta) | ~$0.01/day |
| **Total** | **< $1** |

---

## 4. Data Model

### 4.1 `skills` table

```sql
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  full_instructions TEXT,
  tools_used TEXT[],          -- parsed from SKILL.md
  triggers TEXT[],            -- parsed from SKILL.md
  source_url TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- 'clawhub' | 'github' | 'manual'
  author TEXT,
  embedding VECTOR(1536),
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
  mention_count INTEGER DEFAULT 0,
  is_new BOOLEAN DEFAULT TRUE,  -- true for first 7 days
  raw_skill_md TEXT,            -- original SKILL.md content
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vector similarity search index
CREATE INDEX ON skills USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Trending queries
CREATE INDEX idx_skills_first_seen ON skills (first_seen_at DESC);
CREATE INDEX idx_skills_mentions ON skills (mention_count DESC);
```

### 4.2 `aidb_content` table

```sql
CREATE TABLE aidb_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content_type TEXT NOT NULL,  -- 'podcast' | 'training' | 'newsletter'
  description TEXT,
  url TEXT NOT NULL,
  embedding VECTOR(1536),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ON aidb_content USING ivfflat (embedding vector_cosine_ops) WITH (lists = 20);
```

### 4.3 `crawl_logs` table

```sql
CREATE TABLE crawl_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,           -- 'clawhub' | 'github' | 'rss'
  skills_found INTEGER DEFAULT 0,
  skills_new INTEGER DEFAULT 0,
  skills_updated INTEGER DEFAULT 0,
  status TEXT NOT NULL,           -- 'success' | 'error'
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

---

## 5. API Specification

All endpoints are Next.js API routes under `/api/`.

### 5.1 `GET /api/skills/search`

Semantic search using vector similarity.

**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `q` | string | yes | — | Natural language search query |
| `limit` | number | no | 10 | Max results (1-50) |
| `offset` | number | no | 0 | Pagination offset |

**Process:**
1. Generate embedding for query string using OpenAI
2. Run cosine similarity search against `skills.embedding`
3. For each result, find top AIDB content match by embedding similarity
4. Return ranked results

**Response:**
```json
{
  "results": [
    {
      "id": "uuid",
      "name": "calendar-manager",
      "description": "Manage Google Calendar from OpenClaw",
      "relevance_score": 0.92,
      "tools_used": ["google-calendar"],
      "source_url": "https://clawhub.ai/skills/calendar-manager",
      "first_seen_at": "2026-02-10T00:00:00Z",
      "is_new": true,
      "aidb_content": {
        "title": "Episode 167: Calendar Agents That Work",
        "url": "https://aidailybrief.ai/episodes/167",
        "content_type": "podcast"
      }
    }
  ],
  "total": 42,
  "query": "manage my calendar"
}
```

### 5.2 `GET /api/skills/compare`

Side-by-side comparison of 2-5 skills.

**Query params:**
| Param | Type | Required | Description |
|-------|------|----------|-------------|
| `ids` | string | yes | Comma-separated skill UUIDs (2-5) |

**Process:**
1. Fetch all requested skills
2. Calculate pairwise cosine similarity from stored embeddings
3. Parse tools_used and triggers for overlap analysis
4. Find AIDB content relevant to the skill category (average embedding)
5. Return structured comparison

**Response:**
```json
{
  "skills": [
    {
      "id": "uuid-1",
      "name": "calendar-manager",
      "description": "...",
      "tools_used": ["google-calendar"],
      "triggers": ["schedule meeting", "check calendar"]
    },
    {
      "id": "uuid-2",
      "name": "schedule-assistant",
      "description": "...",
      "tools_used": ["google-calendar", "zoom"],
      "triggers": ["schedule", "book", "cancel"]
    }
  ],
  "similarity_matrix": {
    "uuid-1:uuid-2": 0.87
  },
  "shared_tools": ["google-calendar"],
  "shared_triggers": ["schedule"],
  "unique_features": {
    "uuid-1": { "unique_tools": [], "unique_triggers": ["check calendar"] },
    "uuid-2": { "unique_tools": ["zoom"], "unique_triggers": ["book", "cancel"] }
  },
  "aidb_content": [
    {
      "title": "Episode 167: Calendar Agents That Work",
      "url": "https://aidailybrief.ai/episodes/167",
      "content_type": "podcast"
    }
  ]
}
```

### 5.3 `GET /api/skills/trending`

Freshness and popularity feed.

**Query params:**
| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `window` | string | no | `7d` | Time window: `24h`, `7d`, `30d` |
| `sort` | string | no | `hot` | Sort: `new`, `mentions`, `hot` |
| `limit` | number | no | 20 | Max results |

**Sort logic:**
- `new`: ORDER BY first_seen_at DESC, filtered to window
- `mentions`: ORDER BY mention_count DESC, filtered to window
- `hot`: composite score = `mention_count * recency_weight` where recency_weight decays over time

**Response:**
```json
{
  "skills": [
    {
      "id": "uuid",
      "name": "deepresearch-agent",
      "description": "...",
      "mention_count": 142,
      "first_seen_at": "2026-02-15T00:00:00Z",
      "is_new": true,
      "hot_score": 284,
      "aidb_content": { "..." }
    }
  ],
  "window": "7d",
  "sort": "hot",
  "total": 38
}
```

### 5.4 `GET /api/skills/[id]`

Full skill detail page data.

**Response:**
```json
{
  "skill": {
    "id": "uuid",
    "name": "calendar-manager",
    "description": "...",
    "full_instructions": "...",
    "tools_used": ["google-calendar"],
    "triggers": ["schedule meeting", "check calendar"],
    "source_url": "https://...",
    "source_type": "clawhub",
    "author": "username",
    "first_seen_at": "2026-02-01T00:00:00Z",
    "mention_count": 87,
    "is_new": false
  },
  "related_aidb_content": [
    {
      "title": "Episode 167: Calendar Agents That Work",
      "url": "https://aidailybrief.ai/episodes/167",
      "content_type": "podcast",
      "relevance_score": 0.89
    },
    {
      "title": "Training: Your First OpenClaw Skill",
      "url": "https://aidailybrief.ai/training/first-skill",
      "content_type": "training",
      "relevance_score": 0.76
    }
  ],
  "similar_skills": [
    {
      "id": "uuid-2",
      "name": "schedule-assistant",
      "similarity_score": 0.87
    }
  ]
}
```

### 5.5 `POST /api/crawl` (Protected)

Trigger a crawl job. Called by Vercel Cron. Protected by `CRON_SECRET` env var.

**Headers:** `Authorization: Bearer {CRON_SECRET}`

**Process:**
1. Fetch skills from GitHub awesome-openclaw-skills repo
2. Fetch skills from ClawHub (scrape or API)
3. For new skills: generate embedding, insert row
4. For existing skills: update last_crawled_at, check for changes
5. Update is_new flag (false if first_seen_at > 7 days ago)
6. Log results to crawl_logs

---

## 6. Web UI Pages

### 6.1 Design Direction

Terminal-inspired aesthetic matching AIDB brand:
- Dark background (`#0a0a0a` or similar)
- Green accent color (matrix green `#00ff41` for highlights)
- Monospace font for headers and data
- Sans-serif for body text readability
- Card-based layouts with subtle green borders/glows
- No auth required — fully public read-only

### 6.2 Page Map

| Route | Page | Purpose |
|-------|------|---------|
| `/` | Trending Feed | Home page — trending + just landed skills |
| `/search` | Search Results | Semantic search with results list |
| `/skills/[id]` | Skill Detail | Full skill page with AIDB links |
| `/compare` | Compare View | Side-by-side skill comparison (via query params) |

### 6.3 Page: `/` (Trending Feed)

**Layout:**
- Header: ClawCamp logo/name + search bar
- Two columns: "Trending This Week" (left, larger) and "Just Landed" (right)
- Each skill card shows: name, description snippet, mention count or age, AIDB content link
- Cards are clickable → `/skills/[id]`
- "Compare" checkbox on each card → selecting 2+ shows "Compare Selected" button

### 6.4 Page: `/search`

**Layout:**
- Large search bar at top (auto-focused)
- Results list below with relevance score badge
- Each result: name, description, relevance %, AIDB link
- Skeleton loading state while embedding + search runs

### 6.5 Page: `/skills/[id]`

**Layout:**
- Skill name (h1) + source badge (ClawHub / GitHub)
- Description
- Metadata grid: tools used, triggers, author, first seen date, mention count
- "Related from AIDB" section: 2-3 content cards with links
- "Similar Skills" section: 3-5 cards with similarity %
- "Compare with..." button → pre-selects this skill in compare view

### 6.6 Page: `/compare`

**Layout:**
- URL: `/compare?ids=uuid1,uuid2`
- Overall similarity score at top (large %)
- Side-by-side columns for each skill
- Rows: description, tools, triggers, author, age
- Shared capabilities section (highlighted)
- Unique features section (called out per skill)
- AIDB content relevant to the category at bottom

---

## 7. OpenClaw Skill

### 7.1 Purpose

Distribute ClawCamp's intelligence directly into OpenClaw agents. Any user installs one skill and gets semantic search, comparison, and trending data inside their agent.

### 7.2 Skill File: `SKILL.md`

```markdown
---
name: clawcamp
description: Search, compare, and discover OpenClaw skills from the ClawCamp Resource Library. Find trending skills, compare alternatives, and get AIDB learning resources.
---

# ClawCamp — Skill Intelligence for OpenClaw

You have access to the ClawCamp Resource Library API at https://clawcamp.vercel.app/api (or production domain).

## When to activate this skill

- User asks to find, search for, or discover a skill
- User asks to compare two or more skills
- User asks what's new, trending, or popular in OpenClaw
- User asks for skill recommendations
- User asks "is there a better skill for [X]"

## Available actions

### Search for skills
Make a GET request to: /api/skills/search?q={query}&limit=5
Present results as a numbered list with name, description, and relevance score.
If results include AIDB content, mention it: "AIDB has a related episode: [title](url)"

### Compare skills
First search for the skills by name, then use their IDs.
Make a GET request to: /api/skills/compare?ids={id1},{id2}
Present as a comparison table highlighting shared vs unique capabilities.
Include the similarity percentage.

### Trending skills
Make a GET request to: /api/skills/trending?window=7d&sort=hot&limit=10
Present as a ranked list with name, description, and trending score.
Highlight any skills marked is_new.

### Skill detail
Make a GET request to: /api/skills/{id}
Present full details including related AIDB content and similar skills.

## Response formatting rules
- Always show the skill source URL so users can install it
- Always mention related AIDB content when available — this helps users learn
- Keep responses concise: show top 5 results max unless user asks for more
- For comparisons, use a table format for easy scanning
```

### 7.3 Distribution

- Include in project repo at `/openclaw-skill/SKILL.md`
- Submit to ClawHub registry if submission is open
- Link from the web app footer: "Use ClawCamp in your OpenClaw agent"

---

## 8. Ingestion Pipeline

### 8.1 Data Sources

| Source | Method | Priority |
|--------|--------|----------|
| [awesome-openclaw-skills](https://github.com/VoltAgent/awesome-openclaw-skills) | GitHub API → parse README for skill links → fetch each SKILL.md | Primary |
| ClawHub registry | Scrape listing pages or API if available | Primary |
| AIDB podcast RSS | Parse RSS feed for episode titles + descriptions | Secondary |
| AIDB training pages | Scrape or manual entry | Secondary |

### 8.2 Skill Parsing

For each discovered SKILL.md:
1. Parse YAML frontmatter → extract `name`, `description`
2. Parse markdown body → extract full instructions text
3. Regex/heuristic extraction of tools mentioned
4. Regex/heuristic extraction of trigger phrases
5. Concatenate: `{name} | {description} | {first 500 chars of instructions}`
6. Generate embedding via OpenAI `text-embedding-3-small`
7. Upsert to `skills` table (dedupe by source_url)

### 8.3 AIDB Content Parsing

For podcast episodes (RSS):
1. Parse RSS XML → extract title, description, link, pubDate
2. Concatenate: `{title} | {description}`
3. Generate embedding
4. Insert to `aidb_content` table

### 8.4 Crawl Schedule

```
vercel.json:
{
  "crons": [
    {
      "path": "/api/crawl",
      "schedule": "0 6 * * *"
    }
  ]
}
```

Daily at 6 AM UTC. The `/api/crawl` endpoint is protected by `CRON_SECRET`.

---

## 9. Environment Variables

| Variable | Purpose | Where |
|----------|---------|-------|
| `OPENAI_API_KEY` | Embedding generation | Vercel env |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Vercel env |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase public key | Vercel env |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase admin (for crawl writes) | Vercel env |
| `CRON_SECRET` | Protect crawl endpoint | Vercel env |

---

## 10. Build Phases

### Phase 1: Foundation (Day 1 — first half)
- [ ] Initialize Next.js 15 project with TypeScript
- [ ] Set up Supabase project + enable pgvector extension
- [ ] Create database schema (skills, aidb_content, crawl_logs tables)
- [ ] Set up Supabase client utilities (server + client)
- [ ] Deploy skeleton to Vercel to confirm pipeline works

### Phase 2: Ingestion Pipeline (Day 1 — second half)
- [ ] Build GitHub crawler: fetch awesome-openclaw-skills README, parse skill links
- [ ] Build SKILL.md parser: extract frontmatter + body + tools + triggers
- [ ] Build embedding generator: OpenAI text-embedding-3-small batch processing
- [ ] Build AIDB content ingester: parse podcast RSS feed
- [ ] Build `/api/crawl` endpoint with CRON_SECRET protection
- [ ] Run initial seed: crawl + embed all skills
- [ ] Verify data in Supabase dashboard

### Phase 3: API Layer (Day 2 — first half)
- [ ] `GET /api/skills/search` — embed query, cosine similarity, return ranked
- [ ] `GET /api/skills/trending` — time-windowed, sorted by hot/new/mentions
- [ ] `GET /api/skills/compare` — pairwise similarity + overlap analysis
- [ ] `GET /api/skills/[id]` — full detail + AIDB content matching + similar skills
- [ ] Test all endpoints with curl/Postman

### Phase 4: Web UI (Day 2 — second half)
- [ ] Layout: dark theme, terminal-inspired chrome, green accents
- [ ] Home page (`/`): trending feed + just landed
- [ ] Search page (`/search`): search bar + results with relevance scores
- [ ] Skill detail page (`/skills/[id]`): full info + AIDB links + similar
- [ ] Compare page (`/compare`): side-by-side columns + similarity score
- [ ] Navigation between pages, loading states, empty states

### Phase 5: OpenClaw Skill + Polish (Day 3)
- [ ] Write `SKILL.md` for clawcamp OpenClaw skill
- [ ] Test with local OpenClaw installation
- [ ] Add OG meta tags for social sharing
- [ ] Add Vercel Cron config for daily crawls
- [ ] Final deploy + smoke test all features
- [ ] Write README with screenshots

### Stretch: Skill Overlap Detection (if time permits)
- [ ] Parse tools_used across user's query context
- [ ] Flag skills that share >80% tool overlap
- [ ] Add warning badges to search results and compare view

---

## 11. Non-Goals (Explicitly Out of Scope for MVP)

- User accounts or authentication
- Skill ratings or reviews
- Skill installation from ClawCamp (just link to source)
- Full-text search (only semantic/vector search)
- Mobile-native app
- Social signal crawling (X, Reddit) — just use first_seen_at for trending v1
- Real-time updates (daily crawl is sufficient)
- Analytics dashboard (just track AIDB click-throughs in logs)

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| ClawHub has no public API | Can't crawl skills | Fall back to awesome-openclaw-skills GitHub repo + manual additions |
| OpenAI rate limits during bulk embedding | Slow initial seed | Batch in chunks of 100, add retry logic with backoff |
| Supabase free tier 500MB limit | DB full | Skills + embeddings ≈ 50MB for 5,700 skills — plenty of room |
| AIDB content matching is low quality | Bad recommendations | Manually curate top 20-30 AIDB content pieces first, expand later |
| pgvector IVFFlat index accuracy | Missing relevant results | Use probes=10 for search queries, good enough for 5,700 items |
