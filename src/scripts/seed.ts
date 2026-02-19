import { config } from 'dotenv'
import { resolve } from 'path'

// Load env vars from .env.local
config({ path: resolve(process.cwd(), '.env.local') })

import { createClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const openaiKey = process.env.OPENAI_API_KEY!

if (!supabaseUrl || !supabaseKey || !openaiKey) {
  console.error('Missing required environment variables:')
  if (!supabaseUrl) console.error('  - NEXT_PUBLIC_SUPABASE_URL')
  if (!supabaseKey) console.error('  - SUPABASE_SERVICE_ROLE_KEY')
  if (!openaiKey) console.error('  - OPENAI_API_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)
const openai = new OpenAI({ apiKey: openaiKey })

// ─── Real CampClaw Resources (scraped 2026-02-17) ─────────────────────────

type ResourceCategory = 'getting_started' | 'building_agents' | 'multi_agent' | 'security' | 'real_builds' | 'aidb_episodes' | 'community_submitted' | 'uncategorized'

interface ResourceSeed {
  name: string
  description: string
  source_url: string
  source_type: 'campclaw' | 'github'
  category: ResourceCategory
  upvote_count: number
  author: string
}

const CAMPCLAW_RESOURCES: ResourceSeed[] = [
  // Getting Started
  { name: 'The Opus 4.6 Setup Guide: 20+ Articles Synthesized', description: 'AI-compiled setup guide covering threat models, installation, Telegram, Docker sandbox, security hardening, and LaunchAgent.', source_url: 'https://x.com/witcheer/status/2021610036980543767', source_type: 'campclaw', category: 'getting_started', upvote_count: 3, author: 'x.com' },
  { name: "Matthew Berman's OpenClaw Masterclass", description: '30-minute video covering 15+ use cases: personal CRM, idea pipelines, X search, HubSpot, analytics, automations, and memory.', source_url: 'https://x.com/MatthewBerman/status/2021669868366598632', source_type: 'campclaw', category: 'getting_started', upvote_count: 1, author: 'x.com' },
  { name: 'The OpenClaw Ecosystem 2026', description: 'Full ecosystem map: infrastructure layer, recommended models, channels, skill hub, social platforms, and marketplace.', source_url: 'https://x.com/LeoYe_AI/status/2021903008741929410', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'x.com' },
  { name: 'Self-Improving Your Agent With Articles', description: 'Feed any OpenClaw article to your agent and say "read this and upgrade our setup." Skills install in minutes.', source_url: 'https://x.com/AlexFinn/status/2021740954244550839', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'x.com' },
  { name: 'OpenClaw Felt Like Chatting Until I Changed Five Things', description: 'Files for personality, memory, heartbeat, skills, and cost optimization. Turns a chatbot into an autonomous agent.', source_url: 'https://x.com/tomcrawshaw01/status/2021951399857467820', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'x.com' },
  { name: 'The Ultimate OpenClaw Setup (Point Your Agent Here)', description: 'Complete deployment guide: workspace structure, SOUL.md, IDENTITY.md, MEMORY.md, skills, and integration config.', source_url: 'https://x.com/austin_hurwitz/status/2023132187466641771', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'x.com' },
  { name: 'Official OpenClaw Docs', description: 'The primary reference for everything. Installation, configuration, channels, agents, tools, models, deployment.', source_url: 'https://docs.openclaw.ai/', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'docs.openclaw.ai' },
  { name: 'OpenClaw Getting Started Guide', description: 'One-liner install, Control UI, onboarding wizard, environment variables. Start here.', source_url: 'https://docs.openclaw.ai/start/getting-started', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'docs.openclaw.ai' },
  { name: 'FreeCodeCamp Full Tutorial for Beginners', description: '1-hour video + written guide covering installation, model setup, memory, skills, Docker sandboxing, and security.', source_url: 'https://www.freecodecamp.org/news/openclaw-full-tutorial-for-beginners/', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'freecodecamp.org' },
  { name: 'Codecademy: Installation to First Chat', description: 'Step-by-step install, model config, Telegram connection, skills, web search. ~20 minutes.', source_url: 'https://www.codecademy.com/article/open-claw-tutorial-installation-to-first-chat-setup', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'codecademy.com' },
  { name: 'Master OpenClaw in 30 Minutes', description: '5 real use cases: calendar management, Google Workspace, personalized briefings, voice replies, cron jobs.', source_url: 'https://creatoreconomy.so/p/master-openclaw-in-30-minutes-full-tutorial', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'creatoreconomy.so' },
  { name: 'How to Set Up on DigitalOcean', description: 'Cloud deployment using 1-Click Droplet and App Platform.', source_url: 'https://www.digitalocean.com/community/tutorials/how-to-run-openclaw', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'digitalocean.com' },
  { name: 'GetOpenClaw Managed Hosting', description: "Pre-configured managed instances for people who don't want to self-host at all.", source_url: 'https://get-open-claw.com/guide/', source_type: 'campclaw', category: 'getting_started', upvote_count: 0, author: 'get-open-claw.com' },
  // Building Agents
  { name: 'I Turned My AI Agents Into RPG Characters', description: '6-layer role card system: domain, inputs/outputs, definition of done, hard bans, escalation, and metrics. Full code included.', source_url: 'https://x.com/Voxyz_ai/status/2021370776926990530', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'x.com' },
  { name: 'Email Automation for OpenClaw', description: 'Resend API integration for dedicated email. No inbox exposure, no OAuth tokens.', source_url: 'https://x.com/zenorocha/status/2023047169326846102', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'x.com' },
  { name: 'Solving Memory for OpenClaw & General Agents', description: 'ClawVault: markdown files with YAML frontmatter beat specialized memory tools by 5.5% on LoCoMo benchmarks.', source_url: 'https://x.com/sillydarket/status/2022394007448429004', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'x.com' },
  { name: 'Give Your ClawdBot a Voice (ClawdTalk)', description: 'Real phone calls over telephony infrastructure. Sub-200ms latency, inbound + outbound, SMS support. 5-minute setup.', source_url: 'https://x.com/hasantoxr/status/2022287018110443852', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'x.com' },
  { name: 'OpenClaw GitHub Repository', description: 'The source code. 191k+ stars, MIT license.', source_url: 'https://github.com/openclaw/openclaw', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'github.com' },
  { name: 'OpenClaw Agent Configuration Guide', description: 'How to set up SOUL.md, AGENTS.md, USER.md, TOOLS.md, MEMORY.md, HEARTBEAT.md.', source_url: 'https://docs.openclaw.ai/agents', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'docs.openclaw.ai' },
  { name: 'Awesome-OpenClaw-Skills', description: "Curated list of skills from ClawHub. Browse what's already built before building your own.", source_url: 'https://github.com/VoltAgent/awesome-openclaw-skills', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'github.com' },
  { name: 'Awesome-OpenClaw', description: 'Comprehensive community resource list for everything OpenClaw.', source_url: 'https://github.com/rohitg00/awesome-openclaw', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'github.com' },
  { name: 'Build Your AI Agent Army in 60 Minutes', description: 'Installation, interfaces (Web UI/TUI/desktop), skills, ClawHub, cron jobs, multi-agent, VPS, security.', source_url: 'https://atalupadhyay.wordpress.com/2026/02/08/openclaw-build-your-ai-agent-army-in-60-minutes/', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'wordpress.com' },
  { name: 'Stop Watching Install Tutorials — How to Actually Tame It', description: 'Advanced guide on getting past basic setup into real configuration and management.', source_url: 'https://medium.com/activated-thinker/stop-watching-openclaw-install-tutorials-this-is-how-you-actually-tame-it-f3416f5d80bc', source_type: 'campclaw', category: 'building_agents', upvote_count: 0, author: 'medium.com' },
  // Multi-Agent
  { name: 'I Gave My OpenClaw Agents One Shared Brain', description: 'Shared-context directory with 38 files symlinked across 3 agents. Priorities, KPIs, feedback, and roundtable synthesis.', source_url: 'https://x.com/ibab/status/2023167888140746965', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'x.com' },
  { name: 'Training OpenClaw to Work as a Team', description: 'Antfarm: open-source tool that divides OpenClaw into a planner, developer, verifier, tester, and reviewer.', source_url: 'https://x.com/twistartups/status/2022729932183417088', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'x.com' },
  { name: 'The Lobster Internet: 8 Phases of OpenClawification', description: 'From hackers-at-home to cloud claws, multi-model orchestration, verticalized bundles, outcome-based pricing.', source_url: 'https://x.com/gregisenberg/status/2023077800152838389', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'x.com' },
  { name: 'How I Built an Autonomous AI Agent Team That Runs 24/7', description: '6 named agents with distinct roles, SOUL.md files, and real cost breakdowns.', source_url: 'https://x.com/Saboo_Shubham_/status/2022014147450614038', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'x.com' },
  { name: 'Multi-Agent Routing (Official)', description: 'Isolated agents with separate workspaces, channel routing, multi-account WhatsApp.', source_url: 'https://docs.openclaw.ai/concepts/multi-agent', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'docs.openclaw.ai' },
  { name: 'Antfarm: Multi-Agent Orchestration', description: 'Deterministic multi-agent workflows using YAML configuration. Feature-dev (7 agents), security-audit (7 agents), bug-fix (6 agents).', source_url: 'https://www.antfarm.cool/', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'antfarm.cool' },
  { name: 'Antfarm GitHub', description: 'The source code. MIT-licensed TypeScript CLI.', source_url: 'https://github.com/snarktank/antfarm', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'github.com' },
  { name: 'Convex Multi-Agent Command Center', description: '10 agents coordinated via shared Convex database, Kanban boards, agent-to-agent communication.', source_url: 'https://www.convex.dev/claw', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'convex.dev' },
  { name: 'Run Multiple AI Agents With Elastic Scaling', description: 'Production multi-agent deployment on DigitalOcean with declarative config, elastic scaling, cost control.', source_url: 'https://www.digitalocean.com/blog/openclaw-digitalocean-app-platform', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'digitalocean.com' },
  { name: 'Proposal for Multimodal Multi-Agent System', description: 'Technical architecture for coordinated multi-agent systems with voice, text, and visual modalities.', source_url: 'https://medium.com/@gwrx2005/proposal-for-a-multimodal-multi-agent-system-using-openclaw-81f5e4488233', source_type: 'campclaw', category: 'multi_agent', upvote_count: 0, author: 'medium.com' },
  // Security
  { name: 'What Security Teams Need to Know (CrowdStrike)', description: "Enterprise security analysis from CrowdStrike. The authoritative overview of what's at stake.", source_url: 'https://www.crowdstrike.com/en-us/blog/what-security-teams-need-to-know-about-openclaw-ai-super-agent/', source_type: 'campclaw', category: 'security', upvote_count: 6, author: 'crowdstrike.com' },
  { name: 'Security-First Setup Guide (Habr)', description: 'Local install, gateway hardening, Telegram integration, file operations. Read this before you deploy anything public-facing.', source_url: 'https://habr.com/en/articles/992720/', source_type: 'campclaw', category: 'security', upvote_count: 3, author: 'habr.com' },
  { name: 'How to Harden OpenClaw Security: 3-Tier Guide', description: 'Actual commands and configurations for security hardening. Practical, not theoretical.', source_url: 'https://aimaker.substack.com/p/openclaw-security-hardening-guide', source_type: 'campclaw', category: 'security', upvote_count: 1, author: 'substack.com' },
  { name: 'New OpenClaw Beta: Security Hardening Release', description: 'v2026.2.13 — 650 commits, 50K lines added, 36K deleted. Security hardening across 1,119 files.', source_url: 'https://x.com/steipete/status/2022873106646249482', source_type: 'campclaw', category: 'security', upvote_count: 0, author: 'x.com' },
  { name: 'Security-First Setup Commands', description: 'Tailscale, command allowlists, read-only tokens, SSH hardening. Copy-paste ready.', source_url: 'https://gist.github.com/jordanlyall/8b9e566c1ee0b74db05e43f119ef4df4', source_type: 'campclaw', category: 'security', upvote_count: 0, author: 'gist.github.com' },
  { name: "OpenClaw AI Assistant Is a 'Privacy Nightmare'", description: 'Academic expert analysis of security and privacy risks.', source_url: 'https://news.northeastern.edu/2026/02/10/open-claw-ai-assistant/', source_type: 'campclaw', category: 'security', upvote_count: 0, author: 'northeastern.edu' },
  // Real Builds
  { name: 'After Installing OpenClaw for 50 Teammates: 5 Things I Learned', description: 'Cloud deployment killed install friction but exposed collaboration pain. Shared skills, SOUL files, and ADHD-friendly ops.', source_url: 'https://x.com/Team9_ai/status/2020846025418916052', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'x.com' },
  { name: 'OpenClaw in Slack: From Chatbot to Full Workflow Engine', description: 'MCP + API integrations, reusable skills, SOUL file governance. Sales team generates ROI spreadsheets from chat.', source_url: 'https://x.com/anothercohen/status/2023134773418610767', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'x.com' },
  { name: 'OpenClaw for Business Setup (That Scales Revenue)', description: 'pSEO ($45K of work in 20 min), copywriting ($50K in 15 min), agent squads, deal manufacturing, and CRM-connected deal finder.', source_url: 'https://x.com/ericosiu/status/2021249104710598785', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'x.com' },
  { name: 'What People Are Actually Doing With OpenClaw: 25+ Use Cases', description: 'Step-by-step tutorials covering email automation, business operations, development workflows, content production, and home automation.', source_url: 'https://www.forwardfuture.ai/p/what-people-are-actually-doing-with-openclaw-25-use-cases', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'forwardfuture.ai' },
  { name: 'I Spent $47 Testing OpenClaw for a Week', description: 'Honest review: email cleanup wins, code review failures, API cost breakdown. Useful for calibrating expectations.', source_url: 'https://medium.com/@likhitkumarvp/i-spent-47-testing-openclaw-for-a-week-heres-what-s-actually-happening-c274dc26a3fd', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'medium.com' },
  { name: 'OpenClaw Is Changing My Life', description: "Developer managing entire project lifecycle via phone chat. A good picture of what's possible when it's working well.", source_url: 'https://reorx.com/blog/openclaw-is-changing-my-life/', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'reorx.com' },
  { name: '"Hello" From My OpenClaw Agent', description: "Commercial real estate professional's firsthand setup experience. Good non-developer perspective.", source_url: 'https://chatcre.substack.com/p/hello-from-tophers-openclaw-ai-agent', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'substack.com' },
  { name: 'My Experience With OpenClaw (Refactoring)', description: '2-week in-depth report comparing it to the iPhone — a combination of existing capabilities that adds up to something new.', source_url: 'https://refactoring.fm/p/my-experience-with-openclaw', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'refactoring.fm' },
  { name: '160,000 Developers Building Digital Employees', description: 'Real stories: car negotiation ($4,200 saved), iMessage malfunction (500 unwanted messages). The highs and the lows.', source_url: 'https://natesnewsletter.substack.com/p/what-3-weeks-inside-the-moltbot-openclaw', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'substack.com' },
  { name: 'How to Get Set Up in an Afternoon', description: 'Pre-install decisions: hardware, accounts, phone numbers, WhatsApp, Tailscale. Good for planning before you start.', source_url: 'https://amankhan1.substack.com/p/how-to-get-clawdbotmoltbotopenclaw', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'substack.com' },
  { name: 'OpenClaw AI Review 2026: 30-Day Test', description: 'Email triage, lead research, code snippets, model switching, cost analysis over a full month.', source_url: 'https://freerdps.com/blog/openclaw-ai-review/', source_type: 'campclaw', category: 'real_builds', upvote_count: 0, author: 'freerdps.com' },
  // AIDB Episodes
  { name: 'AIDB: How I Built My 10 Agent Team With OpenClaw', description: "An overview of NLW's OpenClaw setup", source_url: 'https://youtu.be/HzVYgpMxMLE', source_type: 'campclaw', category: 'aidb_episodes', upvote_count: 1, author: 'youtu.be' },
  { name: 'AIDB: How to Learn AI With AI', description: 'A look at the "AI Build-partner-coach" approach', source_url: 'https://youtu.be/eFpyRtRyu3k', source_type: 'campclaw', category: 'aidb_episodes', upvote_count: 0, author: 'youtu.be' },
]

// ── GitHub Skills (synthetic fallback) ───────────────────────────────────────

interface SkillSeed {
  name: string
  description: string
  tools_used: string[]
  triggers: string[]
  author: string
  category: ResourceCategory
}

const GITHUB_SKILLS: SkillSeed[] = [
  { name: 'email-assistant', description: 'Compose, reply, and summarize emails with smart context awareness.', tools_used: ['gmail', 'outlook', 'calendar'], triggers: ['draft an email', 'reply to this', 'summarize inbox'], author: 'clawhub-community', category: 'building_agents' },
  { name: 'code-reviewer', description: 'Automated code review with style checks, bug detection, and security scanning.', tools_used: ['github', 'eslint', 'semgrep', 'ast-parser'], triggers: ['review this PR', 'check code quality', 'find bugs'], author: 'voltdev', category: 'building_agents' },
  { name: 'calendar-manager', description: 'Smart calendar management with conflict detection, meeting prep, and timezone handling.', tools_used: ['google-calendar', 'outlook-calendar', 'zoom'], triggers: ['schedule a meeting', 'check my calendar', 'find free time'], author: 'timetools', category: 'building_agents' },
  { name: 'data-analyst', description: 'Analyze CSV, SQL, and API data with natural language queries. Generates charts and insights.', tools_used: ['pandas', 'sql-connector', 'chart-generator'], triggers: ['analyze this data', 'create a chart', 'query the database'], author: 'datacraft', category: 'building_agents' },
  { name: 'git-workflow', description: 'Automate git operations: smart commits, branch management, conflict resolution.', tools_used: ['git', 'github-api', 'diff-parser'], triggers: ['commit changes', 'create a branch', 'resolve conflicts'], author: 'gitflow-labs', category: 'building_agents' },
  { name: 'test-generator', description: 'Auto-generate unit, integration, and e2e tests for Jest, Vitest, Playwright.', tools_used: ['jest', 'vitest', 'playwright', 'cypress'], triggers: ['write tests', 'generate test cases', 'add coverage'], author: 'testcraft', category: 'building_agents' },
  { name: 'security-scanner', description: 'Scan code and dependencies for vulnerabilities. OWASP checks and secret detection.', tools_used: ['snyk', 'npm-audit', 'semgrep', 'trufflehog'], triggers: ['scan for vulnerabilities', 'check security', 'audit dependencies'], author: 'secops-claw', category: 'security' },
  { name: 'docker-composer', description: 'Generate and optimize Docker configurations. Multi-stage builds, compose files.', tools_used: ['docker', 'docker-compose', 'kubernetes'], triggers: ['create dockerfile', 'containerize this', 'deploy to docker'], author: 'containercraft', category: 'building_agents' },
  { name: 'prompt-engineer', description: 'Craft and optimize LLM prompts. A/B testing, token counting, and template management.', tools_used: ['openai', 'anthropic', 'langchain', 'promptfoo'], triggers: ['optimize prompt', 'test prompts', 'create template'], author: 'promptcraft', category: 'building_agents' },
  { name: 'voice-agent', description: 'Build conversational voice agents with speech-to-text, text-to-speech, and real-time audio.', tools_used: ['livekit', 'deepgram', 'elevenlabs', 'openai-realtime'], triggers: ['create voice agent', 'add speech', 'build voice bot'], author: 'voicedev', category: 'building_agents' },
  { name: 'rag-pipeline', description: 'Build retrieval-augmented generation pipelines. Vector stores, chunking, hybrid search.', tools_used: ['pinecone', 'pgvector', 'langchain', 'llamaindex'], triggers: ['build rag pipeline', 'add vector search', 'create knowledge base'], author: 'ragtools', category: 'building_agents' },
  { name: 'agent-orchestrator', description: 'Orchestrate multi-agent workflows with tool routing and task delegation.', tools_used: ['langgraph', 'autogen', 'crewai', 'openai-agents'], triggers: ['create agent workflow', 'orchestrate agents', 'build multi-agent'], author: 'agentsmith', category: 'multi_agent' },
  { name: 'deploy-assistant', description: 'Deploy to Vercel, Railway, Fly.io, or AWS with config and health checks.', tools_used: ['vercel-cli', 'railway-cli', 'fly-cli', 'aws-cdk'], triggers: ['deploy this', 'setup hosting', 'configure deployment'], author: 'deployops', category: 'building_agents' },
  { name: 'supabase-admin', description: 'Manage Supabase projects: RLS policies, edge functions, database functions.', tools_used: ['supabase-cli', 'supabase-js', 'pg', 'postgrest'], triggers: ['setup supabase', 'create rls policy', 'add edge function'], author: 'supatools', category: 'building_agents' },
  { name: 'ci-pipeline', description: 'Generate CI/CD pipelines for GitHub Actions, GitLab CI, and CircleCI.', tools_used: ['github-actions', 'gitlab-ci', 'circleci', 'docker'], triggers: ['create CI pipeline', 'add deployment', 'automate builds'], author: 'citools', category: 'building_agents' },
]

// ── Real AIDB Ecosystem Content ─────────────────────────────────────────────

interface EpisodeSeed {
  title: string
  content_type: 'podcast' | 'training' | 'newsletter' | 'intel' | 'program'
  description: string
  url: string
  published_at: string
}

const AIDB_CONTENT: EpisodeSeed[] = [
  // Programs
  { title: 'CampClaw: 12-Step Agent Building Sprint', content_type: 'program', description: 'Self-directed cohort learning program by AIDB Training. Build 12 agent projects over 30 days with daily newsletters, weekly check-ins, and curated resources.', url: 'https://campclaw.ai/home', published_at: '2026-02-19T00:00:00Z' },
  { title: 'AIDB New Year: 10-Week AI Mission Program', content_type: 'program', description: '10-week AI mission program with 6,544+ participants. Structured AI learning journey with weekly missions and community support.', url: 'https://aidbnewyear.com/', published_at: '2026-01-01T00:00:00Z' },
  { title: 'Enterprise Claw: Executive AI Agent Sprint', content_type: 'program', description: 'Executive-level AI agent sprint launching March 2026 for business leaders deploying AI agents in enterprise.', url: 'https://enterpriseclaw.ai/', published_at: '2026-03-01T00:00:00Z' },
  { title: 'Superintelligent: Agent Readiness Audit', content_type: 'program', description: "AI readiness assessment program by AIDB. Evaluate your organization's preparedness for AI agent deployment.", url: 'https://besuper.ai/', published_at: '2026-02-01T00:00:00Z' },
  // Intel
  { title: 'AIDB Intel: AI Research & Benchmarks Hub', content_type: 'intel', description: "AIDB's research arm covering AI benchmarks, model comparisons, and industry analysis.", url: 'https://aidbintel.com/', published_at: '2026-02-15T00:00:00Z' },
  // Training
  { title: 'AIDB Training Hub', content_type: 'training', description: 'Central training hub for AI Daily Brief education programs on agent building, prompt engineering, RAG pipelines.', url: 'https://aidailybrief.ai/', published_at: '2026-02-15T00:00:00Z' },
  // Newsletter
  { title: 'The AI Daily Brief Newsletter', content_type: 'newsletter', description: 'Daily AI news and analysis via Beehiiv covering breaking AI developments, new models, agent frameworks, and tutorials.', url: 'https://aidailybrief.beehiiv.com/', published_at: '2026-02-17T00:00:00Z' },
  // Community
  { title: 'AIDB Operators Community (Circle)', content_type: 'training', description: 'Private community for AIDB members on Circle with forums, resource sharing, peer support, and instructor access.', url: 'https://aidboperators.circle.so/', published_at: '2026-01-15T00:00:00Z' },
]

// ─── Helpers ────────────────────────────────────────────────────────────────

async function generateEmbeddingsBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = []
  const batchSize = 20

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const response = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: batch.map(t => t.slice(0, 8000)),
        })
        results.push(...response.data.map(d => d.embedding))
        break
      } catch (err: unknown) {
        const error = err as { status?: number }
        if (error.status === 429 && attempt < 2) {
          const backoff = Math.pow(2, attempt) * 2000 + Math.random() * 1000
          console.log(`  Rate limited, waiting ${Math.round(backoff / 1000)}s...`)
          await new Promise(r => setTimeout(r, backoff))
        } else {
          throw err
        }
      }
    }

    if (i + batchSize < texts.length) {
      await new Promise(r => setTimeout(r, 200))
    }
  }

  return results
}

