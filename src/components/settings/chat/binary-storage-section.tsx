"use client"

/**
 * BinaryStorageSection — Azure Blob Storage / Thumbnail-Verwaltung.
 *
 * Extrahiert aus chat-form.tsx (Welle 3-IV-Settings-Sections-Split).
 * Enthält die Section "Binary Storage" mit Azure-Konfiguration,
 * Thumbnail-Statistik, Reparatur- und Regenerierungs-Aktionen.
 */

import { useState } from "react"
import {
  Button,
  Checkbox,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Switch,
} from '@ks/ui'
import { Cloud, Wrench, Loader2, RefreshCw } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"
// ClientLibrary ist der maskierte UI-Typ aus librariesAtom. Der
// Server-Typ Library gehoert nicht in UI-Sections (storage-abstraction.mdc §1).
// Diese Section nutzt von der Library nur das Feld id (Zeilen 180, 185).
import type { ClientLibrary } from "@/types/library"

/** Thumbnail-Statistik aus useChatForm */
interface ThumbnailStats {
  total?: number
  withCoverImage?: number
  missingThumbnails?: number
  alreadyRepaired?: number
}

/** Variant-Statistik aus useChatForm */
interface VariantStats {
  missingVariant?: number
}

interface BinaryStorageSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
  /** Die aktuell aktive Library (garantiert nicht null, da ChatForm-Guard schon prüft) */
  activeLibrary: ClientLibrary
  /** Ob eigene Azure-Credentials verwendet werden (Watch-Wert) */
  azureIngestionCustom: boolean
  /** Aktueller Container-Name (Watch-Wert) */
  azureContainerWatched: string
  thumbnailStats: ThumbnailStats | null
  isRepairingThumbnails: boolean
  repairProgress: number
  repairTotal: number
  isRegeneratingThumbnails: boolean
  regenerateProgress: number
  regenerateTotal: number
  variantStats: VariantStats | null
  isRepairingVariants: boolean
  isLoadingStats: boolean
  statsError: string | null
  loadThumbnailStats: () => Promise<void>
  handleRepairThumbnails: () => Promise<void>
  handleRegenerateThumbnails: () => Promise<void>
  handleRepairVariants: () => Promise<void>
}

/**
 * Section-Komponente für Azure Blob Storage und Thumbnail-Verwaltung.
 */
