"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, Loader2 } from "lucide-react"
import dynamic from "next/dynamic"

// Gallery dynamisch laden
const GalleryClient = dynamic(() => import("@/app/library/gallery/client").then(m => ({ default: m.default })), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  )
})

interface PublicLibrary {
  id: string
  label: string
  slugName: string
}

export default function ExplorePage() {
  const params = useParams()
  const slug = params?.slug as string
  const [library, setLibrary] = useState<PublicLibrary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadLibrary() {
      if (!slug) {
        setError("Slug fehlt")
        setLoading(false)
        return
      }

      try {
        const response = await fetch(`/api/public/libraries/${slug}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError("Library nicht gefunden")
          } else if (response.status === 403) {
            setError("Library ist nicht öffentlich verfügbar")
          } else {
            setError("Fehler beim Laden der Library")
          }
          setLoading(false)
          return
        }

        const data = await response.json()
        setLibrary(data.library)
      } catch (err) {
        console.error("Fehler beim Laden der Library:", err)
        setError("Fehler beim Laden der Library")
      } finally {
        setLoading(false)
      }
    }

    loadLibrary()
  }, [slug])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error || !library) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>{error || "Library nicht gefunden"}</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="container mx-auto">
          <h1 className="text-2xl font-bold">{library.label}</h1>
          <p className="text-sm text-muted-foreground">
            Öffentliche Wissensbibliothek
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden p-4">
        <div className="h-full min-h-0">
          <GalleryClient libraryIdProp={library.id} />
        </div>
      </div>
    </div>
  )
}

