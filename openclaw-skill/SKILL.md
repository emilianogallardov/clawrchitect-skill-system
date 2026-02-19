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
