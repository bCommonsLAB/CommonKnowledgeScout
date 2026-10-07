"use client"

/**
 * AntwortregelnSection — Regeln dieser Library für die Antworten im Story-Modus
 * (Plan story-status-modalitaet, m2).
 *
 * Markdown-Text mit Platzhaltern auf das Facetten-Schema derselben Library:
 * {{facette:<metaKey>}} (Label) und {{legende:<metaKey>}} (Wert → Label →
 * Bedeutung aus dem Wörterbuch). Ungültige Platzhalter werden hier sofort
 * angezeigt und verhindern das Speichern (Zod superRefine im Formular).
 */

import type { UseFormReturn } from 'react-hook-form'
import type * as z from 'zod'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage, Textarea } from '@ks/ui'
import type { chatFormSchema } from './hooks/use-chat-form'
import { pruefeAntwortregeln, type RegelFacette } from '@/lib/chat/antwortregeln'

interface AntwortregelnSectionProps {
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

export function AntwortregelnSection({ form }: AntwortregelnSectionProps) {
  const facets = (form.watch('gallery.facets') || []) as RegelFacette[]
  const text = form.watch('antwortregeln') || ''
  const fehler = pruefeAntwortregeln(text, facets)
  const mitWoerterbuch = facets.filter((f) => f.metaKey && f.werte && f.werte.length > 0)

  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">Antwortregeln</h3>
        <p className="text-sm text-muted-foreground">
          Wie das Modell über die Inhalte dieser Library sprechen darf, zum Beispiel ein Status als
          Zuschreibung statt als Behauptung. Gilt für Antworten und Themenübersicht.
        </p>
      </div>

      <FormField
        control={form.control}
        name="antwortregeln"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Regeln (Markdown)</FormLabel>
            <FormControl>
              <Textarea
                {...field}
                value={field.value || ''}
                rows={10}
                className="font-mono text-xs"
                placeholder={'Beispiel:\n- Jede Aussage zum Stand einer Maßnahme ist eine Zuschreibung („laut Rückmeldung"), keine eigene Behauptung.\n- Treffen mehrere Dokumente zu, gliedere nach {{facette:lv_bewertung}}.\n\nBedeutung der Werte:\n{{legende:lv_bewertung}}'}
              />
            </FormControl>
            <FormDescription>
              Platzhalter: <code>{'{{facette:<metaKey>}}'}</code> setzt das Label der Facette ein,{' '}
              <code>{'{{legende:<metaKey>}}'}</code> die Tabelle Wert → Label → Bedeutung aus dem
              Bedeutungs-Wörterbuch (unter „Erweitert“, Facetten, Spalte „Werte“).
              {mitWoerterbuch.length > 0 ? (
                <> Facetten mit Wörterbuch: {mitWoerterbuch.map((f) => f.metaKey).join(', ')}.</>
              ) : (
                <> Noch keine Facette hat ein Wörterbuch, eine Legende ist deshalb noch nicht möglich.</>
              )}
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {fehler.length > 0 && (
        <ul className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive space-y-1">
          {fehler.map((f) => (
            <li key={f.platzhalter + f.grund}>
              <code>{f.platzhalter}</code>: {f.grund}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
