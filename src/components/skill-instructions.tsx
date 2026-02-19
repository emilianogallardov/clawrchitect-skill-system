"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"

interface SkillInstructionsProps {
  content: string
}

export function SkillInstructions({ content }: SkillInstructionsProps) {
  const [expanded, setExpanded] = useState(false)

  // Split into lines for preview vs full
  const lines = content.split("\n")
  const isLong = lines.length > 12
  const preview = isLong ? lines.slice(0, 12).join("\n") : content

  return (
    <div className="space-y-2">
      <div
        className={`relative font-sans text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap ${
          !expanded && isLong ? "max-h-[240px] overflow-hidden" : ""
        }`}
      >
        {expanded || !isLong ? content : preview}
        {!expanded && isLong && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-background to-transparent" />
        )}
      </div>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 font-mono text-xs text-primary transition-colors hover:text-primary/80 cursor-pointer"
        >
          {expanded ? (
            <>
              Show less <ChevronUp className="h-3 w-3" />
            </>
          ) : (
            <>
              Show more <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      )}
    </div>
  )
}
