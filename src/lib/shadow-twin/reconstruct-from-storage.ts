/**
 * @fileoverview Rekonstruktion von Shadow-Twin-Artefakten aus dem Storage
 *
 * @description
 * Scannt einen Shadow-Twin-Ordner im Storage und erstellt fehlende
 * MongoDB-Eintraege aus den vorhandenen Artefakt-Dateien.
 *
 * Wird verwendet von:
 * - /api/.../shadow-twins/reconstruct (manueller Button)
 * - /api/.../artifacts/resolve (automatische Lazy-Rekonstruktion)
 *
 * @module shadow-twin
 */

import { parseArtifactName } from '@/lib/shadow-twin/artifact-naming'
import { selectFullestStorageVariant } from '@/lib/shadow-twin/select-fullest-storage-variant'
import { upsertShadowTwinArtifact } from '@/lib/repositories/shadow-twin-repo'
import { persistShadowTwinToMongo } from '@/lib/shadow-twin/shadow-twin-mongo-writer'
import { ShadowTwinService } from '@/lib/shadow-twin/store/shadow-twin-service'
import { LibraryService } from '@/lib/services/library-service'
import { getShadowTwinConfig } from '@/lib/shadow-twin/shadow-twin-config'
import { FileLogger } from '@/lib/debug/logger'
import type { StorageItem, StorageProvider } from '@/lib/storage/types'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'

/** Bekannte Bild-Endungen fuer Seiten-Renderings/Previews. */
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i
/** Seiten-Renderings (HighRes): page_001.jpeg etc. */
const PAGE_RENDER_RE = /^page_(\d+)\.(jpe?g|png|webp)$/i
/** Vorschau-Bilder (Thumbnails): preview_001.jpg etc. */
const PREVIEW_RE = /^preview_(\d+)\.(jpe?g|png|webp)$/i

/**
 * True, wenn die Datei ein registrierbares Seiten-Rendering/Preview ist
 * (page_NNN.* / preview_NNN.*). Genutzt fuer die Dry-Run-Zaehlung im Reconcile.
 */
export function isReconstructablePageImage(name: string): boolean {
  return IMAGE_EXT_RE.test(name) && (PAGE_RENDER_RE.test(name) || PREVIEW_RE.test(name))
}

/** MIME-Type aus Dateiendung ableiten (nur Bild-Formate). */
function imageMimeFromName(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith('.png')) return 'image/png'
  if (lower.endsWith('.webp')) return 'image/webp'
  return 'image/jpeg'
}

/** 1-basierte Seitennummer aus page_NNN/preview_NNN extrahieren (oder undefined). */
function parsePageNumber(name: string): number | undefined {
  const match = name.match(/_(\d+)\./)
  if (!match) return undefined
  const num = Number.parseInt(match[1], 10)
  return Number.isFinite(num) ? num : undefined
}

/** Ergebnis pro rekonstruiertem Artefakt */
export interface ReconstructedArtifact {
  fileName: string
  kind: string
  targetLanguage: string | null
  templateName: string | null
  success: boolean
  error?: string
}

/**
 * Liest alle Markdown-Dateien aus dem Shadow-Twin-Ordner und erstellt
 * MongoDB-Eintraege daraus.
 *
 * Idempotent: upsertShadowTwinArtifact aktualisiert bestehende Eintraege.
 */
