"use client"

import * as React from "react"
import { FileText, Wand2, Rss } from "lucide-react"

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type { StoryStepStatus, StoryStepState } from "@/components/library/shared/story-status"

function stateClass(state: StoryStepState): string {
  if (state === "present") return "text-green-600"
  if (state === "running") return "text-amber-600"
  if (state === "error") return "text-destructive"
  return "text-muted-foreground"
}

function getIcon(stepId: StoryStepStatus["id"]) {
  if (stepId === "text") return FileText
  if (stepId === "transform") return Wand2
  return Rss
}

export function StoryStatusIcons({
  steps,
  className,
}: {
  steps: StoryStepStatus[]
  className?: string
}) {
  return (
    <TooltipProvider>
      <div className={cn("flex items-center gap-2", className)}>
        {steps.map((s) => {
          const Icon = getIcon(s.id)
          return (
            <Tooltip key={s.id}>
              <TooltipTrigger asChild>
                <div className={cn("inline-flex h-8 w-8 items-center justify-center rounded-md border bg-background", stateClass(s.state))}>
                  <Icon className={cn("h-4 w-4", s.state === "running" ? "animate-pulse" : "")} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-sm font-medium">{s.label}</div>
                <div className="text-xs text-muted-foreground">{s.detail}</div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}


