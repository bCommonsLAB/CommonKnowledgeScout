"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MarkdownPreview } from "@/components/library/markdown-preview"

interface WelcomeStepProps {
  markdown: string
  title?: string
}

export function WelcomeStep({ markdown, title = "Willkommen" }: WelcomeStepProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Wir erklären kurz, was als Nächstes passiert.
        </CardDescription>
      </CardHeader>
      <CardContent className="prose prose-sm dark:prose-invert max-w-none">
        <MarkdownPreview content={markdown} />
      </CardContent>
    </Card>
  )
}








