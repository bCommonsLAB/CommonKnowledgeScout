"use client"

import type { StorageItem } from "@/lib/storage/types"

export type StoryStepState = "missing" | "present" | "running" | "error"

export type StoryMediaType = "pdf" | "audio" | "video" | "image" | "markdown" | "unknown"

export interface StoryStepStatus {
  id: "text" | "transform" | "publish"
  state: StoryStepState
  label: string
  detail: string
}

export function getStoryMediaType(file: StorageItem): StoryMediaType {
  const name = String(file.metadata?.name || "").toLowerCase()
  const mime = String(file.metadata?.mimeType || "").toLowerCase()

  if (mime.includes("pdf") || name.endsWith(".pdf")) return "pdf"
  if (mime.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|opus|flac)$/.test(name)) return "audio"
  if (mime.startsWith("video/") || /\.(mp4|mov|avi|webm|mkv)$/.test(name)) return "video"
  if (mime.startsWith("image/") || /\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)$/.test(name)) return "image"
  if (mime.includes("markdown") || /\.(md|mdx|txt)$/.test(name)) return "markdown"
  return "unknown"
}

export function getTextStepLabel(mediaType: StoryMediaType): string {
  if (mediaType === "audio" || mediaType === "video") return "Transkription"
  if (mediaType === "pdf" || mediaType === "image") return "Text (OCR/Extrakt)"
  return "Text"
}


