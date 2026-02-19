"use client"

import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { Skill, TrendingSkill, SkillSearchResult } from "@/types"
import { AidbContentLink } from "@/components/aidb-content-link"
import { BookmarkButton } from "@/components/bookmark-button"

type SkillData = Skill | TrendingSkill | SkillSearchResult

interface SkillCardProps {
  skill: SkillData
  className?: string
}

export function SkillCard({ skill, className }: SkillCardProps) {
  const aidbContent = "aidb_content" in skill ? skill.aidb_content : null

  return (
    <Link href={`/skills/${skill.id}`}>
      <Card
        className={cn(
          "glow-warm cursor-pointer border-border bg-card transition-all hover:border-primary/30",
          className
        )}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="font-mono text-sm text-brand leading-snug">
              {skill.name}
            </CardTitle>
            <div className="flex shrink-0 items-center gap-1.5">
              {skill.is_new && (
                <Badge variant="outline" className="border-primary/50 text-primary text-[10px]">
                  NEW
                </Badge>
              )}
              <BookmarkButton skillId={skill.id} skillName={skill.name} variant="icon" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {skill.description && (
            <p className="line-clamp-3 font-sans text-xs text-muted-foreground">
              {skill.description}
            </p>
          )}
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">
              {skill.mention_count} mention{skill.mention_count !== 1 ? "s" : ""}
            </span>
            {aidbContent && (
              <AidbContentLink
                title={aidbContent.title}
                url={aidbContent.url}
                content_type={aidbContent.content_type}
              />
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
