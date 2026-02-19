"use client"

import { cn } from "@/lib/utils"

interface AidbContentLinkProps {
  title: string
  url: string
  content_type: "podcast" | "training" | "newsletter" | "intel" | "program"
  className?: string
}

const typeIcons: Record<string, string> = {
  podcast: "P",
  training: "T",
  newsletter: "N",
  intel: "I",
  program: "S",
}

const typeColors: Record<string, string> = {
  podcast: "bg-purple-500/20 text-purple-400",
  training: "bg-blue-500/20 text-blue-400",
  newsletter: "bg-amber-500/20 text-amber-400",
  intel: "bg-emerald-500/20 text-emerald-400",
  program: "bg-rose-500/20 text-rose-400",
}

export function AidbContentLink({
  title,
  url,
  content_type,
  className,
}: AidbContentLinkProps) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        if (typeof window !== 'undefined' && /^https?:\/\//i.test(url)) {
          window.open(url, '_blank', 'noopener,noreferrer')
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground cursor-pointer",
        className
      )}
    >
      <span
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded font-mono text-[10px] font-bold shrink-0",
          typeColors[content_type]
        )}
      >
        {typeIcons[content_type]}
      </span>
      <span className="max-w-[120px] truncate sm:max-w-[100px]">{title}</span>
    </button>
  )
}
