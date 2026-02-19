export interface ParsedSkill {
  name: string
  description: string
  fullInstructions: string
  toolsUsed: string[]
  triggers: string[]
  rawContent: string
}

/**
 * Parse YAML frontmatter from a SKILL.md file, returning the frontmatter
 * string and the remaining body content.
 */
function splitFrontmatter(content: string): { frontmatter: string; body: string } {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return { frontmatter: '', body: content }
  return {
    frontmatter: match[1],
    body: content.slice(match[0].length),
  }
}

/**
 * Extract a simple scalar value from YAML frontmatter.
 * Handles quoted and unquoted values. For multiline quoted strings that span
 * a single line in the YAML, this suffices.
 */
function extractYamlScalar(frontmatter: string, key: string): string {
  // Match key: "value" or key: 'value' or key: value
  // Also handle key: "multi word value with (parens) and special chars"
  const pattern = new RegExp(`^${key}:\\s*(?:"([^"]*?)"|'([^']*?)'|(.+))`, 'm')
  const m = frontmatter.match(pattern)
  if (!m) return ''
  return (m[1] ?? m[2] ?? m[3] ?? '').trim()
}

/**
 * Extract a YAML array field. Supports:
 * - Inline: `tools: [github, slack, "some tool"]`
 * - Block:
 *   ```
 *   tools:
 *     - github
 *     - slack
 *   ```
 */
