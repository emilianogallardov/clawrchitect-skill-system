import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SkillNotFound() {
  return (
    <div className="flex flex-col items-center gap-4 pt-24 text-center">
      <h1 className="font-mono text-4xl font-bold text-primary">404</h1>
      <p className="font-sans text-sm text-muted-foreground">
        Skill not found. It may have been removed or the ID is incorrect.
      </p>
      <Button asChild variant="outline" className="font-mono">
        <Link href="/">Back to Home</Link>
      </Button>
    </div>
  )
}
