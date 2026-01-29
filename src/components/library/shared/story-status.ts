"use client"

// Zentrale Medientyp-Definitionen - Re-Export für Rückwärtskompatibilität
export {
  type MediaKind as StoryMediaType,
  getMediaKind as getStoryMediaType,
  getTextStepLabel,
} from "@/lib/media-types"

export type StoryStepState = "missing" | "present" | "running" | "error"

export interface StoryStepStatus {
  id: "text" | "transform" | "publish"
  state: StoryStepState
  label: string
  detail: string
}


