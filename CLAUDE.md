# ClawCamp

Vector-embedded skill intelligence engine for the OpenClaw ecosystem. Crawls, indexes, and semantically searches 5,700+ OpenClaw skills — linking every interaction to AIDB content (podcasts, training, newsletters).

**Live:** https://clawcamp.vercel.app
**Docs:** `docs/PRD.md` (product spec), `docs/AGENT-PROMPT.md` (build instructions)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript strict) |
| Database | Supabase PostgreSQL + pgvector (1536-dim embeddings) |
| Embeddings | OpenAI `text-embedding-3-small` |
| UI | Tailwind CSS v4 + shadcn/ui (new-york) + Lucide icons |
| Hosting | Vercel (free tier) |
| Transcripts | Playwright via Chrome CDP (port 9222) |

## Quick Commands

```bash
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build (catches type errors)
npm run lint         # ESLint
supabase start       # Start local Supabase (ports 54321/54322/54323)
supabase db reset    # Reset DB, run migrations + seed.sql
supabase migration new <name>  # Create new migration
```

## Environment Variables

Required in `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from supabase start>
SUPABASE_SERVICE_ROLE_KEY=<from supabase start>
OPENAI_API_KEY=<openai key>
CRON_SECRET=<any secret string>
```

## Project Structure

```
src/
├── app/
│   ├── page.tsx                          # Home: bookmarks + trending feed
│   ├── compare/page.tsx                  # Skill comparison (client)
│   ├── skills/[id]/page.tsx              # Skill detail (server)
│   └── api/
│       ├── skills/search/route.ts        # GET: vector similarity search
│       ├── skills/trending/route.ts      # GET: trending/new/mentions
│       ├── skills/compare/route.ts       # GET: pairwise comparison
│       ├── skills/[id]/route.ts          # GET: skill detail + related
│       ├── crawl/route.ts                # POST: daily ingestion cron
│       └── transcripts/enrich/route.ts   # POST: YouTube transcript enrichment
├── lib/
│   ├── supabase/server.ts                # Service role client (API routes)
│   ├── supabase/client.ts                # Anon key client (browser)
│   ├── embeddings.ts                     # generateEmbedding(), generateEmbeddings()
│   ├── install.ts                        # OpenClaw install command generation
│   ├── skill-parser.ts                   # parseSkillMd() YAML+markdown extraction
│   └── crawlers/
│       ├── github.ts                     # awesome-openclaw-skills crawler
│       ├── aidb-content.ts               # Podcast RSS feed parser
│       ├── campclaw-resources.ts         # CampClaw resource imports
│       └── youtube-transcripts.ts        # Chrome CDP transcript scraping
├── components/
│   ├── ui/                               # shadcn/ui primitives (don't edit directly)
│   ├── global-search.tsx                 # Header search input + dropdown overlay
│   ├── skill-card.tsx                    # Reusable skill card with bookmark
│   ├── install-button.tsx                # OpenClaw install popover (CLI commands)
│   ├── bookmark-button.tsx               # Star/bookmark toggle (icon + full variants)
│   ├── bookmarked-skills.tsx             # "My Skills" section on home page
│   ├── skill-instructions.tsx            # Expandable full instructions display
│   ├── trending-grid.tsx                 # Grid layout for skill lists
│   ├── mobile-nav.tsx                    # Mobile navigation menu
│   ├── similarity-badge.tsx              # Similarity score display
│   └── aidb-content-link.tsx             # Podcast/training content link
├── hooks/
│   └── use-bookmarks.ts                  # localStorage bookmark hook (cross-tab sync)
├── types/index.ts                        # All TypeScript interfaces
└── scripts/
    ├── seed.ts                           # Manual data population
    └── enrich-batch.ts                   # Batch transcript enrichment

supabase/
├── migrations/                           # 5 migrations (schema + indexes)
├── seed.sql                              # Full data dump (23MB, gitignored)
└── config.toml                           # Local dev config

openclaw-skill/
└── SKILL.md                              # Installable OpenClaw skill for API access
```

## Database Schema

