"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import * as LucideIcons from "lucide-react"

interface PublicLibrary {
  id: string
  label: string
  slugName: string
  description: string
  icon?: string
}

// Icon-Farben für verschiedene Libraries
const ICON_COLORS = [
  { color: "text-chart-1", bgColor: "bg-chart-1/10" },
  { color: "text-chart-2", bgColor: "bg-chart-2/10" },
  { color: "text-chart-3", bgColor: "bg-chart-3/10" },
  { color: "text-chart-4", bgColor: "bg-chart-4/10" },
]

export function LibraryGrid() {
  const router = useRouter()
  const [libraries, setLibraries] = useState<PublicLibrary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadLibraries() {
      try {
        console.log('[LibraryGrid] Lade öffentliche Libraries...')
        const response = await fetch('/api/public/libraries')
        console.log('[LibraryGrid] Response Status:', response.status, response.ok)
        
        if (!response.ok) {
          const errorText = await response.text()
          console.error('[LibraryGrid] Response Error:', errorText)
          throw new Error(`Fehler beim Laden der Libraries: ${response.status}`)
        }
        
        const data = await response.json()
        console.log('[LibraryGrid] Response Data:', data)
        console.log('[LibraryGrid] Libraries Array:', data.libraries)
        
        setLibraries(data.libraries || [])
      } catch (error) {
        console.error('[LibraryGrid] Fehler beim Laden der öffentlichen Libraries:', error)
      } finally {
        setLoading(false)
      }
    }

    loadLibraries()
  }, [])

  // Icon-Komponente basierend auf Icon-String
  function getIconComponent(iconName?: string) {
    if (!iconName) {
      // Default Icon
      const BookOpen = LucideIcons.BookOpen
      return BookOpen
    }

    // Versuche Icon aus Lucide zu laden
    const IconComponent = (LucideIcons as Record<string, unknown>)[iconName] as React.ComponentType<{ className?: string }> | undefined
    
    if (IconComponent && typeof IconComponent === 'function') {
      return IconComponent
    }

    // Fallback auf Default
    return LucideIcons.BookOpen
  }

  if (loading) {
    return (
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground">Lade Libraries...</div>
        </div>
      </section>
    )
  }

  if (libraries.length === 0) {
    return (
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground">
            Noch keine öffentlichen Libraries verfügbar.
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="py-20 md:py-28">
      <div className="container mx-auto px-4">
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight md:text-4xl text-balance">
            Wähle deine Wissensbibliothek
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            Jede Library enthält strukturierte Inhalte aus Vorträgen, Studien oder Projekten – und kann von dir wie ein
            Gesprächspartner befragt werden.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
          {libraries.map((library, index) => {
            const Icon = getIconComponent(library.icon)
            const colorConfig = ICON_COLORS[index % ICON_COLORS.length]
            
            return (
              <Card key={library.id} className="group relative overflow-hidden transition-all hover:shadow-lg">
                <CardHeader>
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${colorConfig.bgColor}`}
                  >
                    <Icon className={`h-6 w-6 ${colorConfig.color}`} />
                  </div>
                  <CardTitle className="text-xl">{library.label}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{library.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button 
                    variant="ghost" 
                    className="group/btn gap-2"
                    onClick={() => router.push(`/explore/${library.slugName}`)}
                  >
                    Befragen
                    <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </section>
  )
}

