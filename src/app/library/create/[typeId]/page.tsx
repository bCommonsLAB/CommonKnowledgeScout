"use client"

import { useAtomValue } from "jotai"
import { activeLibraryAtom } from "@/atoms/library-atom"
import { findCreationType } from "@/lib/templates/library-creation-config"
import { CreationWizard } from "@/components/creation-wizard/creation-wizard"
import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import type { LibraryCreationType } from "@/lib/templates/library-creation-config"
import { useSearchParams } from "next/navigation"

export default function CreateWizardPage({ params }: { params: Promise<{ typeId: string }> }) {
  const { typeId } = use(params)
  const searchParams = useSearchParams()
  const activeLibrary = useAtomValue(activeLibraryAtom)
  const [creationType, setCreationType] = useState<LibraryCreationType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  
  // Lese Resume-Parameter aus Search Params
  const resumeFileId = searchParams.get('resumeFileId') || undefined
  const templateIdOverride = searchParams.get('templateIdOverride') || undefined
  const seedFileId = searchParams.get('seedFileId') || undefined

  useEffect(() => {
    async function loadCreationType() {
      if (!activeLibrary) {
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const type = await findCreationType(activeLibrary.id, typeId)
        setCreationType(type || null)
      } catch (error) {
        console.error('Fehler beim Laden des Creation-Typs:', error)
        setCreationType(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadCreationType()
  }, [activeLibrary, typeId])

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
        <div className="mb-8">
          <Link href="/library/create" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Auswahl
          </Link>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
      </div>
    )
  }

  if (!creationType) {
    return (
      <div className="container max-w-4xl py-12">
        <div className="mb-8">
          <Link href="/library/create" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Auswahl
          </Link>
          <h1 className="text-3xl font-bold mb-2">Creation-Typ nicht gefunden</h1>
          <p className="text-muted-foreground">
            Der angeforderte Creation-Typ &quot;{typeId}&quot; existiert nicht in dieser Bibliothek.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl py-12">
        <div className="mb-8">
          <Link href="/library/create" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="w-4 h-4" />
            Zurück zur Auswahl
          </Link>
          <h1 className="text-3xl font-bold mb-2">{creationType.label}</h1>
          <p className="text-muted-foreground">{creationType.description}</p>
        </div>

        <CreationWizard
          typeId={typeId}
          templateId={templateIdOverride || creationType.templateId}
          libraryId={activeLibrary.id}
          resumeFileId={resumeFileId}
          seedFileId={seedFileId}
        />
      </div>
    </div>
  )
}

