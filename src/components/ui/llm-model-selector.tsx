"use client"

import * as React from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Label } from "@/components/ui/label"

/**
 * LLM-Modell für Dropdown-Auswahl
 */
export interface LlmModelOption {
  /** Modell-ID (z.B. 'google/gemini-2.5-flash') */
  modelId: string
  /** Anzeigename (z.B. 'Gemini 2.5 Flash') */
  name: string
  /** Beschreibung der Stärken */
  strengths?: string
}

interface LlmModelSelectorProps {
  /** Aktuell ausgewähltes Modell (modelId) */
  value?: string
  /** Callback bei Änderung */
  onChange?: (value: string) => void
  /** Verfügbare Modelle (wenn nicht gesetzt, werden sie automatisch geladen) */
  models?: LlmModelOption[]
  /** Ladezustand */
  isLoading?: boolean
  /** Placeholder-Text wenn kein Modell ausgewählt */
  placeholder?: string
  /** Label für das Feld (optional) */
  label?: string
  /** Label-Breite für Alignment (z.B. 'w-12') */
  labelClassName?: string
  /** Zusätzliche CSS-Klassen für den Trigger */
  triggerClassName?: string
  /** Beschreibungstext unter dem Select */
  description?: string
  /** ID für das Select-Element */
  id?: string
  /** Deaktiviert das Select */
  disabled?: boolean
  /** Variante: 'compact' für Pipeline-Sheet, 'form' für Settings-Formulare */
  variant?: 'compact' | 'form'
}

/**
 * Wiederverwendbare Komponente für LLM-Modell-Auswahl.
 * Lädt Modelle automatisch von /api/public/llm-models, wenn keine übergeben werden.
 */
export function LlmModelSelector({
  value,
  onChange,
  models: externalModels,
  isLoading: externalLoading,
  placeholder = "Standard",
  label,
  labelClassName = "w-12",
  triggerClassName,
  description,
  id = "llm-model",
  disabled = false,
  variant = 'compact',
}: LlmModelSelectorProps) {
  // Interne States für automatisches Laden
  const [internalModels, setInternalModels] = React.useState<LlmModelOption[]>([])
  const [internalLoading, setInternalLoading] = React.useState(false)

  // Verwende externe Modelle wenn vorhanden, sonst interne
  const models = externalModels ?? internalModels
  const isLoading = externalLoading ?? internalLoading

  // Automatisches Laden der Modelle, wenn keine externen übergeben wurden
  React.useEffect(() => {
    // Nur laden, wenn keine externen Modelle übergeben wurden
    if (externalModels !== undefined) return

    let cancelled = false
    async function loadModels() {
      setInternalLoading(true)
      try {
        const response = await fetch('/api/public/llm-models')
        if (!response.ok) {
          console.warn('[LlmModelSelector] Fehler beim Laden der LLM-Modelle:', response.status)
          return
        }
        const data = await response.json()
        if (!cancelled && Array.isArray(data)) {
          setInternalModels(data.map((m: { modelId?: string; name?: string; strengths?: string }) => ({
            modelId: m.modelId || '',
            name: m.name || m.modelId || '',
            strengths: m.strengths || undefined,
          })))
        }
      } catch (error) {
        console.error('[LlmModelSelector] Fehler beim Laden der LLM-Modelle:', error)
      } finally {
        if (!cancelled) setInternalLoading(false)
      }
    }
    void loadModels()
    return () => { cancelled = true }
  }, [externalModels])

  // Wenn keine Modelle verfügbar, nichts rendern
  if (!isLoading && models.length === 0) {
    return null
  }

  // Kompakte Variante für Pipeline-Sheet (mit Label inline)
  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2">
        {label && (
          <Label htmlFor={id} className={`text-xs text-muted-foreground whitespace-nowrap ${labelClassName}`}>
            {label}
          </Label>
        )}
        {isLoading ? (
          <Skeleton className="h-8 flex-1" />
        ) : (
          <Select 
            value={value || ""} 
            onValueChange={(v) => onChange?.(v)}
            disabled={disabled}
          >
            <SelectTrigger 
              id={id} 
              className={`h-8 text-xs text-left justify-start ${triggerClassName || 'flex-1'}`}
            >
              <SelectValue placeholder={placeholder} />
            </SelectTrigger>
            <SelectContent>
              {models.map((model) => (
                <SelectItem key={model.modelId} value={model.modelId} className="text-xs">
                  <div className="flex flex-col">
                    <span>{model.name}</span>
                    {model.strengths && (
                      <span className="text-[10px] text-muted-foreground">
                        {model.strengths}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    )
  }

  // Spezieller Wert für "kein Default" (Radix UI erlaubt keine leeren Strings)
  const NONE_VALUE = "__none__"
  // Konvertiere den externen Wert für das Select
  const selectValue = value ? value : NONE_VALUE

  // Form-Variante für Settings-Formulare (volle Breite, mit Beschreibung)
  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
      )}
      {isLoading ? (
        <Skeleton className="h-9 w-full" />
      ) : (
        <Select 
          value={selectValue} 
          onValueChange={(v) => onChange?.(v === NONE_VALUE ? "" : v)}
          disabled={disabled}
        >
          <SelectTrigger 
            id={id} 
            className={`h-9 w-full text-left justify-start ${triggerClassName || ''}`}
          >
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {/* Option für "kein Default" / Standard-Verhalten */}
            <SelectItem value={NONE_VALUE} className="text-sm">
              <span className="text-muted-foreground">(kein Default)</span>
            </SelectItem>
            {models.map((model) => (
              <SelectItem key={model.modelId} value={model.modelId} className="text-sm">
                <div className="flex flex-col">
                  <span>{model.name}</span>
                  {model.strengths && (
                    <span className="text-xs text-muted-foreground">
                      {model.strengths}
                    </span>
                  )}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {description && (
        <p className="text-sm text-muted-foreground">
          {description}
        </p>
      )}
    </div>
  )
}
