"use client"

import * as React from "react"
import { useState, useCallback } from "react"
import { useAtom } from "jotai"
import { v4 as uuidv4 } from "uuid"
import { Plus, Copy, Loader2 } from "lucide-react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { toast } from "@/components/ui/use-toast"

import {
  activeLibraryAtom,
  activeLibraryIdAtom,
  currentFolderIdAtom,
  folderItemsAtom,
  lastLoadedFolderAtom,
  librariesAtom,
  libraryAtom,
} from "@/atoms/library-atom"
import { StateLogger } from "@/lib/debug/logger"
import { StorageProviderType } from "@/types/library"

interface CreateLibraryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Callback nach erfolgreicher Erstellung mit der neuen Library-ID */
  onCreated?: (libraryId: string) => void
}

/**
 * Dialog zum Erstellen einer neuen Bibliothek.
 * 
 * Bietet die Möglichkeit, eine komplett neue Bibliothek zu erstellen
 * oder die Konfiguration der aktuellen Bibliothek zu klonen.
 * 
 * Nach erfolgreicher Erstellung wird:
 * 1. Die neue Library in der Datenbank gespeichert
 * 2. Der Cache komplett geleert (folderCache, folderItems, etc.)
 * 3. Ein expliziter Library-Wechsel zur neuen Library durchgeführt
 */
