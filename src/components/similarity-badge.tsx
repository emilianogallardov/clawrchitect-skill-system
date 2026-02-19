import { cn } from "@/lib/utils"

interface SimilarityBadgeProps {
  score: number
  className?: string
}

export function SimilarityBadge({ score, className }: SimilarityBadgeProps) {
  const pct = Math.round(score * 100)
  const opacity = Math.max(0.4, score)

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-primary/30 px-2 py-0.5 font-mono text-xs",
        className
      )}
      style={{ color: `rgba(58, 92, 66, ${opacity})` }}
    >
      {pct}%
    </span>
  )
}
