"use client"

/**
 * ContentTypeSection — Inhaltstyp-Assistent (Welle 3-IV-UX-3e, F6).
 *
 * Statt eines nackten Dropdowns: Typ-Karten mit Erklaerung, danach
 * typabhaengige Folgefragen (SDG-Profil nur fuer Klima-Inhalte,
 * DIVA-Hinweis fuer DIVA-Typen) und die Uebernahme der empfohlenen
 * Galerie-Filter fuer den gewaehlten Typ.
 *
 * testimonial/blog sind bewusst nicht waehlbar (E5 revidiert):
 * sie bleiben Dokument-Typen des Creation-Wizards.
 */

import Link from "next/link"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { FormControl, FormDescription, FormField, FormItem, FormLabel } from "@/components/ui/form"
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Switch } from "@/components/ui/switch"
import { ConfirmActionDialog } from "@/components/shared/confirm-action-dialog"
import { generateDefaultFacets } from "@/components/settings/FacetDefsEditor"
import { toast } from "sonner"
import { ChevronDown, ChevronRight, Info } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface ContentTypeSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

/** Kern-Inhaltstypen mit Anwender-Erklaerung (Petra-Pfad) */
export const CORE_CONTENT_TYPES = [
  {
    value: 'book' as const,
    title: 'Bücher & Dokumente',
    description: 'PDFs, Texte und Publikationen — der Standard für Dokumenten-Sammlungen.',
  },
  {
    value: 'session' as const,
    title: 'Event & Sessions',
    description: 'Vorträge und Gespräche einer Veranstaltung, mit Sprechern und Medien.',
  },
  {
    value: 'climateAction' as const,
    title: 'Klima-Maßnahmen',
    description: 'Maßnahmenkatalog mit Bewertungen, Zuständigkeiten und SDG-Bezug.',
  },
]

/** Branchenspezifische Typen — fuer die meisten Anwender irrelevant (Aufklapper) */
export const SPECIAL_CONTENT_TYPES = [
  {
    value: 'divaDocument' as const,
    title: 'DIVA-Dokumente',
    description: 'Dokumente aus dem DIVA-Liefersystem.',
  },
  {
    value: 'divaTexture' as const,
    title: 'DIVA-Texturen',
    description: 'Textur-Bibliothek mit Material-Attributen.',
  },
  {
    value: 'refurbedDevice' as const,
    title: 'Refurbished-Geräte',
    description: 'Geräte-Katalog mit technischen Daten.',
  },
]

const SPECIAL_VALUES: string[] = SPECIAL_CONTENT_TYPES.map(o => o.value)

