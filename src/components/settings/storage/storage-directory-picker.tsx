"use client"

/**
 * StorageDirectoryPicker — Wurzelverzeichnis aus dem Storage-Listing
 * waehlen (Speicherort-Wizard Schritt 3, F1).
 *
 * Navigiert ueber provider.listItemsById durch die Ordner des
 * verbundenen Storage. Der gewaehlte Pfad wird aus den Breadcrumb-
 * Namen gebaut (Provider-Roots arbeiten pfadbasiert relativ zum
 * Drive-/WebDAV-Root).
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Folder, FolderPlus, Loader2, RefreshCw } from "lucide-react"
import { StorageFactory } from "@/lib/storage/storage-factory"
import type { StorageItem } from "@/lib/storage/types"

interface Crumb {
  id: string
  name: string
}

interface StorageDirectoryPickerProps {
  libraryId: string
  /** Wird bei jeder Auswahl-Änderung mit dem Pfad (Breadcrumb-Join) aufgerufen */
  onPathChange: (path: string) => void
  /**
   * Optional: Wird zusätzlich zu onPathChange mit der Ordner-ID (opaque, providerspezifisch)
   * und dem Anzeige-Pfad aufgerufen. Wird z.B. von der Migration benötigt, die einen
   * `folderId` an die API durchreicht (storage-abstrakt, kein Backend-Wissen im UI).
   */
  onSelectFolder?: (folderId: string, path: string) => void
}

export function StorageDirectoryPicker({ libraryId, onPathChange, onSelectFolder }: StorageDirectoryPickerProps) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: "root", name: "" }])
  const [folders, setFolders] = useState<StorageItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newFolderName, setNewFolderName] = useState("")
  const [isCreating, setIsCreating] = useState(false)

  const currentFolder = crumbs[crumbs.length - 1]
  const currentPath = crumbs.map(c => c.name).filter(Boolean).join("/")

  const loadFolder = useCallback(async (folderId: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const provider = await StorageFactory.getInstance().getProvider(libraryId)
      const items = await provider.listItemsById(folderId)
      setFolders(items.filter(item => item.type === "folder"))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Verzeichnis konnte nicht geladen werden: ${message}`)
      setFolders([])
    } finally {
      setIsLoading(false)
    }
  }, [libraryId])

  useEffect(() => {
    void loadFolder(currentFolder.id)
  }, [currentFolder.id, loadFolder])

  // onPathChange in einer Ref halten: Die Callback wird vom Wizard als
  // Inline-Pfeilfunktion uebergeben und hat bei jedem Render eine neue
  // Identitaet. Ohne die Ref wuerde der Pfad-Effekt unten bei JEDEM Render
  // feuern und damit die manuelle Eingabe im Pfad-Feld sofort wieder auf den
  // Breadcrumb-Wert ("/") zuruecksetzen.
  const onPathChangeRef = useRef(onPathChange)
  useEffect(() => {
    onPathChangeRef.current = onPathChange
  }, [onPathChange])

  // Gleiche Ref-Technik für die optionale Ordner-ID-Callback.
  const onSelectFolderRef = useRef(onSelectFolder)
  useEffect(() => {
    onSelectFolderRef.current = onSelectFolder
  }, [onSelectFolder])

  // Pfad nur bei echter Navigation (Breadcrumb-Aenderung) an den Wizard melden,
  // NICHT bei jedem Render. So bleibt eine manuelle Eingabe erhalten.
  useEffect(() => {
    const displayPath = currentPath === "" ? "/" : `/${currentPath}`
    onPathChangeRef.current(displayPath)
    // Aktuell gewählter Ordner = letzter Breadcrumb. Dessen opaque id an Aufrufer melden.
    onSelectFolderRef.current?.(currentFolder.id, displayPath)
  }, [currentPath, currentFolder.id])

  const enterFolder = (item: StorageItem) => {
    setCrumbs(prev => [...prev, { id: item.id, name: item.metadata.name }])
  }

  const goToCrumb = (index: number) => {
    setCrumbs(prev => prev.slice(0, index + 1))
  }

  const createFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    setIsCreating(true)
    setError(null)
    try {
      const provider = await StorageFactory.getInstance().getProvider(libraryId)
      await provider.createFolder(currentFolder.id, name)
      setNewFolderName("")
      await loadFolder(currentFolder.id)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setError(`Ordner konnte nicht angelegt werden: ${message}`)
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <div className="space-y-3">
      {/* Breadcrumb */}
      <div className="flex flex-wrap items-center gap-1 text-sm">
        {crumbs.map((crumb, idx) => (
          <span key={`${crumb.id}-${idx}`} className="flex items-center gap-1">
            {idx > 0 && <span className="text-muted-foreground">/</span>}
            <button
              type="button"
              onClick={() => goToCrumb(idx)}
              className={idx === crumbs.length - 1
                ? "font-medium"
                : "text-muted-foreground hover:underline"}
            >
              {idx === 0 ? "Hauptverzeichnis" : crumb.name}
            </button>
          </span>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 ml-auto"
          onClick={() => void loadFolder(currentFolder.id)}
          disabled={isLoading}
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Ordner-Liste */}
      <div className="rounded-md border max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Lade Verzeichnisse…
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-destructive">{error}</div>
        ) : folders.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            Keine Unterordner — Sie können diesen Ordner wählen oder unten einen neuen anlegen.
          </div>
        ) : (
          <ul>
            {folders.map(item => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => enterFolder(item)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-muted text-left"
                >
                  <Folder className="h-4 w-4 text-muted-foreground shrink-0" />
                  {item.metadata.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Neuen Ordner anlegen */}
      <div className="flex gap-2">
        <Input
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          placeholder="Neuen Ordner anlegen…"
          className="h-8"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void createFolder()}
          disabled={isCreating || newFolderName.trim() === ""}
        >
          {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderPlus className="h-4 w-4" />}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Gewähltes Verzeichnis: <code>{currentPath === "" ? "/" : `/${currentPath}`}</code>
      </p>
    </div>
  )
}