export function CreateLibraryDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateLibraryDialogProps) {
  const [name, setName] = useState("")
  const [cloneLibrary, setCloneLibrary] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Atoms für Library-Management
  const [libraries, setLibraries] = useAtom(librariesAtom)
  const [activeLibrary] = useAtom(activeLibraryAtom)
  const [, setActiveLibraryId] = useAtom(activeLibraryIdAtom)
  const [, setLibraryState] = useAtom(libraryAtom)
  const [, setFolderItems] = useAtom(folderItemsAtom)
  const [, setLastLoadedFolder] = useAtom(lastLoadedFolderAtom)
  const [, setCurrentFolderId] = useAtom(currentFolderIdAtom)

  // Reset Dialog-State beim Öffnen/Schließen
  React.useEffect(() => {
    if (open) {
      setName("")
      setCloneLibrary(false)
      setIsLoading(false)
    }
  }, [open])

  /**
   * Führt einen kompletten State-Reset durch, um Race Conditions zu vermeiden.
   * Muss SYNCHRON vor dem Library-Wechsel erfolgen.
   */
  const resetLibraryState = useCallback(() => {
    StateLogger.info('CreateLibraryDialog', 'Resetting library state for new library')
    
    // WICHTIG: Alle States synchron zurücksetzen
    setLibraryState(state => ({ ...state, folderCache: {} }))
    setFolderItems([])
    setLastLoadedFolder(null)
    setCurrentFolderId('root')
  }, [setLibraryState, setFolderItems, setLastLoadedFolder, setCurrentFolderId])

  /**
   * Erstellt eine neue Bibliothek und führt einen sauberen Library-Wechsel durch.
   */
  const handleCreate = useCallback(async () => {
    if (!name.trim()) {
      toast({
        title: "Name erforderlich",
        description: "Bitte geben Sie einen Namen für die neue Bibliothek ein.",
        variant: "destructive",
      })
      return
    }

    if (name.trim().length < 3) {
      toast({
        title: "Name zu kurz",
        description: "Der Name muss mindestens 3 Zeichen lang sein.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      // Neue eindeutige ID generieren
      const newLibraryId = uuidv4()
      
      // Basis-Konfiguration für neue Library
      let libraryData: {
        id: string
        label: string
        path: string
        type: StorageProviderType
        isEnabled: boolean
        config: Record<string, unknown>
      }

      if (cloneLibrary && activeLibrary) {
        // Klone die Konfiguration der aktuellen Library
        StateLogger.info('CreateLibraryDialog', 'Cloning library configuration', {
          sourceLibraryId: activeLibrary.id,
          newLibraryId,
        })

        libraryData = {
          id: newLibraryId,
          label: name.trim(),
          // Pfad wird angepasst, um Konflikte zu vermeiden
          path: activeLibrary.path ? `${activeLibrary.path}-copy` : "",
          type: activeLibrary.type,
          isEnabled: true,
          config: {
            // Kopiere alle Konfigurationen außer ID-spezifische
            ...activeLibrary.config,
            description: `Kopie von ${activeLibrary.label}`,
          },
        }
      } else {
        // Neue leere Library mit Standardwerten
        StateLogger.info('CreateLibraryDialog', 'Creating new empty library', {
          newLibraryId,
        })

        libraryData = {
          id: newLibraryId,
          label: name.trim(),
          path: "",
          type: "local" as StorageProviderType,
          isEnabled: true,
          config: {
            description: "",
            transcription: "shadowTwin",
            templateDirectory: "/templates",
            shadowTwin: {
              mode: "legacy",
              primaryStore: "filesystem",
              persistToFilesystem: true,
              allowFilesystemFallback: true,
            },
          },
        }
      }

      // API-Anfrage zum Speichern der Bibliothek
      const response = await fetch('/api/libraries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(libraryData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `Fehler beim Speichern: ${response.statusText}`)
      }

      // Bei Clone: Templates der Quell-Library kopieren
      if (cloneLibrary && activeLibrary) {
        StateLogger.info('CreateLibraryDialog', 'Copying templates from source library', {
          sourceLibraryId: activeLibrary.id,
          targetLibraryId: newLibraryId,
        })

        try {
          // 1. Alle Templates der Quell-Library laden
          const templatesResponse = await fetch(
            `/api/templates?libraryId=${encodeURIComponent(activeLibrary.id)}`
          )
          
          if (templatesResponse.ok) {
            const { templates } = await templatesResponse.json() as {
              templates: Array<{
                name: string
                metadata: unknown
                systemprompt: string
                markdownBody: string
                creation?: unknown
              }>
            }

            // 2. Jedes Template für die neue Library erstellen
            let copiedCount = 0
            for (const template of templates) {
              try {
                const copyResponse = await fetch('/api/templates', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    name: template.name,
                    libraryId: newLibraryId,
                    metadata: template.metadata,
                    systemprompt: template.systemprompt,
                    markdownBody: template.markdownBody,
                    creation: template.creation,
                  }),
                })

                if (copyResponse.ok) {
                  copiedCount++
                } else {
                  console.warn(`[CreateLibraryDialog] Template "${template.name}" konnte nicht kopiert werden`)
                }
              } catch (templateError) {
                console.warn(`[CreateLibraryDialog] Fehler beim Kopieren von Template "${template.name}":`, templateError)
              }
            }

            StateLogger.info('CreateLibraryDialog', 'Templates copied', {
              total: templates.length,
              copied: copiedCount,
            })
          }
        } catch (templateError) {
          // Template-Fehler sind nicht kritisch - Library wurde trotzdem erstellt
          console.warn('[CreateLibraryDialog] Fehler beim Kopieren der Templates:', templateError)
        }
      }

      // Neue Library zum lokalen State hinzufügen
      const newLibrary = {
        ...libraryData,
        icon: <Plus className="h-4 w-4" />,
      }
      setLibraries([...libraries, newLibrary])

      // WICHTIG: State synchron zurücksetzen BEVOR der Library-Wechsel erfolgt
      resetLibraryState()

      // Aktive Library auf die neue setzen
      setActiveLibraryId(newLibraryId)

      // localStorage aktualisieren
      try {
        localStorage.setItem('activeLibraryId', newLibraryId)
      } catch {
        // Ignoriere Storage-Fehler
      }

      StateLogger.info('CreateLibraryDialog', 'Library created successfully', {
        libraryId: newLibraryId,
        label: name.trim(),
        cloned: cloneLibrary,
      })

      toast({
        title: "Bibliothek erstellt",
        description: `Die Bibliothek "${name.trim()}" wurde erfolgreich erstellt.`,
      })

      // Dialog schließen
      onOpenChange(false)

      // Callback aufrufen
      if (onCreated) {
        onCreated(newLibraryId)
      }
    } catch (error) {
      console.error('Fehler beim Erstellen der Bibliothek:', error)
      toast({
        title: "Fehler",
        description: error instanceof Error ? error.message : "Unbekannter Fehler beim Erstellen",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    name,
    cloneLibrary,
    activeLibrary,
    libraries,
    setLibraries,
    setActiveLibraryId,
    resetLibraryState,
    onOpenChange,
    onCreated,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Neue Bibliothek erstellen
          </DialogTitle>
          <DialogDescription>
            Erstellen Sie eine neue Bibliothek für Ihre Dokumente.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Name-Eingabe */}
          <div className="grid gap-2">
            <Label htmlFor="library-name">Name</Label>
            <Input
              id="library-name"
              placeholder="z.B. Mein Archiv"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isLoading) {
                  handleCreate()
                }
              }}
            />
          </div>

          {/* Clone-Option (nur wenn eine aktive Library existiert) */}
          {activeLibrary && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="clone-library"
                checked={cloneLibrary}
                onCheckedChange={(checked) => setCloneLibrary(checked === true)}
                disabled={isLoading}
              />
              <Label
                htmlFor="clone-library"
                className="flex items-center gap-2 text-sm font-normal cursor-pointer"
              >
                <Copy className="h-4 w-4 text-muted-foreground" />
                Konfiguration von &quot;{activeLibrary.label}&quot; klonen
              </Label>
            </div>
          )}

          {/* Info-Text bei Clone */}
          {cloneLibrary && activeLibrary && (
            <p className="text-xs text-muted-foreground">
              Es werden kopiert: Speichertyp, Transkriptionsstrategie, 
              Shadow-Twin-Konfiguration und alle Templates. Der Speicherpfad 
              muss danach angepasst werden.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
          <Button onClick={handleCreate} disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird erstellt...
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Erstellen
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
