/**
 * Formular-Modell der Transformations-Einstellungen (`config.secretaryService`),
 * reine Funktionen. Zwei Seiten teilen sich das Objekt — Archive · 3 Verarbeitung
 * (redaktionell) und Erweitert · Verarbeitung (Vorlage, Modell, Verbindung).
 * Beide laden ALLE Felder per `readSecretaryServiceForm` und schreiben das
 * Objekt per `buildSecretaryServiceConfig` VOLLSTAENDIG zurueck; so loescht das
 * Speichern der einen Seite nie die Felder der anderen (Plan Teil B, §4).
 */

import * as z from "zod"
import type { ClientLibrary } from "@/types/library"

export const secretaryServiceFormSchema = z.object({
  // Benutzerdefinierte Verbindung aktiv (false = ENV-Defaults)
  useCustomConfig: z.boolean().optional(),
  // Optional: Wenn gesetzt, muss es eine gültige URL sein
  apiUrl: z.string().url({ message: "Bitte geben Sie eine gültige URL ein." }).optional(),
  // Optional: Leer lassen → ENV verwenden
  apiKey: z.string().optional(),
  pdfExtractionMethod: z.enum([
    'native','ocr','both','preview','preview_and_native','llm','llm_and_ocr','mistral_ocr'
  ]).optional(),
  pdfTemplate: z.string().optional(),
  /** Standard-LLM-Modell für Template-Transformation */
  templateLlmModel: z.string().optional(),
  /** Standard-Zielsprache für Transformation */
  targetLanguage: z.enum(['de', 'en']).optional(),
  /** Automatisch Cover-Bild bei Transformation generieren */
  generateCoverImage: z.boolean().optional(),
  coverImagePrompt: z.string().optional(),
  /** Desktop-Modus: Ergebnisse aktiv abholen statt per Webhook */
  useDirectConnection: z.boolean().optional(),
})

export type SecretaryServiceFormValues = z.infer<typeof secretaryServiceFormSchema>

/** Liest ALLE secretaryService-Felder einer Library in die Formularwerte. */
export function readSecretaryServiceForm(config: ClientLibrary["config"] | undefined): SecretaryServiceFormValues {
  const s = config?.secretaryService
  // targetLanguage: aus secretaryService oder chat (Rückwärtskompatibilität)
  const targetLanguage = s?.targetLanguage || config?.chat?.targetLanguage || 'de'
  return {
    useCustomConfig: s?.useCustomConfig ?? false,
    apiUrl: s?.apiUrl || undefined,
    apiKey: s?.apiKey || '',
    pdfExtractionMethod: s?.pdfExtractionMethod || 'mistral_ocr',
    pdfTemplate: s?.template || '',
    templateLlmModel: s?.llmModel || '',
    targetLanguage: targetLanguage as 'de' | 'en',
    generateCoverImage: typeof s?.generateCoverImage === 'boolean' ? s.generateCoverImage : false,
    coverImagePrompt: s?.coverImagePrompt || '',
    useDirectConnection: s?.useDirectConnection ?? false,
  }
}

/**
 * Baut das vollstaendige secretaryService-Objekt aus den Formularwerten.
 * apiUrl/apiKey/useDirectConnection werden immer gespeichert (auch bei
 * useCustomConfig=false), damit beim Umschalten nichts verloren geht.
 */
export function buildSecretaryServiceConfig(data: SecretaryServiceFormValues) {
  return {
    useCustomConfig: data.useCustomConfig ?? false,
    ...(data.apiUrl ? { apiUrl: data.apiUrl } : {}),
    ...(data.apiKey ? { apiKey: data.apiKey } : {}),
    // Phase 1: Transkription
    pdfExtractionMethod: data.pdfExtractionMethod,
    // Phase 2: Transformation
    template: data.pdfTemplate?.trim() || undefined,
    llmModel: data.templateLlmModel?.trim() || undefined,
    targetLanguage: data.targetLanguage || 'de',
    generateCoverImage: data.generateCoverImage ?? false,
    ...(data.coverImagePrompt?.trim() ? { coverImagePrompt: data.coverImagePrompt.trim() } : {}),
    useDirectConnection: data.useDirectConnection ?? false,
  }
}
