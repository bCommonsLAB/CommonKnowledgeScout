/**
 * @fileoverview Provider/Filesystem Shadow-Twin Store Implementation
 *
 * @description
 * Implementiert ShadowTwinStore für Filesystem/OneDrive/Drive über StorageProvider.
 * Nutzt resolveArtifact() für die Artefakt-Auflösung — MEMOISIERT je
 * Store-Instanz (= je Request, Testsession 25.08.2026 §2.2): dieselbe
 * Auflösung lief vorher bis zu dreimal pro Verifizieren (Drift-Guard,
 * existsArtifact, upsertArtifact) mit je 2 Storage-Listings. Nach jedem
 * Write wird der Memo geleert (der Storage hat sich geändert — kein
 * stiller veralteter Treffer).
 *
 * @module shadow-twin/store
 */

import type { ShadowTwinStore, ArtifactMarkdownResult, UpsertArtifactResult, UpsertArtifactContext, BinaryFragment } from './shadow-twin-store'
import type { ArtifactKey } from '@/lib/shadow-twin/artifact-types'
import type { StorageProvider } from '@/lib/storage/types'
import { resolveArtifact, type ResolvedArtifact } from '@/lib/shadow-twin/artifact-resolver'
import { buildArtifactName } from '@/lib/shadow-twin/artifact-naming'

/**
 * Provider/Filesystem Shadow-Twin Store Implementation.
 */
export class ProviderShadowTwinStore implements ShadowTwinStore {
  /** Auflösungs-Memo je Request (Key: Zielort + Artefakt-Identität). */
  private readonly resolved = new Map<string, Promise<ResolvedArtifact | null>>()

  constructor(
    private readonly provider: StorageProvider,
    private readonly sourceName: string,
    private readonly parentId: string
  ) {}

  /** resolveArtifact mit Request-Memo — identische Anfragen laufen nur einmal. */
  private resolveCached(key: ArtifactKey, sourceName: string, parentId: string): Promise<ResolvedArtifact | null> {
    const memoKey = `${parentId}|${sourceName}|${key.kind}|${key.templateName ?? ''}|${key.targetLanguage}`
    const cached = this.resolved.get(memoKey)
    if (cached) return cached
    const pending = resolveArtifact(this.provider, {
      sourceItemId: key.sourceId,
      sourceName,
      parentId,
      targetLanguage: key.targetLanguage,
      templateName: key.templateName,
      preferredKind: key.kind,
    })
    this.resolved.set(memoKey, pending)
    // Fehlgeschlagene Auflösungen nicht memoisieren — der nächste Aufruf darf es erneut versuchen.
    pending.catch(() => this.resolved.delete(memoKey))
    return pending
  }

  async existsArtifact(key: ArtifactKey): Promise<boolean> {
    const resolved = await this.resolveCached(key, this.sourceName, this.parentId)
    return resolved !== null
  }

  async getArtifactMarkdown(key: ArtifactKey): Promise<ArtifactMarkdownResult | null> {
    const resolved = await this.resolveCached(key, this.sourceName, this.parentId)

    if (!resolved) return null

    try {
      const binary = await this.provider.getBinary(resolved.fileId)
      const markdown = await binary.blob.text()

      // Optional: Frontmatter parsen
      let frontmatter: Record<string, unknown> | undefined
      try {
        const { parseFrontmatter } = await import('@/lib/markdown/frontmatter')
        const parsed = parseFrontmatter(markdown)
        if (parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)) {
          frontmatter = parsed.meta as Record<string, unknown>
        }
      } catch {
        // Frontmatter-Parsing optional
      }

      return {
        id: resolved.fileId,
        name: resolved.fileName,
        markdown,
        frontmatter,
      }
    } catch {
      // Fehler beim Laden → null zurückgeben
      return null
    }
  }

  async upsertArtifact(
    key: ArtifactKey,
    markdown: string,
    binaryFragments?: BinaryFragment[],
    context?: UpsertArtifactContext
  ): Promise<UpsertArtifactResult> {
    // Defense in depth: Provider-Store schreibt in Dateien – leere Dateien sollen nicht entstehen.
    if (typeof markdown !== 'string' || markdown.trim().length === 0) {
      const template = key.templateName ? `, template=${key.templateName}` : ''
      throw new Error(
        `ShadowTwin(Provider): Leeres Markdown darf nicht gespeichert werden (kind=${key.kind}, lang=${key.targetLanguage}${template}, source=${this.sourceName})`
      )
    }

    // WICHTIG: Provider-basierte Stores schreiben direkt ins Filesystem/Drive.
    // Diese Implementierung ist primär für Lesen gedacht.
    // Für Schreiben sollte normalerweise der Mongo-Store verwendet werden,
    // es sei denn, persistToFilesystem=true ist gesetzt.

    const fileName = buildArtifactName(key, context?.sourceName || this.sourceName)
    const targetParentId = context?.parentId || this.parentId

    // Testsession §2.2: Hat der Aufrufer bereits aufgelöst (Drift-Guard der
    // Kuration), entfällt die erneute Suche komplett — `null` heißt dabei
    // ausdrücklich „aufgelöst, keine vorhanden" (Neuanlage ohne Listings).
    const known = context?.knownMirrorFile
    const resolved = known === undefined
      ? await this.resolveCached(key, context?.sourceName || this.sourceName, targetParentId)
      : null

    try {
      // Update: Inhalts-Update statt DELETE + PUT (Testsession §2.3 — zwischen
      // Löschen und Neu-Hochladen existierte die Spiegeldatei NICHT; ein
      // Absturz genau dort verlor sie). uploadFile überschreibt bei allen
      // Providern namensgleich im selben Ordner (OneDrive PUT :/content,
      // fs.writeFile, WebDAV overwrite) — die Datei ist zu keinem Zeitpunkt weg.
      // Geschrieben wird unter dem VORHANDENEN Namen an ihrem Fundort;
      // Alt-Namen überführt weiterhin die Namens-Migration der Engine.
      if (known) {
        const updated = await this.provider.uploadFile(
          targetParentId,
          new File([markdown], known.fileName, { type: 'text/markdown' })
        )
        return { id: updated.id, name: known.fileName }
      }
      if (resolved) {
        const overwriteParentId =
          resolved.location === 'dotFolder' && resolved.shadowTwinFolderId
            ? resolved.shadowTwinFolderId
            : targetParentId
        const updated = await this.provider.uploadFile(
          overwriteParentId,
          new File([markdown], resolved.fileName, { type: 'text/markdown' })
        )
        return { id: updated.id, name: resolved.fileName }
      }

      // Create: Neue Datei erstellen mit uploadFile
      const item = await this.provider.uploadFile(
        targetParentId,
        new File([markdown], fileName, { type: 'text/markdown' })
      )
      return { id: item.id, name: fileName }
    } finally {
      // Nach jedem Write ist der Storage-Zustand neu — Memo leeren, damit
      // spätere Auflösungen im selben Request nichts Veraltetes sehen.
      this.resolved.clear()
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async getBinaryFragments(_sourceId: string): Promise<BinaryFragment[] | null> {
    // Provider-Stores haben keine zentrale Binary-Fragment-Verwaltung.
    // Binary-Fragmente sind normalerweise als separate Dateien im Shadow-Twin-Verzeichnis gespeichert.
    // Diese Implementierung gibt null zurück, da wir keine strukturierte Fragment-Liste haben.
    return null
  }
}
