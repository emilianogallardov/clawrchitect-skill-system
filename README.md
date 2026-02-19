# ClawCamp

Vector-embedded skill intelligence engine for the [OpenClaw](https://openclaw.ai) ecosystem. Search, discover, compare, and install 5,700+ OpenClaw skills with semantic search powered by pgvector embeddings.

**Live:** [clawcamp.vercel.app](https://clawcamp.vercel.app)

## Features

- **Semantic Search** — Find skills by meaning, not just keywords, powered by OpenAI `text-embedding-3-small` and pgvector cosine similarity
- **Trending Feed** — Hot skills ranked by velocity (mentions / age), filterable by time window
- **Skill Detail** — Full instructions, tools used, triggers, related AIDB content, and similar skills
- **Side-by-Side Comparison** — Compare 2-5 skills with shared/unique tool analysis and similarity scores
- **One-Click Install** — Copy `openclaw skills install` commands directly from any skill page
- **Bookmarks** — Star skills to build a personal collection (localStorage, no account required)
- **AIDB Integration** — Every skill links to related podcasts, training, and newsletters from the AI Development Base
- **OpenClaw Skill** — Ships with an installable OpenClaw skill (`openclaw-skill/SKILL.md`) so your AI assistant can search ClawCamp's API

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript strict) |
| Database | Supabase PostgreSQL + pgvector (1536-dim embeddings) |
| Embeddings | OpenAI `text-embedding-3-small` |
| UI | Tailwind CSS v4 + shadcn/ui (new-york) + Lucide icons |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 22+
- [Supabase CLI](https://supabase.com/docs/guides/cli) (`brew install supabase/tap/supabase`)
- [OpenAI API key](https://platform.openai.com/api-keys) (for embeddings)

### Setup

```bash
# Clone and install
git clone https://github.com/YOUR_USERNAME/clawcamp.git
cd clawcamp
npm install

# Start local Supabase
supabase start

# Create env file
cp .env.example .env.local
# Fill in the values from `supabase start` output + your OpenAI key

# Run migrations and seed data
supabase db reset

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

See `.env.example` for all required variables:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (safe to expose) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable key with RLS (safe to expose) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `OPENAI_API_KEY` | OpenAI API key for generating embeddings (server-only) |
| `CRON_SECRET` | Bearer token protecting crawl/enrich endpoints (server-only) |

## API

All GET endpoints are public. POST endpoints require `Authorization: Bearer <CRON_SECRET>`.

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/skills/search?q=&limit=&offset=` | Semantic skill search |
| GET | `/api/skills/trending?window=&sort=&limit=` | Trending feed |
| GET | `/api/skills/compare?ids=,` | Side-by-side comparison |
| GET | `/api/skills/[id]` | Skill detail + related content |
| POST | `/api/crawl` | Daily ingestion cron (6 AM UTC) |
| POST | `/api/transcripts/enrich` | YouTube transcript enrichment |

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home: bookmarks + trending feed
│   ├── compare/page.tsx            # Skill comparison
│   ├── skills/[id]/page.tsx        # Skill detail
│   └── api/                        # All API routes
├── components/
│   ├── ui/                         # shadcn/ui primitives
│   ├── global-search.tsx           # Header search with dropdown
│   ├── skill-card.tsx              # Reusable skill card
│   ├── install-button.tsx          # OpenClaw install popover
│   ├── bookmark-button.tsx         # Star/bookmark toggle
│   └── ...
├── hooks/
│   └── use-bookmarks.ts            # localStorage bookmark state
├── lib/
│   ├── install.ts                  # Install command generation
│   ├── embeddings.ts               # OpenAI embedding helpers
│   ├── skill-parser.ts             # SKILL.md parser
│   └── crawlers/                   # GitHub, AIDB, CampClaw crawlers
├── types/index.ts                  # All TypeScript interfaces
└── scripts/                        # Seed and enrichment scripts

supabase/
├── migrations/                     # Database schema
├── seed.sql                        # Full data dump (gitignored, 23MB)
└── config.toml                     # Local dev config

openclaw-skill/
└── SKILL.md                        # Installable OpenClaw skill
```

## Database

Three tables in Supabase PostgreSQL with pgvector:

- **`skills`** — 5,700+ OpenClaw skills with 1536-dim embeddings
- **`aidb_content`** — Podcasts, training, newsletters with embeddings
- **`crawl_logs`** — Ingestion audit trail

RPC functions: `search_skills()` and `match_aidb_content()` for cosine similarity search with IVFFlat indexes.

## Crawl Pipeline

Runs daily at 6 AM UTC via Vercel Cron (`vercel.json`):

1. **GitHub crawler** — Scrapes `awesome-openclaw-skills` README for skill links, fetches and parses each SKILL.md
2. **AIDB crawler** — Parses podcast RSS feeds for episodes, training content, and newsletters
3. **CampClaw crawler** — Imports curated resources from the CampClaw ecosystem

## License

MIT
