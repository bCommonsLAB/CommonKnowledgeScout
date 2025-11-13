"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ArrowRight, BookOpen, Presentation, AlertCircle, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import * as LucideIcons from "lucide-react"
import { useTranslation } from "@/lib/i18n/hooks"
import { useToast } from "@/components/ui/use-toast"

interface PublicLibrary {
  id: string
  label: string
  slugName: string
  description: string
  icon?: string
  backgroundImageUrl?: string
  detailViewType?: 'book' | 'session'
  // Vollständige Chat-Config (optional, für zukünftige Nutzung)
  chat?: {
    gallery?: {
      detailViewType?: 'book' | 'session'
      facets?: Array<{
        metaKey: string
        label?: string
        type?: 'string' | 'number' | 'boolean' | 'string[]' | 'date' | 'integer-range'
        multi?: boolean
        visible?: boolean
        buckets?: Array<{ label: string; min: number; max: number }>
      }>
    }
    placeholder?: string
    maxChars?: number
    maxCharsWarningMessage?: string
    footerText?: string
    companyLink?: string
    targetLanguage?: string
    character?: string
    socialContext?: string
    genderInclusive?: boolean
    userPreferences?: {
      targetLanguage?: string
      character?: string
      socialContext?: string
      genderInclusive?: boolean
    }
  }
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
  const { t } = useTranslation()
  const { toast } = useToast()
  const [libraries, setLibraries] = useState<PublicLibrary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadLibraries() {
    try {
      setError(null)
      setLoading(true)
      
      const response = await fetch('/api/public/libraries')
      
      if (!response.ok) {
        let errorMessage = `Fehler beim Laden der Libraries: ${response.status}`
        
        // Versuche, eine detailliertere Fehlermeldung aus der Response zu extrahieren
        try {
          const errorData = await response.json()
          if (errorData.error || errorData.message) {
            errorMessage = errorData.error || errorData.message
          }
        } catch {
          // Wenn JSON-Parsing fehlschlägt, verwende die Standard-Fehlermeldung
        }
        
        throw new Error(errorMessage)
      }
      
      const data = await response.json()
      setLibraries(data.libraries || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler beim Laden der Libraries'
      console.error('[LibraryGrid] Fehler beim Laden der öffentlichen Libraries:', error)
      
      setError(errorMessage)
      
      // Toast-Nachricht anzeigen
      toast({
        title: "Fehler beim Laden der Libraries",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLibraries()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Icon-Komponente basierend auf Library-Typ oder explizitem Icon
  function getIconComponent(library: PublicLibrary) {
    // Wenn ein explizites Icon gesetzt ist, hat dies Priorität
    if (library.icon) {
      const IconComponent = (LucideIcons as Record<string, unknown>)[library.icon] as React.ComponentType<{ className?: string }> | undefined
      if (IconComponent && typeof IconComponent === 'function') {
        return IconComponent
      }
    }
    
    // Basierend auf detailViewType das passende Icon wählen
    // Prüfe zuerst direktes detailViewType, dann chat.gallery.detailViewType
    const viewType = library.detailViewType || library.chat?.gallery?.detailViewType
    if (viewType === 'session') {
      // Für Talks/Slideshows: Presentation-Icon
      return Presentation
    }
    
    // Default: BookOpen für Books oder wenn kein Typ gesetzt ist
    return BookOpen
  }

  if (loading && !error) {
    return (
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground">{t('home.libraryGrid.loading')}</div>
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-2xl">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Fehler beim Laden der Libraries</AlertTitle>
              <AlertDescription className="mt-2">
                {error}
              </AlertDescription>
            </Alert>
            <div className="mt-4 text-center">
              <Button onClick={loadLibraries} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Erneut versuchen
              </Button>
            </div>
          </div>
        </div>
      </section>
    )
  }

  if (libraries.length === 0) {
    return (
      <section className="py-20 md:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center text-muted-foreground">
            {t('home.libraryGrid.noLibraries')}
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
            {t('home.libraryGrid.title')}
          </h2>
          <p className="text-lg leading-relaxed text-muted-foreground text-pretty">
            {t('home.libraryGrid.description')}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:gap-8">
          {libraries.map((library, index) => {
            const Icon = getIconComponent(library)
            const colorConfig = ICON_COLORS[index % ICON_COLORS.length]
            
            return (
              <Card key={library.id} className="group relative overflow-hidden transition-all hover:shadow-lg">
                {/* Hintergrundbild für die Library-Karte, falls vorhanden */}
                {library.backgroundImageUrl && (
                  <>
                    <div 
                      className="absolute inset-0 bg-cover bg-center"
                      style={{ 
                        backgroundImage: `url("${library.backgroundImageUrl}")`,
                      }}
                    />
                    {/* Schwarzes Overlay mit 60% Transparenz (wie beim Hero-Bild) */}
                    <div className="absolute inset-0 bg-black/60" />
                  </>
                )}
                
                <CardHeader className={`relative z-10 ${library.backgroundImageUrl ? 'text-white' : ''}`}>
                  <div
                    className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-lg ${colorConfig.bgColor}`}
                  >
                    <Icon className={`h-6 w-6 ${colorConfig.color}`} />
                  </div>
                  <CardTitle className={`text-xl ${library.backgroundImageUrl ? 'text-white' : ''}`}>{library.label}</CardTitle>
                  <CardDescription className={`text-base leading-relaxed ${library.backgroundImageUrl ? 'text-white/90' : ''}`}>{library.description}</CardDescription>
                </CardHeader>
                <CardContent className="relative z-10">
                  <Button 
                    size="lg"
                    className={`group/btn gap-2 text-base ${
                      library.backgroundImageUrl 
                        ? 'bg-white text-black hover:bg-white/90' 
                        : ''
                    }`}
                    onClick={() => router.push(`/explore/${library.slugName}`)}
                  >
                    {(library.detailViewType || library.chat?.gallery?.detailViewType) === 'session' 
                      ? t('home.libraryGrid.buttonOpenEvent')
                      : t('home.libraryGrid.buttonQuery')
                    }
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

