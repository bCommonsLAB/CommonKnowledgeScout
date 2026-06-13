"use client"

/**
 * LibraryTeasers — Karten der eigenen/geteilten Bibliotheken auf dem
 * angemeldeten Dashboard (/start). Klick aktiviert die Bibliothek und öffnet
 * die App. Bewusst ohne Storage-Details (UI kennt das Backend nicht).
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight, BookOpen, Share2 } from "lucide-react"
import type { ClientLibrary } from "@/types/library"

interface LibraryTeasersProps {
  libraries: ClientLibrary[]
  onSelect: (libraryId: string) => void
}

export function LibraryTeasers({ libraries, onSelect }: LibraryTeasersProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
      {libraries.map((library) => {
        const Icon = BookOpen
        return (
          <Card key={library.id} className="group flex flex-col transition-all hover:shadow-lg">
            <CardHeader>
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                {library.isShared && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground">
                    <Share2 className="h-3 w-3" />
                    Geteilt
                  </span>
                )}
              </div>
              <CardTitle className="text-xl">{library.label}</CardTitle>
              <CardDescription>
                {library.isShared ? "Mit Ihnen geteilte Bibliothek" : "Ihre Bibliothek"}
              </CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button className="group/btn gap-2" onClick={() => onSelect(library.id)}>
                Öffnen
                <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
              </Button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
