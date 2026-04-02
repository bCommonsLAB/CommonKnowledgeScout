"use client"

import { useAtomValue } from "jotai"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { getLibraryCreationConfig } from "@/lib/templates/library-creation-config"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, FileText, Mic } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import * as LucideIcons from "lucide-react"

/**
 * Bekannte Icons direkt importieren — bei `import * as lucide-react` kann Tree-Shaking
 * einzelne Symbole (z. B. Mic) aus dem Namespace entfernen, dann wäre die Lookup-Map leer.
 */
const STATIC_LUCIDE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Mic,
  FileText,
}

/**
 * Lädt ein Lucide-Icon dynamisch basierend auf dem Icon-Namen
 */
function getIconComponent(iconName?: string) {
  if (!iconName) {
    return FileText
  }
  const staticIcon = STATIC_LUCIDE_ICONS[iconName]
  if (staticIcon) return staticIcon

  const IconComponent = (LucideIcons as Record<string, unknown>)[iconName] as React.ComponentType<{ className?: string }> | undefined
  if (IconComponent && typeof IconComponent === 'function') {
    return IconComponent
  }

  return FileText
}

export default function CreateContentPage() {
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const router = useRouter()
  const searchParams = useSearchParams()
  const [creationTypes, setCreationTypes] = useState<Awaited<ReturnType<typeof getLibraryCreationConfig>>>([])
  const [isLoading, setIsLoading] = useState(true)

  // sourceFolderId aus URL übernehmen (wenn Nutzer aus Verzeichnis kam)
  const sourceFolderId = searchParams.get('sourceFolderId') || undefined

  useEffect(() => {
    async function loadCreationTypes() {
      if (!activeLibrary) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const types = await getLibraryCreationConfig(activeLibrary.id)
        setCreationTypes(types)
      } catch (error) {
        console.error('Fehler beim Laden der Creation-Typen:', error)
        setCreationTypes([])
      } finally {
        setIsLoading(false)
      }
    }

    loadCreationTypes()
  }, [activeLibrary])

  if (!activeLibrary) {
    return (
      <div className="container max-w-4xl py-12">
        <div className="text-center text-muted-foreground">
          Keine aktive Bibliothek ausgewählt
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="container max-w-4xl py-12">
        <div className="text-center text-muted-foreground">
          Lade Creation-Typen...
        </div>
      </div>
    )
  }

  if (creationTypes.length === 0) {
    return (
      <div className="container max-w-4xl py-12">
        <div className="mb-8">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Bibliothek
          </Link>
          <h1 className="text-3xl font-bold mb-2">Content erstellen</h1>
          <p className="text-muted-foreground">
            Keine Templates mit Creation-Flow in dieser Bibliothek gefunden. Erstellen Sie ein Template mit einem Creation-Flow, um Content zu erstellen.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        <div className="mb-8">
          <Link href="/library" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Bibliothek
          </Link>
          <h1 className="text-3xl font-bold mb-2">Content erstellen</h1>
          <p className="text-muted-foreground">
            Wähle einen Typ aus, um strukturierte Informationen zur Wissensbibliothek hinzuzufügen
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {creationTypes.map((type) => {
            // Diktat: immer Mikrofon (auch wenn Config/Icon-String aus API abweicht)
            const Icon =
              type.templateId === 'audio-transcript-de'
                ? Mic
                : getIconComponent(type.icon)
            const typeUrl = sourceFolderId
              ? `/library/create/${type.id}?sourceFolderId=${encodeURIComponent(sourceFolderId)}`
              : `/library/create/${type.id}`
            const isDisabled = type.disabled === true

            return (
              <Card
                key={type.id}
                className={
                  isDisabled
                    ? 'opacity-60 cursor-not-allowed border-muted'
                    : 'group cursor-pointer hover:border-primary transition-colors'
                }
                onClick={() => {
                  if (isDisabled) return
                  router.push(typeUrl)
                }}
              >
                <CardHeader>
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-lg ${isDisabled ? 'bg-muted' : 'bg-primary/10'}`}>
                      <Icon className={`w-6 h-6 ${isDisabled ? 'text-muted-foreground' : 'text-primary'}`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle
                          className={
                            isDisabled ? '' : 'group-hover:text-primary transition-colors'
                          }
                        >
                          {type.label}
                        </CardTitle>
                        {type.source === 'builtin' ? (
                          <Badge variant="secondary" className="text-xs font-normal">
                            Standardvorlage
                          </Badge>
                        ) : null}
                        {isDisabled ? (
                          <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
                            Bald
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription className="mt-2">
                        {type.description}
                        {type.disabledHint ? (
                          <span className="block mt-2 text-muted-foreground">{type.disabledHint}</span>
                        ) : null}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={isDisabled}
                    onClick={(e) => {
                      e.stopPropagation()
                      if (isDisabled) return
                      router.push(typeUrl)
                    }}
                  >
                    {isDisabled ? 'Noch nicht verfügbar' : 'Erstellen'}
                  </Button>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}