export function BinaryStorageSection({
  form,
  activeLibrary,
  azureIngestionCustom,
  azureContainerWatched,
  thumbnailStats,
  isRepairingThumbnails,
  repairProgress,
  repairTotal,
  isRegeneratingThumbnails,
  regenerateProgress,
  regenerateTotal,
  variantStats,
  isRepairingVariants,
  isLoadingStats,
  statsError,
  loadThumbnailStats,
  handleRepairThumbnails,
  handleRegenerateThumbnails,
  handleRepairVariants,
}: BinaryStorageSectionProps) {
  const [regenerateAll, setRegenerateAll] = useState(false)
  const isBusy = isRepairingThumbnails || isRegeneratingThumbnails || isRepairingVariants

  // Ohne "alle neu" braucht es fehlende Vorschaubilder; mit braucht es Cover-Bilder.
  const runDisabled = regenerateAll
    ? (thumbnailStats?.withCoverImage ?? 0) === 0
    : (thumbnailStats?.missingThumbnails ?? 0) === 0 && (variantStats?.missingVariant ?? 0) === 0

  /** Eine Aktion: erst noetige Metadaten-Reparatur, dann ergaenzen bzw. alles neu. */
  const handleRun = async () => {
    if ((variantStats?.missingVariant ?? 0) > 0) {
      await handleRepairVariants()
    }
    if (regenerateAll) {
      await handleRegenerateThumbnails()
    } else {
      await handleRepairThumbnails()
    }
  }

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Bild-Speicher</h3>
        <p className="text-sm text-muted-foreground">
          Bilder und andere Binärdateien liegen in Azure Blob Storage. Optional eigene Zugangsdaten pro Bibliothek — sonst gelten{' '}
          <code className="text-xs">AZURE_STORAGE_*</code>-Umgebungsvariablen.
        </p>
      </div>

      <FormField
        control={form.control}
        name="ingestionStorageUseCustom"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Bibliothekseigene Azure-Zugangsdaten</FormLabel>
              <FormDescription>
                {field.value
                  ? 'Connection String und Container werden in MongoDB für diese Bibliothek gespeichert.'
                  : 'Globale Azure-Konfiguration aus der Prozess-Umgebung verwenden.'}
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value ?? false} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
      {azureIngestionCustom && (
        <>
          <FormField
            control={form.control}
            name="ingestionConnectionString"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Azure Connection String</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="DefaultEndpointsProtocol=https;AccountName=…"
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    autoComplete="new-password"
                    name="azure-ingestion-conn"
                    spellCheck={false}
                    className="font-mono text-sm"
                  />
                </FormControl>
                <FormDescription>
                  Nur serverseitig. Leer lassen, um den gespeicherten Wert beizubehalten.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="ingestionContainerName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Container-Name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="z. B. knowledgescout"
                    value={typeof field.value === 'string' ? field.value : ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {/* Kurzüberblick zur aktuellen Auflösung */}
      <div className="rounded-md border p-4 bg-muted/30">
        <div className="flex items-center gap-2 text-sm">
          <Cloud className="h-4 w-4" />
          <span className="font-medium">Azure Blob Storage</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {azureIngestionCustom ? (
            <>
              Container (Bibliothek):{' '}
              <span className="font-mono">{azureContainerWatched.trim() || '…'}</span>
              {' · '}Blob-Pfad enthält Library-ID: <span className="font-mono">{activeLibrary.id}</span>
            </>
          ) : (
            <>
              Container aus <span className="font-mono">AZURE_STORAGE_CONTAINER_NAME</span> (Umgebung)
              {' · '}Unterordner u. a. <span className="font-mono">{activeLibrary.id}</span>
            </>
          )}
        </p>
      </div>

      {/* Vorschaubild-Statistik */}
      {isLoadingStats ? (
        <div className="rounded-md border p-4 bg-muted/30 text-center">
          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Lade Statistik...</p>
        </div>
      ) : statsError ? (
        <div className="rounded-md border p-4 bg-destructive/10 text-center">
          <p className="text-sm text-destructive">{statsError}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={loadThumbnailStats}
          >
            Erneut versuchen
          </Button>
        </div>
      ) : thumbnailStats ? (
        <div className="rounded-md border p-4 bg-muted/30">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{thumbnailStats.total ?? '-'}</div>
              <div className="text-xs text-muted-foreground">Dokumente</div>
            </div>
            <div>
              <div className="text-2xl font-bold">{thumbnailStats.withCoverImage ?? '-'}</div>
              <div className="text-xs text-muted-foreground">mit Cover-Bild</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">{thumbnailStats.missingThumbnails ?? '-'}</div>
              <div className="text-xs text-muted-foreground">ohne Vorschaubild</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{thumbnailStats.alreadyRepaired ?? '-'}</div>
              <div className="text-xs text-muted-foreground">mit Vorschaubild</div>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-md border p-4 bg-muted/30 text-center">
          <p className="text-xs text-muted-foreground">Keine Statistik verfügbar</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-2"
            onClick={loadThumbnailStats}
          >
            Statistik laden
          </Button>
        </div>
      )}

      {/* EINE Aktion fuer Vorschaubilder: fehlende ergaenzen, optional alle neu.
          Eine noetige Metadaten-Reparatur (variant-Felder) laeuft automatisch vorweg —
          frueher war sie ein eigener, nur manchmal sichtbarer dritter Button. */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">Vorschaubilder erneuern</p>
          <p className="text-xs text-muted-foreground">
            Erzeugt fehlende Vorschaubilder für alle Cover-Bilder.
            {(variantStats?.missingVariant ?? 0) > 0 &&
              ` Vorab werden ${variantStats?.missingVariant} Bild-Einträge ohne Typ-Markierung repariert.`}
          </p>
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox
              checked={regenerateAll}
              onCheckedChange={(v) => setRegenerateAll(v === true)}
              disabled={isBusy}
            />
            Alle neu berechnen (auch vorhandene, 640×640&nbsp;px)
          </label>
        </div>
        <Button type="button" variant="outline" onClick={() => void handleRun()} disabled={isBusy || runDisabled}>
          {isBusy ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {isRepairingVariants
                ? 'Repariere Metadaten...'
                : isRegeneratingThumbnails
                ? `Berechne... (${regenerateProgress}/${regenerateTotal})`
                : `Erneuere... (${repairProgress}/${repairTotal})`}
            </>
          ) : (
            <>
              {regenerateAll ? <RefreshCw className="h-4 w-4 mr-2" /> : <Wrench className="h-4 w-4 mr-2" />}
              Vorschaubilder erneuern
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
