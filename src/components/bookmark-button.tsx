"use client"

import { Star } from "lucide-react"
import { useBookmarks } from "@/hooks/use-bookmarks"
import { cn } from "@/lib/utils"

interface BookmarkButtonProps {
  skillId: string
  skillName: string
  variant?: "icon" | "full"
  className?: string
}

export function BookmarkButton({
  skillId,
  skillName,
  variant = "icon",
  className,
}: BookmarkButtonProps) {
  const { toggle, isBookmarked } = useBookmarks()
  const active = isBookmarked(skillId)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle({ id: skillId, name: skillName })
      }}
      className={cn(
        "inline-flex items-center gap-1.5 transition-colors cursor-pointer",
        variant === "icon"
          ? "p-1 rounded hover:bg-primary/10"
          : "rounded-md border border-border px-3 py-1.5 text-sm font-mono hover:border-primary/30",
        className
      )}
      aria-label={active ? "Remove bookmark" : "Bookmark skill"}
    >
      <Star
        className={cn(
          "h-4 w-4",
          active
            ? "fill-primary text-primary"
            : "text-muted-foreground"
        )}
      />
      {variant === "full" && (
        <span className={cn(
          "text-xs",
          active ? "text-primary" : "text-muted-foreground"
        )}>
          {active ? "Bookmarked" : "Bookmark"}
        </span>
      )}
    </button>
  )
}
