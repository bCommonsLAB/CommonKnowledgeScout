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

import { useEffect, useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Image as ImageIcon, User, Paperclip, X, Upload, FileText, Check, Globe, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { UILogger } from '@/lib/debug/logger'
import { VIEW_TYPE_REGISTRY, type DetailViewType, type ViewTypeMediaConfig } from '@/lib/detail-view-types/registry'
import { getDetailViewType } from '@/lib/templates/detail-view-type-utils'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { fetchShadowTwinMarkdown, updateShadowTwinMarkdown } from '@/lib/shadow-twin/shadow-twin-mongo-client'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import type { StorageProvider } from '@/lib/storage/types'
import type { SiblingFile } from '@/app/api/library/[libraryId]/sibling-files/route'

/** Ziel für die Slot-first-Zuordnung */
interface AssignmentTarget {
  fieldKey: string
  arrayIndex?: number
  arrayAppend?: boolean
}

/** Eintrag in der kombinierten Galerie */
interface GalleryItem {
  id: string
  name: string
  /** Quelle: 'sibling' (Verzeichnis) oder 'fragment' (binaryFragments/Azure) */
  source: 'sibling' | 'fragment'
  mediaKind: 'image' | 'pdf' | 'document' | 'link'
  /** Vorschau-URL (Thumbnail oder Original) */
  previewUrl?: string
  /** Bereits einem Feld zugeordnet? */
  assignedTo?: string
  size?: number
}

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
  onFrontmatterUpdate,
}: MediaTabProps) {
  // ViewType aus Frontmatter ermitteln
  const detailViewType = useMemo(() => {
    const cm = frontmatterMeta || {}
    return getDetailViewType(cm, libraryConfig)
  }, [frontmatterMeta, libraryConfig]) as DetailViewType

  const mediaConfig: ViewTypeMediaConfig = VIEW_TYPE_REGISTRY[detailViewType]?.mediaConfig ?? {
    coverImage: true, attachments: false,
  }

  // Zuordnungsmodus-State (Slot-first)
  const [activeAssignment, setActiveAssignment] = useState<AssignmentTarget | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Galerie-Daten
  const [siblingFiles, setSiblingFiles] = useState<SiblingFile[]>([])
  const [binaryFragments, setBinaryFragments] = useState<Array<{
    name: string; resolvedUrl?: string; kind?: string; variant?: string; hash?: string
  }>>([])
  const [isLoadingGallery, setIsLoadingGallery] = useState(false)

  // Geschwister-Dateien laden
  useEffect(() => {
    if (!libraryId || !fileId) return
    let cancelled = false

    async function loadSiblings() {
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/sibling-files`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceId: fileId }),
        })
        if (res.ok && !cancelled) {
          const json = await res.json() as { files: SiblingFile[] }
          setSiblingFiles(json.files)
        }
      } catch (error) {
        UILogger.warn('MediaTab', 'Fehler beim Laden der Geschwister-Dateien', { error })
      }
    }
    void loadSiblings()
    return () => { cancelled = true }
  }, [libraryId, fileId])

  // Binary Fragments laden
  useEffect(() => {
    if (!libraryId || !fileId) return
    let cancelled = false

    async function loadFragments() {
      setIsLoadingGallery(true)
      try {
        const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/binary-fragments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourceIds: [fileId] }),
        })
        if (res.ok && !cancelled) {
          const json = await res.json() as { fragments: typeof binaryFragments }
          setBinaryFragments(json.fragments)
        }
      } catch (error) {
        UILogger.warn('MediaTab', 'Fehler beim Laden der binaryFragments', { error })
      } finally {
        if (!cancelled) setIsLoadingGallery(false)
      }
    }
    void loadFragments()
    return () => { cancelled = true }
  }, [libraryId, fileId])

  // Kombinierte Galerie: Siblings + Fragments, dedupliziert nach Name
  const galleryItems = useMemo((): GalleryItem[] => {
    const items = new Map<string, GalleryItem>()

    // binaryFragments zuerst (haben Vorschau-URLs)
    for (const frag of binaryFragments) {
      if (!frag.name || frag.variant === 'thumbnail') continue
      const kind = frag.kind === 'image' ? 'image' as const : 'document' as const
      items.set(frag.name, {
        id: `frag-${frag.name}`,
        name: frag.name,
        source: 'fragment',
        mediaKind: kind,
        previewUrl: frag.resolvedUrl,
      })
    }

    // Siblings (nur wenn nicht bereits als Fragment vorhanden)
    // Vorschau-URL via provider-agnostische streaming-url Route
    for (const sib of siblingFiles) {
      if (items.has(sib.name)) continue
      const previewUrl = sib.mediaKind === 'image'
        ? `/api/storage/streaming-url?libraryId=${encodeURIComponent(libraryId)}&fileId=${encodeURIComponent(sib.id)}`
        : undefined
      const kind = sib.mediaKind === 'pdf' ? 'pdf' as const
        : sib.mediaKind === 'link' ? 'link' as const
        : 'image' as const
      items.set(sib.name, {
        id: sib.id,
        name: sib.name,
        source: 'sibling',
        mediaKind: kind,
        previewUrl,
        size: sib.size,
      })
    }

    // Markiere zugeordnete Dateien
    if (frontmatterMeta) {
      const coverUrl = frontmatterMeta.coverImageUrl as string | undefined
      if (coverUrl) {
        const item = items.get(coverUrl) || items.get(coverUrl.split('/').pop() || '')
        if (item) item.assignedTo = 'coverImageUrl'
      }
      if (mediaConfig.personField) {
        const imageUrls = frontmatterMeta[mediaConfig.personField.imageKey]
        if (Array.isArray(imageUrls)) {
          for (const url of imageUrls) {
            if (typeof url === 'string') {
              const item = items.get(url) || items.get(url.split('/').pop() || '')
              if (item) item.assignedTo = mediaConfig.personField.imageKey
            }
          }
        }
      }
      if (mediaConfig.galleryField) {
        const galleryUrls = safeArray(frontmatterMeta[mediaConfig.galleryField.key])
        for (const url of galleryUrls) {
          const item = items.get(url) || items.get(url.split('/').pop() || '')
          if (item) item.assignedTo = mediaConfig.galleryField.key
        }
      }
      const attachmentUrls = safeArray(frontmatterMeta.attachments_url)
      for (const url of attachmentUrls) {
        const item = items.get(url) || items.get(url.split('/').pop() || '')
        if (item) item.assignedTo = 'attachments_url'
      }
    }

    // Filtern basierend auf aktivem Assignment
    const result = Array.from(items.values())
    if (activeAssignment) {
      if (activeAssignment.fieldKey === 'url') {
        return result.filter(item => item.mediaKind === 'link')
      }
      if (activeAssignment.fieldKey === 'attachments_url') {
        return result.filter(item => item.mediaKind !== 'link')
      }
      return result.filter(item => item.mediaKind === 'image')
    }
    return result
  }, [siblingFiles, binaryFragments, frontmatterMeta, mediaConfig, activeAssignment])

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
      } else if (item.source === 'fragment' && item.previewUrl) {
        // Bereits hochgeladen: Nur Frontmatter patchen
        await patchFrontmatterField(
          activeAssignment, item.name, libraryId, fileId, effectiveMdId,
          frontmatterMeta, fullContent, provider, onFrontmatterUpdate,
        )
      } else {
        // Sibling-Datei: Über Provider laden und via Upload-API hochladen
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
          const err = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(err.error || `Upload fehlgeschlagen: ${res.status}`)
        }

        const result = await res.json() as { markdown: string }
        const { meta } = parseSecretaryMarkdownStrict(result.markdown)
        onFrontmatterUpdate(meta, result.markdown)
      }

      toast.success('Medium zugeordnet')
      setActiveAssignment(null)
    } catch (error) {
      toast.error('Fehler: ' + (error instanceof Error ? error.message : 'Unbekannt'))
      UILogger.error('MediaTab', 'Fehler bei Medien-Zuordnung', { error, item, activeAssignment })
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

  return (
    <div className="space-y-4">
      {/* Coverbild-Sektion */}
      {mediaConfig.coverImage && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold flex items-center gap-1.5">
            <ImageIcon className="h-4 w-4" /> Coverbild
          </h4>
          <div className="flex items-center gap-3">
            {coverImageUrl ? (
              <div className="text-xs text-muted-foreground">
                <code className="bg-muted px-1 py-0.5 rounded">{typeof coverImageUrl === 'string' ? coverImageUrl.split('/').pop() : '–'}</code>
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
                        <span className="text-[10px] text-muted-foreground truncate px-0.5" title={imageUrl}>
                          {typeof imageUrl === 'string' ? imageUrl.split('/').pop()?.substring(0, 6) : ''}...
                        </span>
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
                  <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">{img}</span>
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
        {!activeAssignment && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Wählen Sie zuerst einen Slot oben aus, um eine Datei hochzuladen oder zuzuordnen.
          </p>
        )}
      </section>

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
        {isLoadingGallery ? (
          <div className="text-xs text-muted-foreground">Lade Medien...</div>
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
                title={item.name}
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
                {/* Quelle: Sibling vs Fragment */}
                {item.source === 'sibling' && (
                  <div className="absolute bottom-0.5 left-0.5 bg-amber-500/80 text-white text-[8px] px-1 rounded">
                    lokal
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

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

/** Konvertiert einen unbekannten Wert sicher in ein String-Array */
function safeArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string')
  if (typeof value === 'string' && value.trim().length > 0) {
    const trimmed = value.trim()
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed.replace(/'/g, '"'))
        if (Array.isArray(parsed)) {
          return parsed.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        }
      } catch {
        // Fallback auf Einzelwert
      }
    }
    return [trimmed]
  }
  return []
}

/** Patcht ein Frontmatter-Feld direkt (ohne Upload, für bereits vorhandene Fragments) */
async function patchFrontmatterField(
  target: AssignmentTarget,
  fileName: string,
  libraryId: string,
  fileId: string,
  effectiveMdId: string | null,
  frontmatterMeta: Record<string, unknown> | null,
  fullContent: string,
  provider: StorageProvider | null,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
) {
  if (!effectiveMdId || !isMongoShadowTwinId(effectiveMdId)) {
    toast.error('Nur für MongoDB-Shadow-Twins unterstützt')
    return
  }
  const parts = parseMongoShadowTwinId(effectiveMdId)
  if (!parts) {
    toast.error('Ungültige Dokument-ID')
    return
  }

  const mdResult = await fetchShadowTwinMarkdown(libraryId, parts)
  if (!mdResult) throw new Error('Markdown konnte nicht geladen werden')

  const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
  let patches: Record<string, unknown>

  if (target.arrayIndex !== undefined) {
    // Array-Feld: Index setzen
    const { meta } = parseSecretaryMarkdownStrict(mdResult)
    const current = Array.isArray(meta[target.fieldKey]) ? [...(meta[target.fieldKey] as string[])] : []
    while (current.length <= target.arrayIndex) current.push('')
    current[target.arrayIndex] = fileName
    patches = { [target.fieldKey]: JSON.stringify(current) }
  } else if (target.arrayAppend) {
    // Array-Feld: Anhängen
    const { meta } = parseSecretaryMarkdownStrict(mdResult)
    const current = Array.isArray(meta[target.fieldKey]) ? [...(meta[target.fieldKey] as string[])] : []
    current.push(fileName)
    patches = { [target.fieldKey]: JSON.stringify(current) }
  } else {
    // String-Feld
    patches = { [target.fieldKey]: fileName }
  }

  const patchedMarkdown = patchFrontmatter(mdResult, patches as Record<string, string>)
  await updateShadowTwinMarkdown(libraryId, parts, patchedMarkdown)

  const { meta } = parseSecretaryMarkdownStrict(patchedMarkdown)
  onFrontmatterUpdate(meta, patchedMarkdown)
}

/** Datei-Upload über die generalisierte Upload-API */
async function handleFileUpload(
  file: File,
  target: AssignmentTarget,
  libraryId: string,
  fileId: string,
  templateName: string | undefined,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
  setIsUploading: (v: boolean) => void,
) {
  setIsUploading(true)
  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('sourceId', fileId)
    formData.append('fieldKey', target.fieldKey)
    formData.append('kind', 'transformation')
    formData.append('targetLanguage', 'de')
    if (templateName) formData.append('templateName', templateName)
    if (target.arrayIndex !== undefined) formData.append('arrayIndex', String(target.arrayIndex))
    if (target.arrayAppend) formData.append('arrayAppend', 'true')

    const res = await fetch(`/api/library/${encodeURIComponent(libraryId)}/shadow-twins/upload-media`, {
      method: 'POST',
      body: formData,
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(err.error || `Upload fehlgeschlagen: ${res.status}`)
    }

    const result = await res.json() as { markdown: string }
    const { meta } = parseSecretaryMarkdownStrict(result.markdown)
    onFrontmatterUpdate(meta, result.markdown)
    toast.success('Datei hochgeladen und zugeordnet')
  } catch (error) {
    toast.error('Upload-Fehler: ' + (error instanceof Error ? error.message : 'Unbekannt'))
  } finally {
    setIsUploading(false)
  }
}

/** Entfernt einen Anhang aus dem attachments_url-Array */
async function removeAttachment(
  index: number,
  libraryId: string,
  fileId: string,
  effectiveMdId: string | null,
  frontmatterMeta: Record<string, unknown> | null,
  fullContent: string,
  provider: StorageProvider | null,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
) {
  if (!effectiveMdId || !isMongoShadowTwinId(effectiveMdId)) return
  const parts = parseMongoShadowTwinId(effectiveMdId)
  if (!parts) return

  const mdResult = await fetchShadowTwinMarkdown(libraryId, parts)
  if (!mdResult) return

  const { meta } = parseSecretaryMarkdownStrict(mdResult)
  const current = safeArray(meta.attachments_url)
  current.splice(index, 1)

  const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
  const patchedMarkdown = patchFrontmatter(mdResult, { attachments_url: JSON.stringify(current) })
  await updateShadowTwinMarkdown(libraryId, parts, patchedMarkdown)

  const { meta: newMeta } = parseSecretaryMarkdownStrict(patchedMarkdown)
  onFrontmatterUpdate(newMeta, patchedMarkdown)
  toast.success('Anhang entfernt')
}

/** Entfernt einen Eintrag aus einem beliebigen Array-Frontmatter-Feld */
async function removeArrayFieldItem(
  fieldKey: string,
  index: number,
  libraryId: string,
  effectiveMdId: string | null,
  onFrontmatterUpdate: (meta: Record<string, unknown>, fullContent: string) => void,
) {
  if (!effectiveMdId || !isMongoShadowTwinId(effectiveMdId)) return
  const parts = parseMongoShadowTwinId(effectiveMdId)
  if (!parts) return

  const mdResult = await fetchShadowTwinMarkdown(libraryId, parts)
  if (!mdResult) return

  const { meta } = parseSecretaryMarkdownStrict(mdResult)
  const current = safeArray(meta[fieldKey])
  if (index < 0 || index >= current.length) return
  current.splice(index, 1)

  const { patchFrontmatter } = await import('@/lib/markdown/frontmatter-patch')
  const patchedMarkdown = patchFrontmatter(mdResult, { [fieldKey]: JSON.stringify(current) })
  await updateShadowTwinMarkdown(libraryId, parts, patchedMarkdown)

  const { meta: newMeta } = parseSecretaryMarkdownStrict(patchedMarkdown)
  onFrontmatterUpdate(newMeta, patchedMarkdown)
  toast.success('Eintrag entfernt')
}

/**
 * Parst den Inhalt einer .url-Datei (Windows Internet Shortcut) oder .webloc-Datei (macOS).
 * Extrahiert die URL aus dem Dateiformat.
 *
 * Windows .url Format:
 *   [InternetShortcut]
 *   URL=https://example.com
 *
 * macOS .webloc Format (XML plist):
 *   <string>https://example.com</string>
 */
function parseUrlFileContent(content: string): string | null {
  // Windows .url Format
  const urlMatch = content.match(/^URL\s*=\s*(.+)$/mi)
  if (urlMatch) {
    const url = urlMatch[1].trim()
    if (url.startsWith('http://') || url.startsWith('https://')) return url
  }

  // macOS .webloc Format (XML plist mit <string>URL</string>)
  const weblocMatch = content.match(/<string>(https?:\/\/[^<]+)<\/string>/i)
  if (weblocMatch) return weblocMatch[1]

  // Fallback: Erste URL im Text finden
  const genericMatch = content.match(/(https?:\/\/\S+)/i)
  if (genericMatch) return genericMatch[1]

  return null
}
