"use client"

import { useState, useRef, useEffect } from "react"
import { Terminal, Copy, Check, ExternalLink } from "lucide-react"
import { getInstallInfo } from "@/lib/install"
import { cn } from "@/lib/utils"

interface InstallButtonProps {
  sourceUrl: string
  sourceType: string
  className?: string
}

export function InstallButton({ sourceUrl, sourceType, className }: InstallButtonProps) {
  const info = getInstallInfo(sourceUrl, sourceType)
  const [open, setOpen] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    if (open) {
      document.addEventListener("mousedown", onMouseDown)
      document.addEventListener("keydown", onKeyDown)
    }
    return () => {
      document.removeEventListener("mousedown", onMouseDown)
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [open])

  if (!info) return null

  async function handleCopy(text: string, idx: number) {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    } catch {
      // Fallback: noop
    }
  }

  const commands = [
    { label: "ClawHub", value: info.command },
    { label: "npx (no install needed)", value: info.npxCommand },
  ]

  return (
    <div ref={popoverRef} className={cn("relative inline-block", className)}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(!open)
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 font-mono text-sm text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
      >
        <Terminal className="h-4 w-4" />
        Install
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[calc(100vw-2rem)] max-w-[380px] rounded-md border border-border bg-card p-4 shadow-lg sm:w-[380px]">
          <div className="space-y-3">
            {commands.map((cmd, i) => (
              <div key={cmd.label}>
                <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                  {cmd.label}
                </p>
                <div className="flex items-center gap-2 rounded border border-border bg-background px-3 py-2">
                  <code className="flex-1 overflow-x-auto font-mono text-xs text-foreground">
                    {cmd.value}
                  </code>
                  <button
                    type="button"
                    onClick={() => handleCopy(cmd.value, i)}
                    className="shrink-0 rounded p-2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                    aria-label={`Copy ${cmd.label} command`}
                  >
                    {copiedIdx === i ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2">
              <a
                href={info.rawUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                Download SKILL.md
                <ExternalLink className="h-3 w-3" />
              </a>
              <a
                href="https://openclaw.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                Don&apos;t have OpenClaw?
              </a>
            </div>
            <div className="flex items-center gap-2 rounded border border-dashed border-border bg-background/50 px-3 py-2">
              <code className="flex-1 overflow-x-auto font-mono text-xs text-muted-foreground">
                {info.installScript}
              </code>
              <button
                type="button"
                onClick={() => handleCopy(info.installScript, 99)}
                className="shrink-0 rounded p-2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
                aria-label="Copy install script"
              >
                {copiedIdx === 99 ? (
                  <Check className="h-4 w-4 text-primary" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
