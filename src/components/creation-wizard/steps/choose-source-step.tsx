"use client"

import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import type { CreationSource } from "@/lib/templates/template-types"
import { Mic, Link, FileText, Upload } from "lucide-react"
import { cn } from "@/lib/utils"

const SOURCE_TYPE_ICONS = {
  spoken: Mic,
  url: Link,
  text: FileText,
  file: Upload,
}

const SOURCE_TYPE_COLORS = {
  spoken: "text-blue-600 bg-blue-50 dark:bg-blue-900/20",
  url: "text-green-600 bg-green-50 dark:bg-green-900/20",
  text: "text-purple-600 bg-purple-50 dark:bg-purple-900/20",
  file: "text-orange-600 bg-orange-50 dark:bg-orange-900/20",
}

interface ChooseSourceStepProps {
  supportedSources: CreationSource[]
  onSelect: (source: CreationSource) => void
  selectedSource?: CreationSource
}

export function ChooseSourceStep({
  supportedSources,
  onSelect,
  selectedSource,
}: ChooseSourceStepProps) {
  if (supportedSources.length === 0) {
    return (
      <div className="text-center text-muted-foreground p-8">
        Keine unterstützten Quellen definiert.
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {supportedSources.map((source) => {
        const Icon = SOURCE_TYPE_ICONS[source.type]
        const colorClass = SOURCE_TYPE_COLORS[source.type]
        const isSelected = selectedSource?.id === source.id
        const label =
          source.type === 'spoken'
            ? 'Interview (erzählen)'
            : source.type === 'url'
              ? 'Über eine Webseite auslesen'
              : source.type === 'text'
                ? 'Text einfügen'
                : 'Datei hochladen'

        return (
          <Card
            key={source.id}
            className={cn(
              "cursor-pointer transition-all hover:border-primary",
              isSelected && "border-primary bg-primary/5"
            )}
            onClick={() => onSelect(source)}
          >
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className={cn("p-3 rounded-lg", colorClass)}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1">
                  <CardTitle>{label}</CardTitle>
                  {(source.helpText || source.type === 'url') && (
                    <CardDescription className="mt-2">
                      {source.type === 'url'
                        ? 'Füge einen Link ein. Wir lesen die Infos von der Webseite aus.'
                        : (source.helpText || '')}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
          </Card>
        )
      })}
    </div>
  )
}