function extractYamlArray(frontmatter: string, key: string): string[] {
  const results: string[] = []

  // Try inline array: key: [val1, val2, ...]
  const inlinePattern = new RegExp(`^${key}:\\s*\\[([^\\]]*)]`, 'm')
  const inlineMatch = frontmatter.match(inlinePattern)
  if (inlineMatch) {
    const items = inlineMatch[1].split(',')
    for (const item of items) {
      const cleaned = item.trim().replace(/^["']|["']$/g, '')
      if (cleaned) results.push(cleaned)
    }
    return results
  }

  // Try block array: key:\n  - val1\n  - val2
  const blockPattern = new RegExp(`^${key}:\\s*\\n((?:[ \\t]+-[^\\n]*\\n?)*)`, 'm')
  const blockMatch = frontmatter.match(blockPattern)
  if (blockMatch) {
    const lines = blockMatch[1].split('\n')
    for (const line of lines) {
      const itemMatch = line.match(/^\s+-\s+(.+)/)
      if (itemMatch) {
        const cleaned = itemMatch[1].trim().replace(/^["']|["']$/g, '')
        if (cleaned) results.push(cleaned)
      }
    }
    return results
  }

  return results
}

/**
 * Extract tools/bins from nested YAML metadata.
 * Handles patterns like:
 *   metadata:
 *     openclaw:
 *       requires:
 *         bins: ["ffmpeg", "avatarcam"]
 */
function extractMetadataBins(frontmatter: string): string[] {
  const results: string[] = []
  // Match bins: ["x", "y"] or bins: [x, y]
  const binsInline = frontmatter.match(/bins:\s*\[([^\]]*)\]/m)
  if (binsInline) {
    const items = binsInline[1].split(',')
    for (const item of items) {
      const cleaned = item.trim().replace(/^["']|["']$/g, '')
      if (cleaned) results.push(cleaned)
    }
  }
  return results
}

// Words to exclude from tool extraction (too generic or structural)
const TOOL_STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'this', 'that', 'from', 'your', 'use',
  'when', 'how', 'what', 'which', 'where', 'will', 'can', 'should',
  'must', 'not', 'are', 'was', 'been', 'has', 'have', 'had', 'does',
  'did', 'but', 'its', 'all', 'any', 'our', 'you', 'see', 'also',
  'each', 'more', 'most', 'other', 'some', 'such', 'than', 'too',
  'very', 'just', 'into', 'over', 'only', 'after', 'before', 'about',
  'key', 'new', 'set', 'get', 'run', 'add', 'yes', 'required',
  'optional', 'default', 'true', 'false', 'null', 'none', 'note',
  'example', 'usage', 'install', 'command', 'description', 'name',
  'version', 'string', 'number', 'boolean', 'object', 'array', 'file',
  'files', 'path', 'paths', 'value', 'values', 'type', 'types',
  'list', 'item', 'items', 'data', 'text', 'step', 'steps',
  'platform', 'macos', 'linux', 'windows', 'category',
  'setting', 'settings', 'guide', 'topic', 'reference', 'level',
])

/**
 * Extract tools from markdown body sections like:
 * ## Tools, ## Dependencies, ## Requirements, ## Integrations, ## Prerequisites
 * Looks for list items and table rows within those sections.
 */
function extractToolsFromSections(body: string): string[] {
  const results: string[] = []
  const sectionHeaders = /^##\s+(?:tools|dependencies|requirements|integrations|prerequisites|system\s+dependencies)\s*$/gim
  let headerMatch
  while ((headerMatch = sectionHeaders.exec(body)) !== null) {
    // Extract content until next ## heading or end of string
    const sectionStart = headerMatch.index + headerMatch[0].length
    const nextHeader = body.indexOf('\n## ', sectionStart)
    const sectionContent = nextHeader === -1
      ? body.slice(sectionStart)
      : body.slice(sectionStart, nextHeader)

    // Extract from bullet list items: - **toolname** or - `toolname` or - toolname:
    const bulletPattern = /^[\s]*[-*]\s+(?:\*\*([^*]+)\*\*|`([^`]+)`|(\w[\w-]*)(?:\s*[:\-—]|\s))/gm
    let bulletMatch
    while ((bulletMatch = bulletPattern.exec(sectionContent)) !== null) {
      const tool = (bulletMatch[1] ?? bulletMatch[2] ?? bulletMatch[3] ?? '').trim().toLowerCase()
      if (tool && !TOOL_STOP_WORDS.has(tool)) results.push(tool)
    }

    // Extract from table rows: | tool | ... | or | **tool** | ... |
    const tablePattern = /^\|[\s]*(?:\*\*([^*|]+)\*\*|`([^`|]+)`|([^|\s][^|]*))\s*\|/gm
    let tableMatch
    while ((tableMatch = tablePattern.exec(sectionContent)) !== null) {
      const cell = (tableMatch[1] ?? tableMatch[2] ?? tableMatch[3] ?? '').trim().toLowerCase()
      // Skip table headers (typically contain words like "tool", "name", "platform")
      if (cell && !TOOL_STOP_WORDS.has(cell) && !cell.includes('---')) {
        results.push(cell)
      }
    }
  }
  return results
}

/**
 * Extract trigger phrases from the skill content. Sources:
 * 1. "Use when..." in the description
 * 2. ## When to use / ## When to activate / ## Triggers sections
 * 3. Bullet points starting with "Use when..." anywhere in the body
 */
function extractTriggers(description: string, body: string): string[] {
  const results: string[] = []

  // 1. "Use when..." clauses from description (may contain multiple)
  const descUseWhen = description.match(/Use when\b[^.;]*/gi)
  if (descUseWhen) {
    for (const phrase of descUseWhen) {
      const cleaned = phrase.trim().replace(/[.,;]+$/, '')
      if (cleaned.length > 8) results.push(cleaned.toLowerCase())
    }
  }

  // 2. Section-based triggers: ## When to use, ## When to activate, ## Triggers
  const triggerSectionHeaders = /^##\s+(?:when\s+to\s+(?:use|activate)|triggers?)\s*$/gim
  let headerMatch
  while ((headerMatch = triggerSectionHeaders.exec(body)) !== null) {
    const sectionStart = headerMatch.index + headerMatch[0].length
    const nextHeader = body.indexOf('\n## ', sectionStart)
    const sectionContent = nextHeader === -1
      ? body.slice(sectionStart)
      : body.slice(sectionStart, nextHeader)

    // Extract bullet items from these sections
    const bulletPattern = /^[\s]*[-*]\s+(.+)/gm
    let bulletMatch
    while ((bulletMatch = bulletPattern.exec(sectionContent)) !== null) {
      const text = bulletMatch[1].trim().replace(/[.,;]+$/, '')
      if (text.length > 8) results.push(text.toLowerCase())
    }
  }

  // 3. "Use when..." bullets anywhere in the body
  const useWhenBullets = /^[\s]*[-*]\s+(?:Use when\b[^.\n]*)/gim
  let uwMatch
  while ((uwMatch = useWhenBullets.exec(body)) !== null) {
    const text = uwMatch[0].replace(/^[\s]*[-*]\s+/, '').trim().replace(/[.,;]+$/, '')
    if (text.length > 8) results.push(text.toLowerCase())
  }

  // 4. "When to Use" column content from markdown tables
  // Pattern: | ... | When to Use | ... | where the "When to Use" column has useful trigger text
  const tableRows = body.match(/^\|.+\|$/gm)
  if (tableRows && tableRows.length > 1) {
    // Find header row with "when to use" column
    const headerRow = tableRows.find(row => /when\s+to\s+use/i.test(row))
    if (headerRow) {
      const headers = headerRow.split('|').map(h => h.trim().toLowerCase())
      const colIndex = headers.findIndex(h => /when\s+to\s+use/i.test(h))
      if (colIndex >= 0) {
        for (const row of tableRows) {
          if (row === headerRow || /^[\s|:-]+$/.test(row)) continue
          const cells = row.split('|').map(c => c.trim())
          if (cells[colIndex] && cells[colIndex].length > 8) {
            const text = cells[colIndex]
              .replace(/\*\*/g, '')
              .replace(/[.,;]+$/, '')
              .trim()
            if (text.length > 8) results.push(text.toLowerCase())
          }
        }
      }
    }
  }

  return [...new Set(results)]
}

export function parseSkillMd(content: string): ParsedSkill {
  const rawContent = content
  const { frontmatter, body } = splitFrontmatter(content)

  // --- Name & Description from frontmatter ---
  const name = extractYamlScalar(frontmatter, 'name') || 'Unknown'
  let description = extractYamlScalar(frontmatter, 'description')

  // extractYamlScalar returns ">" or "|" for YAML folded/literal multiline blocks
  if (description === '>' || description === '|' || description === '>-' || description === '|-') {
    description = ''
  }

  // If description is multiline (starts with > or |), grab more aggressively
  if (!description && frontmatter) {
    const multilineMatch = frontmatter.match(/^description:\s*[>|]-?\s*\n((?:[ \t]+.+\n?)+)/m)
    if (multilineMatch) {
      description = multilineMatch[1].replace(/\n\s*/g, ' ').trim()
    }
  }

  const fullInstructions = body.trim()

  // --- Tools extraction (layered approach) ---
  const toolsSet = new Set<string>()

  // Layer 1: YAML frontmatter `tools:` field
  for (const tool of extractYamlArray(frontmatter, 'tools')) {
    toolsSet.add(tool.toLowerCase())
  }

  // Layer 2: YAML frontmatter `tags:` field (many skills use tags instead of tools)
  for (const tag of extractYamlArray(frontmatter, 'tags')) {
    toolsSet.add(tag.toLowerCase())
  }

  // Layer 3: YAML metadata bins (e.g., metadata.openclaw.requires.bins)
  for (const bin of extractMetadataBins(frontmatter)) {
    toolsSet.add(bin.toLowerCase())
  }

  // Layer 4: Markdown section-based tools extraction
  for (const tool of extractToolsFromSections(fullInstructions)) {
    toolsSet.add(tool)
  }

  // Layer 5 (backward compat): Original inline pattern for remaining matches
  const legacyToolPattern = /(?:tools?|requires?|integrates?\s+with):\s*[`"]?(\w[\w-]*)[`"]?/gi
  let legacyMatch
  while ((legacyMatch = legacyToolPattern.exec(fullInstructions)) !== null) {
    const val = legacyMatch[1].toLowerCase()
    if (!TOOL_STOP_WORDS.has(val)) toolsSet.add(val)
  }

  const toolsUsed = [...toolsSet]

  // --- Trigger extraction ---
  const triggers = extractTriggers(description, fullInstructions)

  return { name, description, fullInstructions, toolsUsed, triggers, rawContent }
}

export function buildEmbeddingText(skill: ParsedSkill): string {
  const parts = [skill.name, skill.description]
  if (skill.fullInstructions) {
    parts.push(skill.fullInstructions.slice(0, 500))
  }
  return parts.filter(Boolean).join(' | ')
}
