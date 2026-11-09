"use client"

/**
 * Benannte Regelsätze unter dem Antwortregeln-Feld (Owner 09.11.2026):
 * je Eintrag ein Name und ein Markdown-Text mit denselben Platzhaltern.
 * Eine Website-Sektion wählt per Marker `rules=<name>`, welcher Regelsatz
 * gilt; ohne Marker (Story-Modus, Galerie-Chat, Brücke) gelten die
 * Antwortregeln oben. Fehler stehen am Feld (Zod-Refinement im Formular).
 */

import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import type * as z from 'zod'
import { Plus, Trash2 } from 'lucide-react'
import { Button, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Textarea } from '@ks/ui'
import type { chatFormSchema } from './hooks/use-chat-form'

interface AntwortregelnVariantenProps {
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

export function AntwortregelnVarianten({ form }: AntwortregelnVariantenProps) {
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'antwortregelnVarianten' })

  return (
    <div className="space-y-3" data-antwortregeln-varianten>
      <div>
        <h4 className="text-sm font-medium">Benannte Regelsätze</h4>
        <p className="text-xs text-muted-foreground">
          Weitere Regeltexte unter einem Namen. Eine Website-Sektion wählt mit{' '}
          <code>{'<!-- section layout=story rules=<name> -->'}</code>, welcher gilt — zum Beispiel eine
          Einladung je Vortrag nur auf der Startseite. Story-Modus und Galerie-Chat nutzen weiter die Regeln oben.
        </p>
      </div>
      {fields.map((eintrag, i) => (
        <div key={eintrag.id} className="space-y-2 rounded-md border p-3" data-regelsatz>
          <div className="flex items-end gap-2">
            <FormField
              control={form.control}
              name={`antwortregelnVarianten.${i}.name`}
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ''} placeholder="einladung" className="font-mono text-xs" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="button" variant="ghost" size="icon" className="shrink-0" title="Regelsatz entfernen" aria-label="Regelsatz entfernen" onClick={() => remove(i)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
          <FormField
            control={form.control}
            name={`antwortregelnVarianten.${i}.text`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Regeln (Markdown)</FormLabel>
                <FormControl>
                  <Textarea {...field} value={field.value ?? ''} rows={6} className="font-mono text-xs" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => append({ name: '', text: '' })}>
        <Plus className="h-4 w-4" aria-hidden="true" />
        Regelsatz hinzufügen
      </Button>
    </div>
  )
}
