export interface InstallInfo {
  /** openclaw skills install command (primary) */
  command: string
  /** clawhub install command (alternative) */
  clawhubCommand: string
  /** author/name slug */
  skillPath: string
  /** Raw SKILL.md URL for direct download */
  rawUrl: string
  /** GitHub repo URL for github: install syntax */
  githubInstall: string | null
  /** One-line install script for users without OpenClaw */
  installScript: string
}

/**
 * Extract install info from a skill's source URL.
 * Only GitHub/ClawHub skills are installable via OpenClaw CLI.
 * Returns null for resources, articles, and other non-installable entries.
 */
export function getInstallInfo(sourceUrl: string, sourceType: string): InstallInfo | null {
  if (sourceType !== 'github' && sourceType !== 'clawhub') return null

  // Match: .../skills/{author}/{name}/SKILL.md
  const match = sourceUrl.match(/\/skills\/([^/]+)\/([^/]+)\/SKILL\.md$/)
  if (!match) return null

  const [, author, name] = match

  // Sanitize to prevent command injection when users paste into terminal
  const safeName = name.replace(/[^a-zA-Z0-9_-]/g, '')
  const safeAuthor = author.replace(/[^a-zA-Z0-9_.-]/g, '')
  if (!safeName || !safeAuthor) return null

  // Try to extract GitHub user/repo for the github: install syntax
  const ghMatch = sourceUrl.match(/raw\.githubusercontent\.com\/([^/]+\/[^/]+)\//)
  const safeGhPath = ghMatch ? ghMatch[1].replace(/[^a-zA-Z0-9_.\-/]/g, '') : null
  const githubInstall = safeGhPath ? `openclaw skills install github:${safeGhPath}` : null

  return {
    command: `openclaw skills install ${safeName}`,
    clawhubCommand: `clawhub install ${safeAuthor}/${safeName}`,
    skillPath: `${author}/${name}`,
    rawUrl: sourceUrl,
    githubInstall,
    installScript: 'curl -fsSL https://openclaw.ai/install.sh | bash',
  }
}