// ─── Main Seed Function ─────────────────────────────────────────────────────

async function seed() {
  console.log('=== ClawCamp Database Seed (Real Data) ===\n')

  // ── 1. Seed CampClaw Resources ────────────────────────────────────────────
  console.log(`Seeding ${CAMPCLAW_RESOURCES.length} CampClaw resources...`)

  const resourceTexts = CAMPCLAW_RESOURCES.map(r =>
    `${r.name} | ${r.description} | Category: ${r.category.replace(/_/g, ' ')}`
  )

  console.log('  Generating embeddings...')
  const resourceEmbeddings = await generateEmbeddingsBatch(resourceTexts)
  console.log(`  Generated ${resourceEmbeddings.length} embeddings`)

  let resourcesNew = 0
  let resourcesUpdated = 0

  for (let i = 0; i < CAMPCLAW_RESOURCES.length; i++) {
    const resource = CAMPCLAW_RESOURCES[i]
    const embedding = resourceEmbeddings[i]

    const { data: existing } = await supabase
      .from('skills')
      .select('id')
      .eq('source_url', resource.source_url)
      .single()

    const skillData = {
      name: resource.name,
      description: resource.description,
      full_instructions: null,
      tools_used: [] as string[],
      triggers: [] as string[],
      source_url: resource.source_url,
      source_type: resource.source_type,
      author: resource.author,
      raw_skill_md: null,
      embedding,
      mention_count: resource.upvote_count,
      is_new: false,
      category: resource.category,
      upvote_count: resource.upvote_count,
      first_seen_at: new Date().toISOString(),
      last_crawled_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase.from('skills').update(skillData).eq('id', existing.id)
      resourcesUpdated++
    } else {
      await supabase.from('skills').insert(skillData)
      resourcesNew++
    }

    if ((i + 1) % 10 === 0) {
      console.log(`  Progress: ${i + 1}/${CAMPCLAW_RESOURCES.length}`)
    }
  }

  console.log(`  Done: ${resourcesNew} new, ${resourcesUpdated} updated\n`)

  // ── 2. Seed GitHub Skills ─────────────────────────────────────────────────
  console.log(`Seeding ${GITHUB_SKILLS.length} GitHub skills...`)

  const skillTexts = GITHUB_SKILLS.map(s =>
    `${s.name} | ${s.description} | Tools: ${s.tools_used.join(', ')} | Triggers: ${s.triggers.join(', ')}`
  )

  console.log('  Generating embeddings...')
  const skillEmbeddings = await generateEmbeddingsBatch(skillTexts)
  console.log(`  Generated ${skillEmbeddings.length} embeddings`)

  let skillsNew = 0
  let skillsUpdated = 0

  for (let i = 0; i < GITHUB_SKILLS.length; i++) {
    const skill = GITHUB_SKILLS[i]
    const embedding = skillEmbeddings[i]
    const sourceUrl = `https://github.com/openclaw-skills/${skill.name}/blob/main/SKILL.md`

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
      first_seen_at: firstSeen,
      last_crawled_at: new Date().toISOString(),
    }

    if (existing) {
      await supabase.from('skills').update(skillData).eq('id', existing.id)
      skillsUpdated++
    } else {
      await supabase.from('skills').insert(skillData)
      skillsNew++
    }
  }

  console.log(`  Done: ${skillsNew} new, ${skillsUpdated} updated\n`)

  // ── 3. Seed AIDB Content ──────────────────────────────────────────────────
  console.log(`Seeding ${AIDB_CONTENT.length} AIDB content items...`)

  const episodeTexts = AIDB_CONTENT.map(e => `${e.title} | ${e.description}`)
  console.log('  Generating embeddings...')
  const episodeEmbeddings = await generateEmbeddingsBatch(episodeTexts)
  console.log(`  Generated ${episodeEmbeddings.length} embeddings`)

  let episodesNew = 0
  let episodesUpdated = 0

  for (let i = 0; i < AIDB_CONTENT.length; i++) {
    const episode = AIDB_CONTENT[i]
    const embedding = episodeEmbeddings[i]

    const { data: existing } = await supabase
      .from('aidb_content')
      .select('id')
      .eq('url', episode.url)
      .single()

    if (existing) {
      await supabase.from('aidb_content').update({
        title: episode.title,
        description: episode.description,
        embedding,
      }).eq('id', existing.id)
      episodesUpdated++
    } else {
      await supabase.from('aidb_content').insert({
        title: episode.title,
        content_type: episode.content_type,
        description: episode.description,
        url: episode.url,
        published_at: episode.published_at,
        embedding,
      })
      episodesNew++
    }
  }

  console.log(`  Done: ${episodesNew} new, ${episodesUpdated} updated\n`)

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('=== Seed Complete ===')
  console.log(`CampClaw Resources: ${resourcesNew} new, ${resourcesUpdated} updated (${CAMPCLAW_RESOURCES.length} total)`)
  console.log(`GitHub Skills: ${skillsNew} new, ${skillsUpdated} updated (${GITHUB_SKILLS.length} total)`)
  console.log(`AIDB Content: ${episodesNew} new, ${episodesUpdated} updated (${AIDB_CONTENT.length} total)`)
  console.log(`\nTotal: ${CAMPCLAW_RESOURCES.length + GITHUB_SKILLS.length} skills, ${AIDB_CONTENT.length} AIDB items`)
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
