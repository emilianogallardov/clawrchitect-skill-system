import { createServerClient } from '@/lib/supabase/server'
import { generateEmbeddings } from '@/lib/embeddings'

interface CrawlResult {
  found: number
  new: number
  updated: number
}

type ResourceCategory = 'getting_started' | 'building_agents' | 'multi_agent' | 'security' | 'real_builds' | 'aidb_episodes' | 'community_submitted'

interface CampClawResource {
  name: string
  description: string
  source_url: string
  category: ResourceCategory
  upvote_count: number
  domain: string
}

// Real resources scraped from campclaw.ai/resources (2026-02-17)
const CAMPCLAW_RESOURCES: CampClawResource[] = [
  // ── GETTING STARTED ───────────────────────────────────────────────
  {
    name: 'The Opus 4.6 Setup Guide: 20+ Articles Synthesized',
    description: 'AI-compiled setup guide covering threat models, installation, Telegram, Docker sandbox, security hardening, and LaunchAgent.',
    source_url: 'https://x.com/witcheer/status/2021610036980543767',
    category: 'getting_started',
    upvote_count: 3,
    domain: 'x.com',
  },
  {
    name: "Matthew Berman's OpenClaw Masterclass",
    description: '30-minute video covering 15+ use cases: personal CRM, idea pipelines, X search, HubSpot, analytics, automations, and memory.',
    source_url: 'https://x.com/MatthewBerman/status/2021669868366598632',
    category: 'getting_started',
    upvote_count: 1,
    domain: 'x.com',
  },
  {
    name: 'The OpenClaw Ecosystem 2026',
    description: 'Full ecosystem map: infrastructure layer, recommended models, channels, skill hub, social platforms, and marketplace.',
    source_url: 'https://x.com/LeoYe_AI/status/2021903008741929410',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Self-Improving Your Agent With Articles',
    description: 'Feed any OpenClaw article to your agent and say "read this and upgrade our setup." Skills install in minutes.',
    source_url: 'https://x.com/AlexFinn/status/2021740954244550839',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'OpenClaw Felt Like Chatting Until I Changed Five Things',
    description: 'Files for personality, memory, heartbeat, skills, and cost optimization. Turns a chatbot into an autonomous agent.',
    source_url: 'https://x.com/tomcrawshaw01/status/2021951399857467820',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'The Ultimate OpenClaw Setup (Point Your Agent Here)',
    description: 'Complete deployment guide: workspace structure, SOUL.md, IDENTITY.md, MEMORY.md, skills, and integration config.',
    source_url: 'https://x.com/austin_hurwitz/status/2023132187466641771',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Official OpenClaw Docs',
    description: 'The primary reference for everything. Installation, configuration, channels, agents, tools, models, deployment.',
    source_url: 'https://docs.openclaw.ai/',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'docs.openclaw.ai',
  },
  {
    name: 'OpenClaw Getting Started Guide',
    description: 'One-liner install, Control UI, onboarding wizard, environment variables. Start here.',
    source_url: 'https://docs.openclaw.ai/start/getting-started',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'docs.openclaw.ai',
  },
  {
    name: 'FreeCodeCamp Full Tutorial for Beginners',
    description: '1-hour video + written guide covering installation, model setup, memory, skills, Docker sandboxing, and security.',
    source_url: 'https://www.freecodecamp.org/news/openclaw-full-tutorial-for-beginners/',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'freecodecamp.org',
  },
  {
    name: 'Codecademy: Installation to First Chat',
    description: 'Step-by-step install, model config, Telegram connection, skills, web search. ~20 minutes.',
    source_url: 'https://www.codecademy.com/article/open-claw-tutorial-installation-to-first-chat-setup',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'codecademy.com',
  },
  {
    name: 'Master OpenClaw in 30 Minutes',
    description: '5 real use cases: calendar management, Google Workspace, personalized briefings, voice replies, cron jobs.',
    source_url: 'https://creatoreconomy.so/p/master-openclaw-in-30-minutes-full-tutorial',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'creatoreconomy.so',
  },
  {
    name: 'How to Set Up on DigitalOcean',
    description: 'Cloud deployment using 1-Click Droplet and App Platform. Good if you don\'t want to run it locally.',
    source_url: 'https://www.digitalocean.com/community/tutorials/how-to-run-openclaw',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'digitalocean.com',
  },
  {
    name: 'GetOpenClaw Managed Hosting',
    description: 'Pre-configured managed instances for people who don\'t want to self-host at all.',
    source_url: 'https://get-open-claw.com/guide/',
    category: 'getting_started',
    upvote_count: 0,
    domain: 'get-open-claw.com',
  },

  // ── BUILDING AGENTS ───────────────────────────────────────────────
  {
    name: 'I Turned My AI Agents Into RPG Characters',
    description: '6-layer role card system: domain, inputs/outputs, definition of done, hard bans, escalation, and metrics. Full code included.',
    source_url: 'https://x.com/Voxyz_ai/status/2021370776926990530',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Email Automation for OpenClaw',
    description: 'Resend API integration for dedicated email. No inbox exposure, no OAuth tokens — just an API key and a verified domain.',
    source_url: 'https://x.com/zenorocha/status/2023047169326846102',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Solving Memory for OpenClaw & General Agents',
    description: 'ClawVault: markdown files with YAML frontmatter beat specialized memory tools by 5.5% on LoCoMo benchmarks.',
    source_url: 'https://x.com/sillydarket/status/2022394007448429004',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Give Your ClawdBot a Voice (ClawdTalk)',
    description: 'Real phone calls over telephony infrastructure. Sub-200ms latency, inbound + outbound, SMS support. 5-minute setup.',
    source_url: 'https://x.com/hasantoxr/status/2022287018110443852',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'OpenClaw GitHub Repository',
    description: 'The source code. 191k+ stars, MIT license. This is where the framework lives.',
    source_url: 'https://github.com/openclaw/openclaw',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'github.com',
  },
  {
    name: 'OpenClaw Agent Configuration Guide',
    description: 'How to set up SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md.',
    source_url: 'https://docs.openclaw.ai/agents',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'docs.openclaw.ai',
  },
  {
    name: 'Awesome-OpenClaw-Skills',
    description: "Curated list of skills from ClawHub. Browse what's already built before building your own.",
    source_url: 'https://github.com/VoltAgent/awesome-openclaw-skills',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'github.com',
  },
  {
    name: 'Awesome-OpenClaw',
    description: 'Comprehensive community resource list for everything OpenClaw.',
    source_url: 'https://github.com/rohitg00/awesome-openclaw',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'github.com',
  },
  {
    name: 'Build Your AI Agent Army in 60 Minutes',
    description: 'Installation, interfaces (Web UI/TUI/desktop), skills, ClawHub, cron jobs, multi-agent, VPS, security — the whole sweep.',
    source_url: 'https://atalupadhyay.wordpress.com/2026/02/08/openclaw-build-your-ai-agent-army-in-60-minutes/',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'wordpress.com',
  },
  {
    name: 'Stop Watching Install Tutorials — How to Actually Tame It',
    description: 'Advanced guide on getting past basic setup into real configuration and management.',
    source_url: 'https://medium.com/activated-thinker/stop-watching-openclaw-install-tutorials-this-is-how-you-actually-tame-it-f3416f5d80bc',
    category: 'building_agents',
    upvote_count: 0,
    domain: 'medium.com',
  },

  // ── MULTI-AGENT ───────────────────────────────────────────────────
  {
    name: 'I Gave My OpenClaw Agents One Shared Brain',
    description: 'Shared-context directory with 38 files symlinked across 3 agents. Priorities, KPIs, feedback, and roundtable synthesis.',
    source_url: 'https://x.com/ibab/status/2023167888140746965',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Training OpenClaw to Work as a Team',
    description: 'Antfarm: open-source tool that divides OpenClaw into a planner, developer, verifier, tester, and reviewer. Zero infra.',
    source_url: 'https://x.com/twistartups/status/2022729932183417088',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'The Lobster Internet: 8 Phases of OpenClawification',
    description: 'From hackers-at-home to cloud claws, multi-model orchestration, verticalized bundles, outcome-based pricing, and personal agent layers.',
    source_url: 'https://x.com/gregisenberg/status/2023077800152838389',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'How I Built an Autonomous AI Agent Team That Runs 24/7',
    description: '6 named agents with distinct roles, SOUL.md files, and real cost breakdowns.',
    source_url: 'https://x.com/Saboo_Shubham_/status/2022014147450614038',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Multi-Agent Routing (Official)',
    description: 'Isolated agents with separate workspaces, channel routing, multi-account WhatsApp. The official docs on running multiple agents.',
    source_url: 'https://docs.openclaw.ai/concepts/multi-agent',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'docs.openclaw.ai',
  },
  {
    name: 'Antfarm: Multi-Agent Orchestration',
    description: 'Deterministic multi-agent workflows using YAML configuration. Bundled workflows for feature-dev (7 agents), security-audit (7 agents), bug-fix (6 agents).',
    source_url: 'https://www.antfarm.cool/',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'antfarm.cool',
  },
  {
    name: 'Antfarm GitHub',
    description: 'The source code. MIT-licensed TypeScript CLI.',
    source_url: 'https://github.com/snarktank/antfarm',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'github.com',
  },
  {
    name: 'Convex Multi-Agent Command Center',
    description: '10 agents coordinated via shared Convex database, Kanban boards, agent-to-agent communication.',
    source_url: 'https://www.convex.dev/claw',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'convex.dev',
  },
  {
    name: 'Run Multiple AI Agents With Elastic Scaling',
    description: 'Production multi-agent deployment on DigitalOcean with declarative config, elastic scaling, cost control.',
    source_url: 'https://www.digitalocean.com/blog/openclaw-digitalocean-app-platform',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'digitalocean.com',
  },
  {
    name: 'Proposal for Multimodal Multi-Agent System',
    description: 'Technical architecture for coordinated multi-agent systems with voice, text, and visual modalities.',
    source_url: 'https://medium.com/@gwrx2005/proposal-for-a-multimodal-multi-agent-system-using-openclaw-81f5e4488233',
    category: 'multi_agent',
    upvote_count: 0,
    domain: 'medium.com',
  },

  // ── SECURITY ──────────────────────────────────────────────────────
  {
    name: 'What Security Teams Need to Know (CrowdStrike)',
    description: "Enterprise security analysis from CrowdStrike. The authoritative overview of what's at stake.",
    source_url: 'https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/',
    category: 'security',
    upvote_count: 6,
    domain: 'crowdstrike.com',
  },
  {
    name: 'Security-First Setup Guide (Habr)',
    description: 'Local install, gateway hardening, Telegram integration, file operations. Read this before you deploy anything public-facing.',
    source_url: 'https://habr.com/en/articles/992720/',
    category: 'security',
    upvote_count: 3,
    domain: 'habr.com',
  },
  {
    name: 'How to Harden OpenClaw Security: 3-Tier Guide',
    description: 'Actual commands and configurations for security hardening. Practical, not theoretical.',
    source_url: 'https://aimaker.substack.com/p/openclaw-security-hardening-guide',
    category: 'security',
    upvote_count: 1,
    domain: 'substack.com',
  },
  {
    name: 'New OpenClaw Beta: Security Hardening Release',
    description: 'v2026.2.13 — 650 commits, 50K lines added, 36K deleted. Security hardening across 1,119 files. Update to beta now.',
    source_url: 'https://x.com/steipete/status/2022873106646249482',
    category: 'security',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'Security-First Setup Commands',
    description: 'Tailscale, command allowlists, read-only tokens, SSH hardening. Copy-paste ready.',
    source_url: 'https://gist.github.com/jordanlyall/8b9e566c1ee0b74db05e43f119ef4df4',
    category: 'security',
    upvote_count: 0,
    domain: 'gist.github.com',
  },
  {
    name: "OpenClaw AI Assistant Is a 'Privacy Nightmare'",
    description: 'Academic expert analysis of security and privacy risks. Know what you\'re getting into.',
    source_url: 'https://news.northeastern.edu/2026/02/10/open-claw-ai-assistant/',
    category: 'security',
    upvote_count: 0,
    domain: 'northeastern.edu',
  },

  // ── REAL BUILDS ───────────────────────────────────────────────────
  {
    name: 'After Installing OpenClaw for 50 Teammates: 5 Things I Learned',
    description: 'Cloud deployment killed install friction but exposed collaboration pain. Shared skills, SOUL files, and ADHD-friendly ops.',
    source_url: 'https://x.com/Team9_ai/status/2020846025418916052',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'OpenClaw in Slack: From Chatbot to Full Workflow Engine',
    description: 'MCP + API integrations, reusable skills, SOUL file governance. Sales team generates ROI spreadsheets and pitch decks from chat.',
    source_url: 'https://x.com/anothercohen/status/2023134773418610767',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'OpenClaw for Business Setup (That Scales Revenue)',
    description: 'pSEO ($45K of work in 20 min), copywriting ($50K in 15 min), agent squads, deal manufacturing, and CRM-connected deal finder.',
    source_url: 'https://x.com/ericosiu/status/2021249104710598785',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'x.com',
  },
  {
    name: 'What People Are Actually Doing With OpenClaw: 25+ Use Cases',
    description: 'Step-by-step tutorials covering email automation, business operations, development workflows, content production, and home automation.',
    source_url: 'https://www.forwardfuture.ai/p/what-people-are-actually-doing-with-openclaw-25-use-cases',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'forwardfuture.ai',
  },
  {
    name: 'I Spent $47 Testing OpenClaw for a Week',
    description: 'Honest review: email cleanup wins, code review failures, API cost breakdown. Useful for calibrating expectations.',
    source_url: 'https://medium.com/@likhitkumarvp/i-spent-47-testing-openclaw-for-a-week-heres-what-s-actually-happening-c274dc26a3fd',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'medium.com',
  },
  {
    name: 'OpenClaw Is Changing My Life',
    description: "Developer managing entire project lifecycle via phone chat. A good picture of what's possible when it's working well.",
    source_url: 'https://reorx.com/blog/openclaw-is-changing-my-life/',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'reorx.com',
  },
  {
    name: '"Hello" From My OpenClaw Agent',
    description: "Commercial real estate professional's firsthand setup experience. Good non-developer perspective.",
    source_url: 'https://chatcre.substack.com/p/hello-from-tophers-openclaw-ai-agent',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'substack.com',
  },
  {
    name: 'My Experience With OpenClaw (Refactoring)',
    description: '2-week in-depth report comparing it to the iPhone — a combination of existing capabilities that adds up to something new.',
    source_url: 'https://refactoring.fm/p/my-experience-with-openclaw',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'refactoring.fm',
  },
  {
    name: '160,000 Developers Building Digital Employees',
    description: 'Real stories: car negotiation ($4,200 saved), iMessage malfunction (500 unwanted messages). The highs and the lows.',
    source_url: 'https://natesnewsletter.substack.com/p/what-3-weeks-inside-the-moltbot-openclaw',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'substack.com',
  },
  {
    name: 'How to Get Set Up in an Afternoon',
    description: 'Pre-install decisions: hardware, accounts, phone numbers, WhatsApp, Tailscale. Good for planning before you start.',
    source_url: 'https://amankhan1.substack.com/p/how-to-get-clawdbotmoltbotopenclaw',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'substack.com',
  },
  {
    name: 'OpenClaw AI Review 2026: 30-Day Test',
    description: 'Email triage, lead research, code snippets, model switching, cost analysis over a full month.',
    source_url: 'https://freerdps.com/blog/openclaw-ai-review/',
    category: 'real_builds',
    upvote_count: 0,
    domain: 'freerdps.com',
  },

  // ── AIDB EPISODES ─────────────────────────────────────────────────
  {
    name: 'AIDB: How I Built My 10 Agent Team With OpenClaw',
    description: "An overview of NLW's OpenClaw setup",
    source_url: 'https://youtu.be/HzVYgpMxMLE',
    category: 'aidb_episodes',
    upvote_count: 1,
    domain: 'youtu.be',
  },
  {
    name: 'AIDB: How to Learn AI With AI',
    description: 'A look at the "AI Build-partner-coach" approach',
    source_url: 'https://youtu.be/eFpyRtRyu3k',
    category: 'aidb_episodes',
    upvote_count: 0,
    domain: 'youtu.be',
  },
]

