export interface InstallInfo {
  /** Primary install command via ClawHub */
  command: string
  /** npx variant for users without clawhub installed globally */
  npxCommand: string
  /** author/name slug */
  skillPath: string
  /** Raw SKILL.md URL for direct download */
  rawUrl: string
  /** One-line install script for users without OpenClaw */
  installScript: string
}

/**
 * Extract install info from a skill's source URL.
 * Only GitHub/ClawHub skills are installable via clawhub CLI.
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

  const slug = `${safeAuthor}/${safeName}`

  return {
    command: `clawhub install ${slug}`,
    npxCommand: `npx clawhub install ${slug}`,
    skillPath: slug,
    rawUrl: sourceUrl,
    installScript: 'curl -fsSL https://openclaw.ai/install.sh | bash',
  }
}