**3 tables**, all in `public` schema:

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `skills` | 5,700+ OpenClaw skills | name, description, full_instructions, tools_used[], triggers[], embedding, source_url, mention_count, category |
| `aidb_content` | Podcasts, training, newsletters | title, content_type, url, embedding, transcript, youtube_video_id |
| `crawl_logs` | Ingestion audit trail | source, skills_found, status, started_at |

**RPC functions:**
- `search_skills(query_embedding, match_threshold, match_count)` — cosine similarity search
- `match_aidb_content(query_embedding, match_count)` — AIDB content matching

**Indexes:** IVFFlat on both embedding columns (skills: lists=100, aidb_content: lists=20)

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/skills/search?q=&limit=&offset=` | Public | Semantic search (max 500 char query) |
| GET | `/api/skills/trending?window=&sort=&limit=` | Public | Trending feed |
| GET | `/api/skills/compare?ids=,` | Public | Side-by-side comparison |
| GET | `/api/skills/[id]` | Public | Skill detail + related content |
| POST | `/api/crawl` | `Bearer CRON_SECRET` | Daily ingestion (Vercel cron 6AM UTC) |
| POST | `/api/transcripts/enrich?limit=&refresh=` | `Bearer CRON_SECRET` | YouTube transcript enrichment |

## Design System

- **Warm theme** — Cream background with forest green accents and salmon primary
- **Dark header** — Forest green header with light nav links
- **Fonts** — Geist Mono (headers/data), Geist (body)
- **Background** — Warm cream `#f4efe5`
- **Primary** — Salmon `#d4764a`
- **Brand** — Forest green `#3a5c42`
- **Cards** — Light warm `#ede7db` with subtle warm glow on hover

## Seed Data

`supabase/seed.sql` contains a full pg_dump of all 3 tables (skills, aidb_content, crawl_logs). Runs automatically on `supabase db reset`. This includes:
- 175 podcast episodes with transcripts + embeddings
- All crawled skills with embeddings
- Crawl history logs

**Note:** seed.sql is 23MB due to embedding vectors. Gitignored — obtain from team or regenerate via crawl.

## Transcript Pipeline

Episodes are enriched with YouTube transcripts via Chrome CDP:
1. `playlist-videos.json` maps 966 AIDB YouTube videos (videoId + title)
2. Fuzzy title matching connects episodes to videos (word overlap >= 50%)
3. Playwright opens each video, clicks "Show transcript", scrapes text
4. Transcripts stored in `aidb_content.transcript`, re-embedded with transcript content

**To run manually:** Requires Chrome with `--remote-debugging-port=9222`
```bash
npx tsx src/scripts/enrich-batch.ts --limit=200
```

## MUST DO

- Always use `createServerClient()` from `@/lib/supabase/server` in API routes (service role)
- Always use `createBrowserClient()` from `@/lib/supabase/client` in client components (anon key)
- Run `npm run build` before claiming changes work — catches TypeScript errors
- Keep `AidbContent` and `Skill` types in `src/types/index.ts` in sync with DB schema
- When adding columns to DB: create migration, update types, update all API routes that construct those types
- Use `generateEmbedding()` from `@/lib/embeddings.ts` — never instantiate OpenAI client inline
- Protect POST endpoints with `CRON_SECRET` bearer token check (fail-closed if env var missing)
- Sanitize all external URLs before rendering in `href` attributes (must start with `https://`)
- Sanitize skill names/authors before interpolating into CLI install commands

## MUST NOT

- Do NOT use `import 'dotenv/config'` — it won't load `.env.local`. Use `config({ path: '.env.local' })` from dotenv
- Do NOT edit `src/components/ui/` files directly — these are shadcn/ui primitives managed by `npx shadcn add`
- Do NOT store secrets in `NEXT_PUBLIC_*` env vars — only Supabase URL and anon key are public
- Do NOT assign the same `youtube_video_id` to multiple episodes — use strict 1:1 matching
- Do NOT skip the embedding step when updating transcripts — stale embeddings break search relevance
- Do NOT add auth — this is a read-only public API by design
- Do NOT commit `.env.local` or `supabase/seed.sql` — both contain sensitive data or are too large
