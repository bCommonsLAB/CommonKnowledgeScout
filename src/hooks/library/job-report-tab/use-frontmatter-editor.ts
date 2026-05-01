'use client'

/**
 * src/hooks/library/job-report-tab/use-frontmatter-editor.ts
 *
 * Hook fuer die Inline-Editing-Logik im Metadaten-Tab des
 * `job-report-tab.tsx`.
 *
 * Aus `job-report-tab.tsx` ausgegliedert (Welle 3-II-Hooks-b, Schritt 2/4).
 * Welle initial als "Welle 3-III-b" gestartet, am 2026-05-01 zu
 * "Welle 3-II-Hooks-b" umbenannt — siehe
 * .cursor/rules/refactor-naming-konvention.mdc
 *
 * Verantwortlichkeiten:
 * - State fuer das aktuell bearbeitete Feld (editingField, editingValue)
 * - Save-Logik (saveMetaField): Frontmatter-Patch + Persistierung
 *   (MongoDB ODER Filesystem)
 * - State fuer Speicher-Loading (isSaving)
 *
 * 1:1-portierte Logik aus Bestand — keine Verhaltensaenderung.
 */

import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'
import { isMongoShadowTwinId, parseMongoShadowTwinId } from '@/lib/shadow-twin/mongo-shadow-twin-id'
import { updateShadowTwinMarkdown } from '@/lib/shadow-twin/shadow-twin-mongo-client'
import type { StorageProvider } from '@/lib/storage/types'

export interface UseFrontmatterEditorArgs {
  libraryId: string
  /** Effektive Markdown-Datei-ID (Mongo-Shadow-Twin-ID oder Storage-fileId) */
  effectiveMdId: string | null
  /** Aktueller Markdown-Inhalt (komplett, mit Frontmatter) */
  fullContent: string
  /** Storage-Provider fuer Filesystem-Persistierung */
  provider: StorageProvider | null | undefined
  /** Pure-Helper, der Frontmatter aus Markdown entfernt (Body extrahiert) */
  stripFrontmatter: (content: string) => string
  /**
   * Callback nach erfolgreichem Save. Komponente aktualisiert ihre
   * State-Variablen (fullContent, debouncedContent, frontmatterMeta,
   * parseErrors).
   */
  onContentUpdated: (
    newContent: string,
    meta: Record<string, unknown>,
    parseErrors: string[],
  ) => void
}

export interface UseFrontmatterEditorResult {
  /** Aktuell bearbeitetes Feld (null = nicht im Edit-Modus) */
  editingField: string | null
  /** Setter fuer editingField (Komponente startet/abbricht den Edit-Modus) */
  setEditingField: (v: string | null) => void
  /** Aktuell bearbeiteter Wert (Textfeld-Inhalt) */
  editingValue: string
  /** Setter fuer editingValue (onChange-Handler) */
  setEditingValue: (v: string) => void
  /** Speicher-Loading (deaktiviert Buttons) */
  isSaving: boolean
  /**
   * Setter fuer isSaving — fuer parallele Save-Pfade (z.B. Markdown-
   * Edit-Mode), die ebenfalls den Save-Status anzeigen wollen.
   * Hinweis: Inline-Editing-Pfad setzt isSaving selbst (intern).
   */
  setIsSaving: (v: boolean) => void
  /**
   * Save-Handler. Persistiert das Feld nach MongoDB oder Filesystem
   * (je nach effectiveMdId-Format) und ruft `onContentUpdated` zurueck.
   * Setzt `editingField`/`editingValue` immer zurueck (auch bei Fehler).
   */
  saveMetaField: (fieldName: string, newValue: string) => Promise<void>
}

export function useFrontmatterEditor(
  args: UseFrontmatterEditorArgs,
): UseFrontmatterEditorResult {
  const { libraryId, effectiveMdId, fullContent, provider, stripFrontmatter, onContentUpdated } = args

  const [editingField, setEditingField] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState<string>('')
  const [isSaving, setIsSaving] = useState(false)

  const saveMetaField = useCallback(
    async (fieldName: string, newValue: string) => {
      if (!effectiveMdId || !fullContent) return

      setIsSaving(true)
      try {
        // Parse aktuelles Frontmatter
        const parsed = parseSecretaryMarkdownStrict(fullContent)
        const currentMeta = parsed.meta || {}

        // Aktualisiere das Feld
        // Versuche JSON zu parsen (fuer Arrays/Objekte)
        let parsedValue: unknown = newValue
        if (newValue.startsWith('[') || newValue.startsWith('{')) {
          try {
            parsedValue = JSON.parse(newValue)
          } catch {
            // Kein valides JSON, verwende als String
          }
        }
        currentMeta[fieldName] = parsedValue

        // Rekonstruiere Frontmatter
        const frontmatterLines = Object.entries(currentMeta).map(([k, v]) => {
          if (v === null || v === undefined) return `${k}: null`
          if (Array.isArray(v)) return `${k}: ${JSON.stringify(v)}`
          if (typeof v === 'object') return `${k}: ${JSON.stringify(v)}`
          if (typeof v === 'string' && (v.includes('\n') || v.includes(':') || v.includes('"'))) {
            // Multiline oder Sonderzeichen: YAML Block-Style oder Escaping
            if (v.includes('\n')) {
              return `${k}: |\n  ${v.split('\n').join('\n  ')}`
            }
            return `${k}: "${v.replace(/"/g, '\\"')}"`
          }
          return `${k}: ${v}`
        })
        const body = stripFrontmatter(fullContent)
        const newFullContent = `---\n${frontmatterLines.join('\n')}\n---\n\n${body}`

        // Speichern
        if (isMongoShadowTwinId(effectiveMdId)) {
          const parts = parseMongoShadowTwinId(effectiveMdId)
          if (!parts) throw new Error('Ungueltige Mongo-ID')
          await updateShadowTwinMarkdown(libraryId, parts, newFullContent)
        } else if (provider) {
          const item = await provider.getItemById(effectiveMdId)
          if (!item || !item.parentId) throw new Error('Datei nicht gefunden')
          const blob = new Blob([newFullContent], { type: 'text/markdown' })
          const file = new File([blob], item.metadata.name, { type: 'text/markdown' })
          await provider.deleteItem(item.id)
          await provider.uploadFile(item.parentId, file)
        }

        // Aktualisiere States ueber Callback
        const newParsed = parseSecretaryMarkdownStrict(newFullContent)
        onContentUpdated(newFullContent, newParsed.meta, newParsed.errors || [])

        toast.success(`"${fieldName}" gespeichert`)
      } catch (e) {
        toast.error(`Fehler: ${e instanceof Error ? e.message : 'Unbekannt'}`)
      } finally {
        setIsSaving(false)
        setEditingField(null)
        setEditingValue('')
      }
    },
    [effectiveMdId, fullContent, libraryId, provider, stripFrontmatter, onContentUpdated],
  )

  return {
    editingField,
    setEditingField,
    editingValue,
    setEditingValue,
    isSaving,
    setIsSaving,
    saveMetaField,
  }
}
