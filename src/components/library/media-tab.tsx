"use client"

/**
 * @fileoverview Medien-Tab Komponente
 *
 * ViewType-gesteuerter Medien-Tab für die Transformation-Ansicht.
 * Zeigt basierend auf dem detailViewType die relevanten Medien-Sektionen:
 * - Coverbild (coverImageUrl)
 * - Personen-Bilder (speakers_image_url / authors_image_url, Index-basiert)
 * - Anhänge (attachments_url als string[])
 * - Galerie-Grid mit Geschwister-Dateien + binaryFragments
 *
 * Zuordnungsmodus: Slot-first (Benutzer wählt Slot, dann Medium aus Galerie)
 */

import { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Image as ImageIcon, User, Paperclip, X, Upload, FileText, Check, Globe, Link2, Sparkles, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { UILogger } from '@/lib/debug/logger'
import { parseCompositeSourceFilesFromMeta } from '@/lib/creation/composite-source-files-meta'
import { parseFrontmatter } from '@/lib/markdown/frontmatter'
// buildTwinRelativeMediaRef wurde mit der Galerie-Aggregation ausgegliedert
// (Welle 3-III-a, Schritt 2/4 — siehe use-gallery-items.ts).
import { VIEW_TYPE_REGISTRY, type DetailViewType, type ViewTypeMediaConfig } from '@/lib/detail-view-types/registry'
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
// fetchShadowTwinMarkdown + updateShadowTwinMarkdown wurden mit den
// 4 async-Helpers ausgegliedert und nur noch dort verwendet
// (Welle 3-II-c, Schritt 3/5).
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import type { StorageProvider } from '@/lib/storage/types'
// SiblingFile-Type wird jetzt nur noch im use-gallery-items-Hook verwendet
// (Welle 3-III-a, Schritt 2/4).
import { CoverImageGeneratorDialog, type PromptSource } from '@/components/library/cover-image-generator-dialog'
// Helpers + Types wurden in src/components/library/media-tab/helpers.ts
// ausgegliedert (Welle 3-II-c, Schritt 3/5).
import {
  type AssignmentTarget,
  type GalleryItem,
  safeArray,
  parseUrlFileContent,
  patchFrontmatterField,
  handleFileUpload,
  removeAttachment,
  removeArrayFieldItem,
} from './media-tab/helpers'
// Gallery-Items-Aggregation wurde in
// src/hooks/library/media-tab/use-gallery-items.ts ausgegliedert
// (Welle 3-III-a, Schritt 2/4).
import { useGalleryItems } from '@/hooks/library/media-tab/use-gallery-items'

export interface MediaTabProps {
  libraryId: string
  fileId: string
  effectiveMdId: string | null
  frontmatterMeta: Record<string, unknown> | null
  fullContent: string
  provider: StorageProvider | null
  libraryConfig?: Record<string, unknown>
  /** Template-Name für Artefakt-Patching */
  templateName: string | undefined
  /** Default-Prompt für Bildgenerierung im Medien-Tab */
  imageGenerationPrompt?: string
  imageGenerationPromptSource?: PromptSource
  imageGenerationOriginalPrompt?: string | null
  /** Callbacks für State-Updates im Parent */
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void
}

export function MediaTab({
  libraryId,
  fileId,
  effectiveMdId,
  frontmatterMeta,
  fullContent,
  provider,
  libraryConfig,
  templateName,
  imageGenerationPrompt,
  imageGenerationPromptSource,
  imageGenerationOriginalPrompt,
  onFrontmatterUpdate,
}: MediaTabProps) {
  // ViewType aus Frontmatter ermitteln
  const detailViewType = useMemo(() => {
    const cm = frontmatterMeta || {}
    return getDetailViewType(cm, libraryConfig)
  }, [frontmatterMeta, libraryConfig]) as DetailViewType

  const mediaConfig = useMemo<ViewTypeMediaConfig>(() => (
    VIEW_TYPE_REGISTRY[detailViewType]?.mediaConfig ?? {
      coverImage: true,
      attachments: false,
    }
  ), [detailViewType])

  /**
   * Quell-Dateinamen aus Sammel-/Mehrquellen-Kontext (`_source_files`).
   * Wichtig: Nach der Transformation fehlt oft `kind: composite-transcript`, während `_source_files`
   * erhalten bleibt — ohne diese Namen sendet die API nur die Anker-`.md`-ID und `pdfSections` bleiben leer.
   */
  const compositeSourceNames = useMemo(() => {
    if (frontmatterMeta) {
      const fromMeta = parseCompositeSourceFilesFromMeta(frontmatterMeta)
      if (fromMeta.length > 0) return fromMeta
    }
    if (fullContent?.trim()) {
      try {
        const { meta } = parseFrontmatter(fullContent)
        const fromBody = parseCompositeSourceFilesFromMeta(meta as Record<string, unknown>)
        if (fromBody.length > 0) return fromBody
      } catch {
        /* Frontmatter optional fehlerhaft — Aggregation nur mit Meta */
      }
    }
    return []
  }, [frontmatterMeta, fullContent])

  /** Explizites Sammel-Transkript (Obsidian-Referenzdatei) — nur für UI-Hinweise. */
  const isCompositeTranscript = useMemo(
    () => frontmatterMeta?.kind === 'composite-transcript',
    [frontmatterMeta?.kind]
  )

  /** Mehrquellen-Aggregation (PDF-Fragmente etc.), sobald `_source_files` befüllt ist. */
  const useMultiSourceAggregation = compositeSourceNames.length > 0

  // Zuordnungsmodus-State (Slot-first)
  const [activeAssignment, setActiveAssignment] = useState<AssignmentTarget | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isImageGeneratorOpen, setIsImageGeneratorOpen] = useState(false)

  // Galerie-Daten via Custom-Hook (Welle 3-III-a). Der Hook
  // kapselt API-Aufruf, Aggregation und Assignment-Filter.
  // siblingFiles + fragmentGalleryItems werden NICHT in der Komponente
  // gebraucht (nur intern im Hook fuer galleryItems-Aggregation).
  const {
    galleryLoading,
    aggregatedError,
    previewUrlByFileName,
    galleryItems,
  } = useGalleryItems({
    libraryId,
    fileId,
    useMultiSourceAggregation,
    compositeSourceNames,
    frontmatterMeta,
    mediaConfig,
    activeAssignment,
  })

  // Template-Name ermitteln (für Upload-API)
  const resolvedTemplateName = useMemo(() => {
    if (templateName) return templateName
    if (frontmatterMeta?.template_used) return String(frontmatterMeta.template_used)
    if (effectiveMdId && isMongoShadowTwinId(effectiveMdId)) {
      const parsed = parseMongoShadowTwinId(effectiveMdId)
      return parsed?.templateName
    }
    return undefined
  }, [templateName, frontmatterMeta, effectiveMdId])

  // Galerie-Item einem Slot zuordnen (Upload + Frontmatter-Patch)
  const handleAssignGalleryItem = useCallback(async (item: GalleryItem) => {
    if (!activeAssignment || !libraryId || !fileId) return

    setIsUploading(true)
    try {
      // Sonderfall: Link-Datei (.url/.webloc) → URL aus Dateiinhalt parsen, nicht hochladen
      if (item.mediaKind === 'link' && item.source === 'sibling') {
        if (!provider) {
          toast.error('Storage-Provider nicht verfügbar')
          return
        }
        const binaryResult = await provider.getBinary(item.id)
        if (!binaryResult) {
          toast.error('Link-Datei konnte nicht geladen werden')
          return
        }
        const text = await binaryResult.blob.text()
        const parsedUrl = parseUrlFileContent(text)
        if (!parsedUrl) {
          toast.error('Keine gültige URL in der Datei gefunden')
          return
        }
        // URL direkt ins Frontmatter schreiben (kein Upload nötig)
        await patchFrontmatterField(
          activeAssignment, parsedUrl, libraryId, fileId, effectiveMdId,
          frontmatterMeta, fullContent, provider, onFrontmatterUpdate,
        )
      } else if (item.source === 'fragment' && (item.previewUrl || item.frontmatterRef)) {
        // Fragment: Frontmatter mit Twin-Relativpfad (`_Quelle.pdf/fragment.jpeg`), damit Zuordnung eindeutig bleibt
        const valueToStore = item.frontmatterRef ?? item.name
        await patchFrontmatterField(
          activeAssignment, valueToStore, libraryId, fileId, effectiveMdId,
          frontmatterMeta, fullContent, provider, onFrontmatterUpdate,
        )
      } else if (
        item.source === 'sibling' &&
        item.mediaKind === 'image' &&
        effectiveMdId &&
        isMongoShadowTwinId(effectiveMdId)
      ) {
        // Bild liegt bereits im Quellordner (Nextcloud/…). Kein erneuter Upload nach Azure
        // (Mongo-Modus ohne Azure würde sonst scheitern). Kanonisch: nur Dateiname im Frontmatter.
        const clearStaleThumb =
          activeAssignment.fieldKey === 'coverImageUrl'
            ? ({ coverThumbnailUrl: undefined } as Record<string, unknown>)
            : undefined
        await patchFrontmatterField(
          activeAssignment,
          item.name,
          libraryId,
          fileId,
          effectiveMdId,
          frontmatterMeta,
          fullContent,
          provider,
          onFrontmatterUpdate,
          clearStaleThumb,
        )
      } else {
        // Sibling-Datei (z. B. PDF / kein Mongo-Meta): über Provider laden und via Upload-API
        if (!provider) {
          toast.error('Storage-Provider nicht verfügbar')
          return
        }
        const binaryResult = await provider.getBinary(item.id)
        if (!binaryResult) {
          toast.error('Datei konnte nicht geladen werden')
          return
        }
        const file = new File([binaryResult.blob], item.name, { type: binaryResult.mimeType || 'application/octet-stream' })

        const formData = new FormData()
        formData.append('file', file)
        formData.append('sourceId', fileId)
        formData.append('fieldKey', activeAssignment.fieldKey)
        formData.append('kind', 'transformation')
        formData.append('targetLanguage', 'de')
        if (resolvedTemplateName) formData.append('templateName', resolvedTemplateName)
        if (activeAssignment.arrayIndex !== undefined) {
          formData.append('arrayIndex', String(activeAssignment.arrayIndex))
        }
        if (activeAssignment.arrayAppend) {
          formData.append('arrayAppend', 'true')
        }

        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/upload-media`, {
          method: 'POST',
          body: formData,
        })

        if (!res.ok) {
          const errBody = await res.json().catch(() => ({})) as { error?: string | { error?: string } }
          const nested =
            typeof errBody.error === 'object' && errBody.error !== null && 'error' in errBody.error
              ? (errBody.error as { error?: string }).error
              : undefined
          const flat = typeof errBody.error === 'string' ? errBody.error : nested
          throw new Error(flat || `Upload fehlgeschlagen: ${res.status}`)
        }

        const result = await res.json() as { markdown: string }
        const { meta } = parseSecretaryMarkdownStrict(result.markdown)
        onFrontmatterUpdate(meta, result.markdown)
      }

      toast.success('Medium zugeordnet')
      setActiveAssignment(null)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      toast.error('Fehler: ' + msg)
      // Error-Objekte loggen sonst als {} (nicht enumerierbare message)
      UILogger.error('MediaTab', 'Fehler bei Medien-Zuordnung', {
        message: msg,
        itemId: item.id,
        itemName: item.name,
        itemSource: item.source,
        fieldKey: activeAssignment.fieldKey,
      })
    } finally {
      setIsUploading(false)
    }
  }, [activeAssignment, libraryId, fileId, effectiveMdId, frontmatterMeta, fullContent,
      provider, resolvedTemplateName, onFrontmatterUpdate])

  // Hilfsdaten aus Frontmatter
  const coverImageUrl = frontmatterMeta?.coverImageUrl as string | undefined
  const persons = mediaConfig.personField
    ? safeArray(frontmatterMeta?.[mediaConfig.personField.listKey])
    : []
  const personImages = mediaConfig.personField
    ? safeArray(frontmatterMeta?.[mediaConfig.personField.imageKey])
    : []
  const attachments = mediaConfig.attachments
    ? safeArray(frontmatterMeta?.attachments_url)
    : []
  const galleryImages = mediaConfig.galleryField
    ? safeArray(frontmatterMeta?.[mediaConfig.galleryField.key])
    : []
  const currentUrl = typeof frontmatterMeta?.url === 'string' ? frontmatterMeta.url : ''

  const fallbackImageGenerationTarget = useMemo<AssignmentTarget | null>(() => {
    // Galerie ist der sicherste Default, weil dort mehrere Bilder ergänzt werden können.
    if (mediaConfig.galleryField) {
      return { fieldKey: mediaConfig.galleryField.key, arrayAppend: true }
    }
    if (mediaConfig.coverImage) {
      return { fieldKey: 'coverImageUrl' }
    }
    if (mediaConfig.personField && persons.length === 1) {
      return { fieldKey: mediaConfig.personField.imageKey, arrayIndex: 0 }
    }
    return null
  }, [mediaConfig, persons.length])

  const canGenerateImageForActiveAssignment = useMemo(() => {
    if (!activeAssignment) return fallbackImageGenerationTarget !== null
    if (activeAssignment.fieldKey === 'url') return false
    if (activeAssignment.fieldKey === 'attachments_url') return false
    return true
  }, [activeAssignment, fallbackImageGenerationTarget])

  const effectiveImageGenerationTarget = useMemo<AssignmentTarget | null>(() => {
    if (!activeAssignment) return fallbackImageGenerationTarget
    if (activeAssignment.fieldKey === 'url') return null
    if (activeAssignment.fieldKey === 'attachments_url') return null
    return activeAssignment
  }, [activeAssignment, fallbackImageGenerationTarget])

  // ─────────────────────────────────────────────────────────────────────
  // Live-Check: ist der aktuelle coverImageUrl-Wert in den verfuegbaren
  // Medien vorhanden? Funktioniert auch fuer Alt-Daten (kein Frontmatter-
  // Feld noetig). Liefert null wenn alles ok ODER noch keine Daten geladen.
  // (siehe docs/refactor/cover-image-deterministic-flow/01-analysis.md §5)
  // ─────────────────────────────────────────────────────────────────────
  const coverImageMissingValue = useMemo<string | null>(() => {
    if (!coverImageUrl || typeof coverImageUrl !== 'string') return null
    if (galleryLoading) return null
    const trimmed = coverImageUrl.trim()
    if (!trimmed) return null
    // Absolute URLs koennen nicht via Sibling gepruefte werden — nicht als "missing" werten
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('blob:') ||
      trimmed.startsWith('data:') ||
      trimmed.startsWith('/api/storage/')
    ) {
      return null
    }
    const exists = galleryItems.some(
      item => item.name === trimmed || item.frontmatterRef === trimmed,
    )
    return exists ? null : trimmed
  }, [coverImageUrl, galleryLoading, galleryItems])

  return (
    <div className="space-y-4">
      {/* Coverbild-Sektion */}
      {mediaConfig.coverImage && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" /> Coverbild
          </h4>
          {/* Live-Validierungs-Banner: zeigt an, wenn coverImageUrl auf nicht-existente Datei verweist */}
          {coverImageMissingValue && (
            <Alert variant="destructive" className="py-2">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="text-xs">Cover-Bild nicht gefunden</AlertTitle>
              <AlertDescription className="text-xs">
                &quot;{coverImageMissingValue}&quot; existiert nicht im Verzeichnis.{' '}
                {galleryItems.length > 0
                  ? `Verfuegbar: ${galleryItems.slice(0, 3).map(i => i.name).join(', ')}${galleryItems.length > 3 ? ', ...' : ''}`
                  : 'Keine Bilder im Verzeichnis vorhanden.'}
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center gap-3">
            {coverImageUrl ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                {(() => {
                  const label = typeof coverImageUrl === 'string' ? coverImageUrl.split('/').pop() || coverImageUrl : '–'
                  const thumb = typeof coverImageUrl === 'string' ? previewUrlByFileName.get(coverImageUrl) || previewUrlByFileName.get(label) : undefined
                  return (
                    <>
                      {thumb ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={thumb}
                          alt=""
                          title={label}
                          className="h-10 w-10 rounded object-cover border border-muted shrink-0"
                          loading="lazy"
                        />
                      ) : null}
                      <code className="bg-muted px-1 py-0.5 rounded truncate max-w-[200px]" title={label}>{label}</code>
                    </>
                  )
                })()}
              </div>
            ) : (
              <span className="text-xs text-muted-foreground italic">Kein Coverbild zugeordnet</span>
            )}
            <Button
              variant={activeAssignment?.fieldKey === 'coverImageUrl' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setActiveAssignment(
                activeAssignment?.fieldKey === 'coverImageUrl' ? null : { fieldKey: 'coverImageUrl' }
              )}
              disabled={isUploading}
            >
              {activeAssignment?.fieldKey === 'coverImageUrl' ? 'Abbrechen' : 'Zuordnen'}
            </Button>
          </div>
        </section>
      )}

      {/* Personen-Bilder-Sektion */}
      {mediaConfig.personField && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <User className="h-4 w-4" /> {mediaConfig.personField.label}
          </h4>
          {persons.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">
              Keine {mediaConfig.personField.label} im Frontmatter definiert ({mediaConfig.personField.listKey}).
            </p>
          ) : (
            <div className="space-y-1.5">
              {persons.map((person, idx) => {
                const imageUrl = personImages[idx]
                const isActive = activeAssignment?.fieldKey === mediaConfig.personField!.imageKey
                  && activeAssignment?.arrayIndex === idx
                return (
                  <div key={idx} className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs border ${
                    isActive ? 'border-primary bg-primary/5 ring-1 ring-primary/30' : 'border-muted'
                  }`}>
                    {/* Bild-Vorschau oder Platzhalter */}
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {imageUrl ? (
                        (() => {
                          const lab = typeof imageUrl === 'string' ? imageUrl.split('/').pop() || imageUrl : ''
                          const thumb = typeof imageUrl === 'string' ? previewUrlByFileName.get(imageUrl) || previewUrlByFileName.get(lab) : undefined
                          return thumb ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={thumb} alt="" title={lab} className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-[10px] text-muted-foreground truncate px-0.5" title={imageUrl}>
                              {lab.substring(0, 6)}...
                            </span>
                          )
                        })()
                      ) : (
                        <User className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <span className="flex-1 truncate">{person}</span>
                    <Button
                      variant={isActive ? 'default' : 'outline'}
                      size="sm"
                      className="text-xs h-6 px-2"
                      onClick={() => setActiveAssignment(
                        isActive ? null : { fieldKey: mediaConfig.personField!.imageKey, arrayIndex: idx }
                      )}
                      disabled={isUploading}
                    >
                      {isActive ? 'Abbrechen' : imageUrl ? 'Ändern' : 'Zuordnen'}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      )}

      {/* Anhänge-Sektion */}
      {mediaConfig.attachments && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Paperclip className="h-4 w-4" /> Anhänge
          </h4>
          {attachments.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs px-2 py-1 border rounded border-muted">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{att}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => removeAttachment(idx, libraryId, fileId, effectiveMdId,
                      frontmatterMeta, fullContent, provider, onFrontmatterUpdate)}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            variant={activeAssignment?.fieldKey === 'attachments_url' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setActiveAssignment(
              activeAssignment?.fieldKey === 'attachments_url' ? null : { fieldKey: 'attachments_url', arrayAppend: true }
            )}
            disabled={isUploading}
          >
            {activeAssignment?.fieldKey === 'attachments_url' ? 'Abbrechen' : '+ Anhang hinzufügen'}
          </Button>
        </section>
      )}

      {/* Galerie-Sektion */}
      {mediaConfig.galleryField && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" /> {mediaConfig.galleryField.label}
          </h4>
          {galleryImages.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-1.5">
              {galleryImages.map((img, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs px-2 py-1 border rounded border-muted">
                  {(() => {
                    const lab = img.split('/').pop() || img
                    const thumb = previewUrlByFileName.get(img) || previewUrlByFileName.get(lab)
                    return thumb ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={thumb} alt="" title={img} className="h-8 w-8 rounded object-cover shrink-0 border border-muted" loading="lazy" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    )
                  })()}
                  <span className="flex-1 truncate" title={img}>{img}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={() => removeArrayFieldItem(
                      mediaConfig.galleryField!.key,
                      idx,
                      libraryId,
                      effectiveMdId,
                      onFrontmatterUpdate
                    )}
                    disabled={isUploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Keine Galerie-Bilder zugeordnet.</p>
          )}
          <Button
            variant={activeAssignment?.fieldKey === mediaConfig.galleryField.key ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7"
            onClick={() => setActiveAssignment(
              activeAssignment?.fieldKey === mediaConfig.galleryField!.key
                ? null
                : { fieldKey: mediaConfig.galleryField!.key, arrayAppend: true }
            )}
            disabled={isUploading}
          >
            {activeAssignment?.fieldKey === mediaConfig.galleryField.key ? 'Abbrechen' : '+ Bild zur Galerie'}
          </Button>
        </section>
      )}

      {/* URL-Sektion (Web-Links aus .url-Dateien zuordnen) */}
      {mediaConfig.urlField && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <Globe className="h-4 w-4" /> URL
          </h4>
          <div className="flex items-center gap-3">
            {currentUrl ? (
              <a
                href={currentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary hover:underline flex items-center gap-1 max-w-[80%] truncate"
              >
                <Link2 className="h-3 w-3 flex-shrink-0" />
                {currentUrl}
              </a>
            ) : (
              <span className="text-xs text-muted-foreground italic">Keine URL zugeordnet</span>
            )}
            <Button
              variant={activeAssignment?.fieldKey === 'url' ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => setActiveAssignment(
                activeAssignment?.fieldKey === 'url' ? null : { fieldKey: 'url' }
              )}
              disabled={isUploading}
            >
              {activeAssignment?.fieldKey === 'url' ? 'Abbrechen' : currentUrl ? 'Ändern' : 'Zuordnen'}
            </Button>
          </div>
          {activeAssignment?.fieldKey === 'url' && (
            <p className="text-[10px] text-muted-foreground">
              Wählen Sie eine <code className="bg-muted px-1 py-0.5 rounded">.url</code>-Datei aus der Galerie, um die enthaltene URL zuzuweisen.
            </p>
          )}
        </section>
      )}

      {/* Datei-Upload-Button */}
      <section className="pt-2 border-t">
        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept={activeAssignment?.fieldKey === 'attachments_url' ? '.pdf,image/*' : 'image/*,.pdf'}
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file || !activeAssignment) {
                  if (file && !activeAssignment) toast.info('Bitte zuerst einen Slot auswählen')
                  return
                }
                await handleFileUpload(file, activeAssignment, libraryId, fileId,
                  resolvedTemplateName, onFrontmatterUpdate, setIsUploading)
                e.target.value = ''
              }}
              className="hidden"
              disabled={isUploading || !activeAssignment}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs h-7"
              disabled={isUploading || !activeAssignment}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              {isUploading ? 'Lädt...' : 'Datei hochladen'}
            </Button>
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={() => {
              if (!effectiveImageGenerationTarget) {
                toast.info('Für dieses Dokument ist aktuell kein Bild-Ziel verfügbar')
                return
              }
              setIsImageGeneratorOpen(true)
            }}
            disabled={isUploading || !canGenerateImageForActiveAssignment}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Bild generieren
          </Button>
        </div>
        {!activeAssignment && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Wählen Sie zuerst einen Slot oben aus, um eine Datei hochzuladen oder zuzuordnen.
          </p>
        )}
        {!activeAssignment && fallbackImageGenerationTarget ? (
          <p className="text-[10px] text-muted-foreground mt-1">
            Ohne aktive Auswahl wird ein generiertes Bild standardmäßig {fallbackImageGenerationTarget.arrayAppend ? 'zur Bildergalerie hinzugefügt' : 'dem Coverbild zugeordnet'}.
          </p>
        ) : null}
        {activeAssignment && !canGenerateImageForActiveAssignment ? (
          <p className="text-[10px] text-muted-foreground mt-1">
            Bildgenerierung ist für Bild-Slots verfügbar, nicht für URL oder Anhänge.
          </p>
        ) : null}
      </section>

      <CoverImageGeneratorDialog
        open={isImageGeneratorOpen}
        onOpenChange={setIsImageGeneratorOpen}
        defaultPrompt={imageGenerationPrompt || ''}
        promptSource={imageGenerationPromptSource}
        originalPrompt={imageGenerationOriginalPrompt || null}
        onGenerated={async (file) => {
          if (!effectiveImageGenerationTarget) {
            throw new Error('Kein Ziel-Slot für die Bildgenerierung verfügbar')
          }
          await handleFileUpload(
            file,
            effectiveImageGenerationTarget,
            libraryId,
            fileId,
            resolvedTemplateName,
            onFrontmatterUpdate,
            setIsUploading,
          )
        }}
      />

      {/* Galerie-Grid: Medien aus dem Quellverzeichnis + binaryFragments */}
      <section className="pt-2 border-t">
        <h4 className="text-xs text-muted-foreground mb-2">
          Verfügbare Medien im Verzeichnis ({galleryItems.length})
          {activeAssignment && (
            <span className="text-primary ml-1">
              — Klicken Sie auf ein Medium, um es zuzuordnen
            </span>
          )}
        </h4>
        {useMultiSourceAggregation ? (
          <p className="text-[10px] text-muted-foreground mb-1">
            {isCompositeTranscript ? 'Sammeltranskript:' : 'Mehrquellen-Kontext:'} PDF-Bildfragmente werden aus allen Einträgen in{' '}
            <code className="bg-muted px-0.5 rounded">_source_files</code> geladen (sofern Shadow-Twin-Fragmente in Mongo vorliegen).
          </p>
        ) : null}
        {aggregatedError ? (
          <p className="text-[10px] text-destructive mb-2">
            Medien-Aggregation: {aggregatedError}
          </p>
        ) : null}
        {galleryLoading ? (
          <div className="text-xs text-muted-foreground">Lade Medien (Ordner + Fragmente)…</div>
        ) : galleryItems.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">Keine Medien-Dateien im Verzeichnis gefunden.</div>
        ) : (
          <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2">
            {galleryItems.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => activeAssignment && handleAssignGalleryItem(item)}
                disabled={isUploading || !activeAssignment}
                className={`
                  relative aspect-square rounded-md overflow-hidden border-2 transition-all text-left
                  ${activeAssignment
                    ? 'cursor-pointer hover:border-primary/50 hover:ring-1 hover:ring-primary/20'
                    : 'cursor-default opacity-70'
                  }
                  ${item.assignedTo ? 'border-primary/40' : 'border-transparent'}
                  ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
                `}
                title={item.sourceFileName ? `${item.name} — Quelle: ${item.sourceFileName}` : item.name}
              >
                {item.mediaKind === 'image' && item.previewUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-muted flex flex-col items-center justify-center p-1">
                    {item.mediaKind === 'link' ? (
                      <Globe className="h-5 w-5 text-blue-500" />
                    ) : item.mediaKind === 'pdf' ? (
                      <FileText className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted-foreground" />
                    )}
                    <span className="text-[9px] text-muted-foreground mt-0.5 truncate w-full text-center">
                      {item.name.length > 12 ? item.name.substring(0, 10) + '...' : item.name}
                    </span>
                  </div>
                )}
                {/* Zuordnungs-Badge */}
                {item.assignedTo && (
                  <div className="absolute top-0.5 right-0.5 bg-primary text-primary-foreground rounded-full w-4 h-4 flex items-center justify-center">
                    <Check className="h-2.5 w-2.5" />
                  </div>
                )}
                {/* Quelle: Sibling = gleicher Ordner im Storage (Nextcloud/WebDAV etc.), kein Mongo-Fragment */}
                {item.source === 'sibling' && (
                  <div
                    className="absolute bottom-0.5 left-0.5 bg-amber-500/80 text-white text-[8px] px-1 rounded"
                    title="Geschwisterdatei im Quellordner (Storage-Listing), nicht aus Mongo-binaryFragments"
                  >
                    lokal
                  </div>
                )}
                {item.source === 'fragment' && item.sourceFileName && (
                  <div className="absolute bottom-0.5 right-0.5 bg-slate-600/85 text-white text-[8px] px-1 rounded max-w-[90%] truncate" title={item.sourceFileName}>
                    {item.sourceFileName.length > 14 ? `${item.sourceFileName.slice(0, 12)}…` : item.sourceFileName}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

