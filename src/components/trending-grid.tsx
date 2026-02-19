import { SkillCard } from "@/components/skill-card"
import type { Skill, TrendingSkill, SkillSearchResult } from "@/types"

type SkillData = Skill | TrendingSkill | SkillSearchResult

interface TrendingGridProps {
  skills: SkillData[]
  title: string
}

export function TrendingGrid({ skills, title }: TrendingGridProps) {
  return (
    <section>
      <h2 className="mb-4 font-mono text-lg font-bold uppercase text-brand">
        {title}
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <SkillCard key={skill.id} skill={skill} />
        ))}
      </div>
    </section>
  )
}
