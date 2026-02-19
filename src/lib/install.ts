export interface InstallInfo {
  /** Primary install command via ClawHub */
  command: string
  /** npx variant for users without clawhub installed globally */
  npxCommand: string
  /** ClawHub slug (skill name only, not author/name) */
  slug: string
  /** Raw SKILL.md URL for direct download */
  rawUrl: string
  /** One-line install script for users without OpenClaw */
  installScript: string
}

/**
 * Extract install info from a skill's source URL.
 * Only GitHub/ClawHub skills are installable via clawhub CLI.
 * Returns null for resources, articles, and other non-installable entries.
 *
 * ClawHub CLI uses flat slugs (e.g. `clawhub install docker-essentials`),
 * not author/name format. The slug is the skill directory name from the
 * GitHub URL: .../skills/{author}/{slug}/SKILL.md
 */
export function getInstallInfo(sourceUrl: string, sourceType: string): InstallInfo | null {
  if (sourceType !== 'github' && sourceType !== 'clawhub') return null

  // Match: .../skills/{author}/{slug}/SKILL.md
  const match = sourceUrl.match(/\/skills\/[^/]+\/([^/]+)\/SKILL\.md$/)
  if (!match) return null

  const [, name] = match

  // Sanitize to prevent command injection when users paste into terminal
  const slug = name.replace(/[^a-zA-Z0-9_-]/g, '')
  if (!slug) return null

  return {
    command: `clawhub install ${slug}`,
    npxCommand: `npx clawhub install ${slug}`,
    slug,
    rawUrl: sourceUrl,
    installScript: 'curl -fsSL https://openclaw.ai/install.sh | bash',
  }
}
