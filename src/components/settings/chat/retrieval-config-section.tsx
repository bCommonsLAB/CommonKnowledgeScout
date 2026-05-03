"use client"

/**
 * RetrievalConfigSection — RAG-Konfiguration (Embeddings + Chunking).
 *
 * Extrahiert aus chat-form.tsx (Welle 3-IV-Settings-Sections-Split).
 * Enthält die Section "RAG Konfiguration" mit Embedding-Modell,
 * Dimensions, ChunkSize und ChunkOverlap.
 */

import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { UseFormReturn } from "react-hook-form"
import type { chatFormSchema } from "./hooks/use-chat-form"
import type { z } from "zod"

/** Standard-Embedding-Konfigurationswerte aus der Library oder System-Default */
interface DefaultEmbeddings {
  dimensions: number
  embeddingModel?: string
}

interface RetrievalConfigSectionProps {
  /** React-Hook-Form Instanz aus useChatForm() */
  form: UseFormReturn<z.infer<typeof chatFormSchema>>
  /** Standard-Embedding-Konfiguration für Placeholder-Werte */
  defaultEmbeddings: DefaultEmbeddings
}

/**
 * Section-Komponente für RAG-Konfiguration im Chat-Formular.
 * Rendert Embedding-Modell, Dimension, Chunk-Größe und Chunk-Overlap.
 */
export function RetrievalConfigSection({ form, defaultEmbeddings }: RetrievalConfigSectionProps) {
  return (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h3 className="text-lg font-semibold">RAG Konfiguration</h3>
        <p className="text-sm text-muted-foreground">
          Einstellungen für die Vektorsuche und Dokumenten-Chunking.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField
          control={form.control}
          name="embeddings.embeddingModel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Embedding Modell</FormLabel>
              <FormControl>
                <Input placeholder="voyage-3-large" {...field} value={field.value || ""} />
              </FormControl>
              <FormDescription>
                Embedding-Modell (z.B. voyage-3-large, text-embedding-3-large)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embeddings.dimensions"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Dimension</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder={String(defaultEmbeddings.dimensions)}
                  {...field}
                  value={field.value || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    field.onChange(val ? parseInt(val, 10) : undefined)
                  }}
                />
              </FormControl>
              <FormDescription>
                Embedding-Dimension ({defaultEmbeddings.dimensions} für voyage-3-large, 3072 für text-embedding-3-large)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embeddings.chunkSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chunk Größe</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="1000"
                  {...field}
                  value={field.value || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    field.onChange(val ? parseInt(val, 10) : undefined)
                  }}
                />
              </FormControl>
              <FormDescription>
                Chunk-Größe in Zeichen (Standard: 1000)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="embeddings.chunkOverlap"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Chunk Overlap</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="200"
                  {...field}
                  value={field.value || ""}
                  onChange={(e) => {
                    const val = e.target.value
                    field.onChange(val ? parseInt(val, 10) : undefined)
                  }}
                />
              </FormControl>
              <FormDescription>
                Chunk-Overlap in Zeichen (Standard: 200)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
