"use client"

/**
 * Erweitert · Agentensicht — ein Formular, ein Config-Objekt (`agentView`),
 * ein Speichern-Knopf. Die beiden Section-Komponenten bleiben und bekommen
 * dieses Formular (Plan speicher-verbindungen-und-library-anlage, Teil B).
 */

import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Form } from '@ks/ui'
import { AgentViewConfigSection } from "../agent-view-config-section"
import { AgentViewBerichtSection } from "../agent-view-bericht-section"
import {
  agentViewFormSchema,
  readAgentViewForm,
  toAgentViewConfig,
  type AgentViewFormValues,
} from "./agent-view-form-model"
import { useLibraryConfigPatch } from "./use-library-config-patch"
import { NoLibrarySelected, SaveRow } from "./advanced-form-shell"

export function AgentViewForm() {
  const { activeLibrary, isLoading, patchConfig } = useLibraryConfigPatch()
  const form = useForm<AgentViewFormValues>({
    resolver: zodResolver(agentViewFormSchema),
    defaultValues: readAgentViewForm(undefined),
  })

  // Formular aus der aktiven Library befuellen (auch nach dem Speichern: der
  // Library-Zustand aendert sich, das Formular folgt und ist wieder „sauber").
  useEffect(() => {
    if (activeLibrary) form.reset(readAgentViewForm(activeLibrary.config))
  }, [activeLibrary, form])

  const onSubmit = async (data: AgentViewFormValues) => {
    await patchConfig(toAgentViewConfig(data), "Agentensicht aktualisiert")
  }

  if (!activeLibrary) return <NoLibrarySelected />

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <AgentViewConfigSection form={form} />
        <AgentViewBerichtSection form={form} />
        <SaveRow isLoading={isLoading} isDirty={form.formState.isDirty} />
      </form>
    </Form>
  )
}
