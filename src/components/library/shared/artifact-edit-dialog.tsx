"use client"

import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TextEditor } from "@/components/library/text-editor"
import type { StorageItem, StorageProvider } from "@/lib/storage/types"
import { FileLogger } from "@/lib/debug/logger"

interface ArtifactEditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: StorageItem | null
  provider: StorageProvider | null
  onSaved?: (item: StorageItem) => void
}

export function ArtifactEditDialog({
  open,
  onOpenChange,
  item,
  provider,
  onSaved,
}: ArtifactEditDialogProps) {
  const [content, setContent] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Beim Oeffnen laden wir den aktuellen Dateiinhalt.
  React.useEffect(() => {
    let cancelled = false

    async function load() {
      if (!open) return
      if (!provider || !item?.id) {
        setContent("")
        setError(null)
        return
      }

      try {
        setIsLoading(true)
        setError(null)
        const { blob } = await provider.getBinary(item.id)
        const text = await blob.text()
        if (cancelled) return
        setContent(text)
      } catch (e) {
        if (cancelled) return
        const message = e instanceof Error ? e.message : String(e)
        FileLogger.error("ArtifactEditDialog", "Laden fehlgeschlagen", { message })
        setError(message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, provider, item?.id])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Artefakt bearbeiten</DialogTitle>
        </DialogHeader>
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : (
          <div className="h-[70vh]">
            <TextEditor
              content={content}
              provider={provider}
              onSaveAction={async (nextContent: string) => {
                if (!provider || !item) throw new Error("Provider oder Datei fehlt.")
                if (!item.parentId) throw new Error("Parent-Ordner fehlt.")

                const blob = new Blob([nextContent], { type: "text/markdown" })
                const file = new File([blob], item.metadata.name, { type: "text/markdown" })

                FileLogger.info("ArtifactEditDialog", "Speichern gestartet", {
                  itemId: item.id,
                  itemName: item.metadata.name,
                })

                // Storage-Provider bieten kein In-Place-Update, daher replace via delete+upload.
                await provider.deleteItem(item.id)
                const saved = await provider.uploadFile(item.parentId, file)
                setContent(nextContent)
                onSaved?.(saved)
                onOpenChange(false)
              }}
            />
          </div>
        )}
        {isLoading ? <div className="text-xs text-muted-foreground">Lade Inhalt…</div> : null}
      </DialogContent>
    </Dialog>
  )
}

