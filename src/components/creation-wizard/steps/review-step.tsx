"use client"

import { useState, useEffect } from "react"
import { Pencil } from "lucide-react"
import type { TemplateMetadataSchema } from "@/lib/templates/template-types"
import type { WizardSource } from "@/lib/creation/corpus"
import { CompactSourcesInfo } from "@/components/creation-wizard/components/compact-sources-info"

interface ReviewStepProps {
  templateMetadata: TemplateMetadataSchema
  /** Roh-Metadaten aus dem Generator/URL-Extract */
  metadata: Record<string, unknown>
  /**
   * Wichtige Felder (werden immer angezeigt).
   * Falls leer, werden die ersten N Felder aus templateMetadata genutzt.
   */
  essentialFields?: string[]
  /**
   * Optionale Felder (werden hinter "Mehr anzeigen" versteckt).
   */
  optionalFields?: string[]
  onReview: (reviewed: Record<string, unknown>) => void
  reviewedFields?: Record<string, unknown>
  /** Verwendete Quellen (für dezenten Hinweis unten) */
  sources?: WizardSource[]
}

/**
 * ReviewStep: Einfache, benutzerfreundliche Ansicht zum Prüfen und Bearbeiten.
 * 
 * - Kompakte Darstellung ohne technische Begriffe
 * - Inline-Bearbeitung mit Stift-Icon
 * - Klare, einfache Sprache
 */
export function ReviewStep({
  templateMetadata,
  metadata,
  essentialFields,
  optionalFields,
  onReview,
  reviewedFields,
  sources = [],
}: ReviewStepProps) {
  const [editingField, setEditingField] = useState<string | null>(null)
  const [tempValue, setTempValue] = useState("")
  const [showOptional, setShowOptional] = useState(false)
  const [localFields, setLocalFields] = useState<Record<string, unknown>>(reviewedFields || metadata)

  const essential = essentialFields && essentialFields.length > 0
    ? essentialFields
    : templateMetadata.fields.slice(0, 8).map(f => f.key)

  const optional = optionalFields && optionalFields.length > 0
    ? optionalFields
    : templateMetadata.fields.map(f => f.key).filter(k => !essential.includes(k))

  // Synchronisiere lokalen State mit Props
  useEffect(() => {
    setLocalFields(reviewedFields || metadata)
  }, [reviewedFields, metadata])

  /**
   * Konvertiert Feldnamen zu benutzerfreundlichen Labels.
   */
  function getFieldLabel(fieldKey: string): string {
    const field = templateMetadata.fields.find(f => f.key === fieldKey || f.variable === fieldKey)
    if (field?.description) {
      // Nutze den ersten Teil der Beschreibung als Label, falls vorhanden
      return field.description.split('.')[0] || fieldKey
    }
    
    // Fallback: Konvertiere camelCase zu lesbarem Text
    const labelMap: Record<string, string> = {
      title: "Titel",
      shortTitle: "Kurztitel",
      summary: "Zusammenfassung",
      teaser: "Teaser",
      date: "Datum",
      starttime: "Startzeit",
      endtime: "Endzeit",
      location: "Ort",
      tags: "Tags",
      speakers: "Sprecher",
      affiliations: "Organisationen",
      topics: "Themen",
    }
    return labelMap[fieldKey] || fieldKey
  }

  function startEdit(fieldKey: string) {
    const value = localFields[fieldKey]
    if (Array.isArray(value)) {
      setTempValue((value as string[]).join(", "))
    } else {
      setTempValue(String(value || ""))
    }
    setEditingField(fieldKey)
  }

  function saveEdit() {
    if (!editingField) return
    
    const field = templateMetadata.fields.find(f => f.key === editingField || f.variable === editingField)
    const isArray = field && (field.rawValue?.includes("Array") || editingField === "tags" || editingField === "topics" || editingField === "affiliations")
    
    const newValue = isArray
      ? tempValue.split(",").map(t => t.trim()).filter(Boolean)
      : tempValue
    
    const updated = { ...localFields, [editingField]: newValue }
    setLocalFields(updated)
    onReview(updated)
    setEditingField(null)
  }

  function cancelEdit() {
    setEditingField(null)
    setTempValue("")
  }

  function renderField(fieldKey: string) {
    const value = localFields[fieldKey]
    const label = getFieldLabel(fieldKey)
    const isEditing = editingField === fieldKey
    const isArray = Array.isArray(value)
    const isLongText = typeof value === "string" && value.length > 120
    const displayValue = isArray ? (value as string[]).join(", ") : String(value || "")

    return (
      <div
        key={fieldKey}
        className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-700"
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-slate-500 dark:text-slate-400">{label}</label>
            {isEditing ? (
              <div className="mt-1">
                {isLongText || fieldKey === "summary" ? (
                  <textarea
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg dark:border-slate-500 dark:bg-slate-600 dark:text-white"
                    autoFocus
                  />
                ) : (
                  <input
                    type="text"
                    value={tempValue}
                    onChange={(e) => setTempValue(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-lg dark:border-slate-500 dark:bg-slate-600 dark:text-white"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        saveEdit()
                      }
                      if (e.key === "Escape") {
                        cancelEdit()
                      }
                    }}
                  />
                )}
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={saveEdit}
                    className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600"
                  >
                    Speichern
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-600 dark:text-white dark:hover:bg-slate-500"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-lg text-slate-900 dark:text-white">
                {displayValue || <span className="text-slate-400">(leer)</span>}
              </p>
            )}
          </div>
          {!isEditing && (
            <button
              onClick={() => startEdit(fieldKey)}
              className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-white"
              aria-label={`${label} bearbeiten`}
            >
              <Pencil className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">Prüfen & Speichern</h1>
      <p className="mt-2 text-lg text-slate-600 dark:text-slate-300">
        Schau dir die Infos an. Du kannst alles bearbeiten.
      </p>

      <div className="mt-8 space-y-4">
        {essential.map((fieldKey) => renderField(fieldKey))}
      </div>

      {optional.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowOptional((v) => !v)}
            className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            {showOptional ? "Weniger anzeigen" : "Mehr anzeigen"}
          </button>

          {showOptional && (
            <div className="mt-4 space-y-4">
              {optional.map((fieldKey) => renderField(fieldKey))}
            </div>
          )}
        </div>
      )}

      {/* Dezent: Verwendete Quellen unten */}
      {sources.length > 0 && (
        <div className="mt-8">
          <CompactSourcesInfo sources={sources} />
        </div>
      )}
    </div>
  )
}




