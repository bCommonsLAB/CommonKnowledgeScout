"use client"

/**
 * LlmModelSection — Standard-LLM-Modell fuer Chat-Antworten.
 *
 * Extrahiert aus model-config-section.tsx (Welle 3-IV-UX-3a, F8):
 * Die Modellwahl ist Experten-Territorium und liegt im Bereich
 * "Erweitert"; ohne Auswahl gilt der System-Standard.
 */

import { FormField, FormItem, FormMessage } from "@/components/ui/form"
import { LlmModelSelector } from "@/components/ui/llm-model-selector"
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

interface LlmModelSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
}

export function LlmModelSection({ form }: LlmModelSectionProps) {
  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">LLM-Modell (Chat)</h3>
        <p className="text-sm text-muted-foreground">
          Standard-Modell für Chat-Antworten dieser Bibliothek. Leer lassen,
          um den System-Standard zu verwenden.
        </p>
      </div>

      <FormField
        control={form.control}
        name="chatLlmModel"
        render={({ field }) => (
          <FormItem>
            <LlmModelSelector
              value={field.value || ''}
              onChange={(v) => field.onChange(v)}
              label="LLM-Modell"
              placeholder="(kein Default)"
              description="Standard-LLM-Modell für Chat-Antworten."
              variant="form"
            />
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