export async function reconstructFromFolder(args: {
  provider: StorageProvider
  libraryId: string
  userEmail: string
  sourceId: string
  sourceName: string
  parentId: string
  shadowTwinFolderId: string
}): Promise<ReconstructedArtifact[]> {
  const { provider, libraryId, userEmail, sourceId, sourceName, parentId, shadowTwinFolderId } = args
  const results: ReconstructedArtifact[] = []

  const items = await provider.listItemsById(shadowTwinFolderId)
  const mdFiles = items.filter(
    (item) => item.type === 'file' && item.metadata.name.endsWith('.md')
  )

  if (mdFiles.length === 0) {
    FileLogger.info('shadow-twins/reconstruct', 'Keine Markdown-Dateien im Shadow-Twin-Ordner gefunden', {
      sourceId, shadowTwinFolderId,
    })
    return results
  }

  // Basisname der Quelldatei fuer parseArtifactName
  const sourceBaseName = sourceName.replace(/\.[^.]+$/, '')

  // Transkript ist sprach-neutral (genau EIN Record). Bei mehreren Varianten
  // ({base}.md + {base}.{lang}.md) darf NICHT die zuletzt verarbeitete gewinnen
  // (das hat _Ökoniomie_en_Innen.pdf zerstoert). Vorab den VOLLSTAENDIGSTEN bestimmen;
  // im Loop werden alle anderen Transkript-Varianten uebersprungen.
  const transcriptCandidates = mdFiles.filter(
    (f) =>
      f.metadata.name.startsWith(`${sourceBaseName}.`) &&
      parseArtifactName(f.metadata.name, sourceBaseName).kind === 'transcript',
  )
  let transcriptWinnerId: string | null = null
  let transcriptConflict = false
  if (transcriptCandidates.length === 1) {
    transcriptWinnerId = transcriptCandidates[0].id
  } else if (transcriptCandidates.length > 1) {
    const sel = await selectFullestStorageVariant(provider, transcriptCandidates, `${sourceBaseName}.md`)
    transcriptConflict = sel.conflict
    transcriptWinnerId = sel.best?.ref.id ?? null
    if (transcriptConflict) {
      FileLogger.warn('shadow-twins/reconstruct', 'Transkript-Konflikt: nicht eindeutig – Transkript uebersprungen', {
        sourceId, candidates: transcriptCandidates.map((c) => c.metadata.name),
      })
    }
  }

  // Quell-Item einmalig laden: wird vom kanonischen Writer (persistShadowTwinToMongo)
  // benoetigt. Faellt das fehl, nutzen wir den schlanken Fallback (nur Markdown).
  let sourceItem: StorageItem | null = null
  try {
    sourceItem = await provider.getItemById(sourceId)
  } catch (err) {
    FileLogger.warn('shadow-twins/reconstruct', 'Quell-Item konnte nicht geladen werden – Fallback (nur Markdown)', {
      sourceId, error: err instanceof Error ? err.message : String(err),
    })
  }

  for (const mdFile of mdFiles) {
    const fileName = mdFile.metadata.name

    // WICHTIG: Nur echte Artefakte DIESER Quelle behandeln. Gueltige Artefakt-Namen
    // entstehen via buildArtifactName und beginnen daher IMMER mit "<sourceBaseName>.".
    // Sub-Seiten-Texte wie "page_001.en.md" gehoeren NICHT dazu und wuerden von
    // parseArtifactName faelschlich als Transcript klassifiziert (und das echte
    // Transkript ueberschreiben). Diese ueberspringen wir still.
    if (!fileName.startsWith(`${sourceBaseName}.`)) {
      FileLogger.debug('shadow-twins/reconstruct', 'Kein Artefakt dieser Quelle – uebersprungen', {
        fileName, sourceBaseName, sourceId,
      })
      continue
    }

    const parsed = parseArtifactName(fileName, sourceBaseName)

    // Nur die vollstaendigste Transkript-Variante uebernehmen (siehe Pre-Pass oben);
    // bei Konflikt gar keine. Andere Transkript-Varianten still ueberspringen.
    if (parsed.kind === 'transcript' && (transcriptConflict || mdFile.id !== transcriptWinnerId)) {
      FileLogger.debug('shadow-twins/reconstruct', 'Transkript-Variante nicht vollstaendigster Gewinner – uebersprungen', {
        fileName, sourceId, winnerId: transcriptWinnerId, conflict: transcriptConflict,
      })
      continue
    }

    if (!parsed.kind || !parsed.targetLanguage) {
      FileLogger.warn('shadow-twins/reconstruct', 'Artefakt-Datei konnte nicht zugeordnet werden', {
        fileName, parsed, sourceId,
      })
      results.push({
        fileName,
        kind: parsed.kind || 'unknown',
        targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName,
        success: false,
        error: 'Dateiname konnte nicht als Artefakt erkannt werden',
      })
      continue
    }

    try {
      const { blob } = await provider.getBinary(mdFile.id)
      const markdown = await blob.text()

      if (!markdown.trim()) {
        results.push({
          fileName, kind: parsed.kind, targetLanguage: parsed.targetLanguage,
          templateName: parsed.templateName, success: false, error: 'Leere Datei',
        })
        continue
      }

      const artifactKey: ArtifactKey = {
        sourceId,
        kind: parsed.kind,
        targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName || undefined,
      }

      if (sourceItem) {
        // Kanonischer Pfad (identisch zur Transkription): Bilder im Markdown werden
        // nach Azure geladen, als binaryFragments registriert und das Markdown
        // wird mit absoluten Azure-URLs eingefroren. Strategie-Wahl (azure-only /
        // azure-with-fs-backup / filesystem-only) trifft persistOcrImages intern.
        await persistShadowTwinToMongo({
          libraryId, userEmail, sourceItem, provider, artifactKey, markdown, shadowTwinFolderId,
        })
      } else {
        // Fallback ohne Quell-Item: nur Markdown nachfuehren (keine Bild-Pipeline).
        await upsertShadowTwinArtifact({
          libraryId, userEmail, sourceId, sourceName, parentId, artifactKey, markdown,
        })
      }

      FileLogger.info('shadow-twins/reconstruct', `Artefakt rekonstruiert: ${fileName}`, {
        sourceId, kind: parsed.kind, lang: parsed.targetLanguage, template: parsed.templateName,
      })

      results.push({
        fileName, kind: parsed.kind, targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName, success: true,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      FileLogger.error('shadow-twins/reconstruct', `Fehler beim Rekonstruieren: ${fileName}`, {
        sourceId, error: errorMsg,
      })
      results.push({
        fileName, kind: parsed.kind, targetLanguage: parsed.targetLanguage,
        templateName: parsed.templateName, success: false, error: errorMsg,
      })
    }
  }

  // Variante 2: Seiten-Renderings (page_*) + Previews (preview_*), die NICHT im
  // Markdown referenziert sind, ebenfalls nach Azure spiegeln — exakt wie der
  // ZIP-Direktupload einer frischen Transkription (variant='page-render'/'preview').
  // Nur sinnvoll, wenn mind. ein Artefakt rekonstruiert wurde und das Quell-Item da ist.
  if (sourceItem && results.some((r) => r.success)) {
    try {
      await reconstructPageImages({ provider, libraryId, userEmail, sourceItem, parentId, items })
    } catch (err) {
      // Nicht kritisch: Markdown + referenzierte Bilder sind bereits persistiert.
      FileLogger.warn('shadow-twins/reconstruct', 'Spiegeln der Seiten-Renderings fehlgeschlagen', {
        sourceId, error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return results
}

/**
 * Spiegelt nicht im Markdown referenzierte Seiten-Renderings/Previews
 * (page_*, preview_*) aus dem Shadow-Twin-Ordner nach Azure und registriert sie
 * als binaryFragments. Nur im Mongo-Modus (Azure ist dort die Lese-Quelle); im
 * reinen Filesystem-Modus liegen die Bilder bereits am primaeren Ort.
 */
export async function reconstructPageImages(args: {
  provider: StorageProvider
  libraryId: string
  userEmail: string
  sourceItem: StorageItem
  parentId: string
  items: StorageItem[]
}): Promise<number> {
  const { provider, libraryId, userEmail, sourceItem, parentId, items } = args

  const library = await LibraryService.getInstance().getLibrary(userEmail, libraryId)
  if (!library) return 0

  // Gate: Nur Mongo-Primaer spiegelt nach Azure. Filesystem-Primaer braucht das nicht.
  if (getShadowTwinConfig(library).primaryStore !== 'mongo') return 0

  const imageFiles = items.filter((it) => it.type === 'file' && isReconstructablePageImage(it.metadata.name))
  if (imageFiles.length === 0) return 0

  const service = new ShadowTwinService({
    library,
    userEmail,
    sourceId: sourceItem.id,
    sourceName: sourceItem.metadata.name,
    parentId,
    provider,
  })

  let mirrored = 0
  for (const img of imageFiles) {
    const name = img.metadata.name
    const isPageRender = PAGE_RENDER_RE.test(name)
    try {
      const { blob } = await provider.getBinary(img.id)
      const buffer = Buffer.from(await blob.arrayBuffer())
      await service.uploadBinaryFragment({
        buffer,
        fileName: name,
        mimeType: imageMimeFromName(name),
        kind: 'image',
        variant: isPageRender ? 'page-render' : 'preview',
        pageNumber: parsePageNumber(name),
      })
      mirrored++
    } catch (err) {
      // Einzel-Bild-Fehler darf den Gesamtlauf nicht abbrechen.
      FileLogger.warn('shadow-twins/reconstruct', 'Bild-Spiegelung fehlgeschlagen', {
        sourceId: sourceItem.id, fileName: name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (mirrored > 0) {
    FileLogger.info('shadow-twins/reconstruct', `Seiten-Renderings/Previews gespiegelt: ${mirrored}`, {
      sourceId: sourceItem.id,
    })
  }
  return mirrored
}
