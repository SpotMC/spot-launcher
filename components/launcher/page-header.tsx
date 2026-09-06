import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface PageHeaderProps {
  title: string
  description?: string
  icon?: ReactNode
  rightContent?: ReactNode
  className?: string
}

export function PageHeader({ title, description, icon, rightContent, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-center gap-3 mb-5 shrink-0", className)}>
      {icon && (
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white/70">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-bold text-foreground tracking-tight">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground/60">{description}</p>
        )}
      </div>
      {rightContent && (
        <div className="flex items-center gap-2">
          {rightContent}
        </div>
      )}
    </div>
  )
}