export function ContentTypeSection({ form }: ContentTypeSectionProps) {
  const currentType = form.watch('gallery.detailViewType') || 'book'
  const defaultFacets = generateDefaultFacets(currentType)
  const currentFacets = form.watch('gallery.facets') || []
  // Branchen-Typen nur aufgeklappt zeigen, wenn die Library so einen nutzt
  const [showSpecialTypes, setShowSpecialTypes] = useState(SPECIAL_VALUES.includes(currentType))

  return (
    <div className="space-y-6">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Was enthält Ihre Bibliothek?</h3>
        <p className="text-sm text-muted-foreground">
          Der Inhaltstyp bestimmt das Layout der Detailansicht und die
          empfohlenen Filter der Galerie.
        </p>
      </div>

      {/* Schritt 1: Kern-Typen prominent */}
      <div className="grid gap-3 md:grid-cols-3">
        {CORE_CONTENT_TYPES.map(option => (
          <Card
            key={option.value}
            role="button"
            onClick={() => form.setValue('gallery.detailViewType', option.value, { shouldDirty: true })}
            className={`cursor-pointer transition-colors ${
              currentType === option.value
                ? 'border-primary ring-1 ring-primary'
                : 'hover:border-muted-foreground/40'
            }`}
          >
            <CardHeader className="p-4">
              <CardTitle className="text-sm">{option.title}</CardTitle>
              <CardDescription className="text-xs">{option.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Branchenspezifische Typen im Aufklapper (Petra-Review Punkt 8) */}
      <div>
        <button
          type="button"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          onClick={() => setShowSpecialTypes(v => !v)}
        >
          {showSpecialTypes ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Branchenspezifische Typen
        </button>
        {showSpecialTypes && (
          <div className="grid gap-3 md:grid-cols-3 mt-3">
            {SPECIAL_CONTENT_TYPES.map(option => (
              <Card
                key={option.value}
                role="button"
                onClick={() => form.setValue('gallery.detailViewType', option.value, { shouldDirty: true })}
                className={`cursor-pointer transition-colors ${
                  currentType === option.value
                    ? 'border-primary ring-1 ring-primary'
                    : 'hover:border-muted-foreground/40'
                }`}
              >
                <CardHeader className="p-4">
                  <CardTitle className="text-sm">{option.title}</CardTitle>
                  <CardDescription className="text-xs">{option.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Bestands-Hinweis fuer nicht mehr waehlbare Typen */}
      {(currentType === 'testimonial' || currentType === 'blog') && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Diese Bibliothek nutzt den Typ &quot;{currentType}&quot;, der nicht mehr als
            Bibliotheks-Typ angeboten wird. Wählen Sie eine Karte, um zu wechseln.
          </AlertDescription>
        </Alert>
      )}

      {/* Schritt 2: typabhaengige Folgefragen */}
      {currentType === 'climateAction' && (
        <FormField
          control={form.control}
          name="gallery.showSdgProfile"
          render={({ field }) => (
            <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel>SDG-Profil anzeigen</FormLabel>
                <FormDescription>
                  Zeigt das Nachhaltigkeits-Rad (UN-Ziele) in der Detailansicht
                  Ihrer Maßnahmen.
                </FormDescription>
              </div>
              <FormControl>
                <Switch checked={field.value === true} onCheckedChange={field.onChange} />
              </FormControl>
            </FormItem>
          )}
        />
      )}

      {(currentType === 'divaTexture' || currentType === 'divaDocument') && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Für DIVA-Inhalte gibt es zusätzliche Auswertungs-Optionen
            (Liefersystem-Daten, Archiv-Voreinstellungen) im Bereich{' '}
            <Link href="/settings/advanced" className="underline">Erweitert</Link>.
          </AlertDescription>
        </Alert>
      )}

      {/* Schritt 3: empfohlene Galerie-Filter uebernehmen */}
      {defaultFacets.length > 0 && (
        <div className="flex items-start justify-between gap-4 rounded-lg border p-4">
          <div>
            <p className="text-sm font-medium">Empfohlene Galerie-Filter</p>
            <p className="text-xs text-muted-foreground mt-1">
              Für diesen Inhaltstyp gibt es {defaultFacets.length} empfohlene
              Filter (aktuell konfiguriert: {currentFacets.length}). Feinjustierung
              jederzeit unter <Link href="/settings/explore" className="underline">Explore</Link>.
            </p>
          </div>
          <ConfirmActionDialog
            title={`${defaultFacets.length} empfohlene Filter übernehmen?`}
            description="Ihre aktuelle Filter-Konfiguration der Galerie wird dabei ersetzt. Speichern Sie anschließend, um die Änderung zu übernehmen."
            confirmLabel="Übernehmen"
            onConfirm={() => {
              form.setValue('gallery.facets', defaultFacets, { shouldDirty: true })
              toast.success(`${defaultFacets.length} empfohlene Filter gesetzt`, {
                description: 'Bitte speichern, um die Änderung zu übernehmen.',
              })
            }}
            trigger={
              <Button type="button" variant="outline" size="sm" className="shrink-0">
                Übernehmen
              </Button>
            }
          />
        </div>
      )}
    </div>
  )
}