export async function crawlCampclawResources(): Promise<CrawlResult> {
  const supabase = createServerClient()
  let newCount = 0
  let updated = 0

  const texts = CAMPCLAW_RESOURCES.map(r => `${r.name} | ${r.description} | Category: ${r.category.replace(/_/g, ' ')}`)
  const embeddings = await generateEmbeddings(texts)

  for (let i = 0; i < CAMPCLAW_RESOURCES.length; i++) {
    const resource = CAMPCLAW_RESOURCES[i]
    const embedding = embeddings[i]

    const { data: existing } = await supabase
      .from('skills')
      .select('id')
      .eq('source_url', resource.source_url)
      .single()

    const skillData = {
      name: resource.name,
      description: resource.description,
      full_instructions: null,
      tools_used: [],
      triggers: [],
      source_url: resource.source_url,
      source_type: 'campclaw' as const,
      author: resource.domain,
      raw_skill_md: null,
      embedding,
      mention_count: resource.upvote_count,
      is_new: false,
      category: resource.category,
      upvote_count: resource.upvote_count,
      last_crawled_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase
        .from('skills')
        .update(skillData)
        .eq('id', existing.id)
      updated++
    } else {
      await supabase.from('skills').insert({
        ...skillData,
        first_seen_at: new Date().toISOString(),
      })
      newCount++
    }
  }

  return { found: CAMPCLAW_RESOURCES.length, new: newCount, updated }
}
