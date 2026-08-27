/**
 * @ks/contracts/llm-model.ts
 *
 * Core-API-DTO fuer `GET /api/llm-models` und `GET /api/public/llm-models`
 * (Welle M2). Bildet die Antwort dieser Routen 1:1 ab — das serverseitige
 * `LlmModel`-Interface (`src/lib/db/llm-models-repo.ts`) bleibt die Quelle
 * der Wahrheit fuer die MongoDB-Collection, verwendet aber `TargetLanguage`
 * aus `@/lib/chat/constants` fuer `supportedLanguages`. Dieser Import waere
 * aus einer Shared Library die falsche Richtung (Modul-Landkarte §4), daher
 * bildet der DTO `supportedLanguages` bewusst als `string[]` ab.
 */
export interface LlmModelDto {
  /** Mongo-`_id` = vollstaendige Modell-ID (z.B. 'google/gemini-2.5-flash') */
  _id: string
  /** Anzeigename (z.B. 'Gemini 2.5 Flash') */
  name: string
  /** Provider (z.B. 'google', 'openai', 'anthropic') */
  provider: string
  /** Vollstaendige Modell-ID fuer die API (identisch zu `_id`) */
  modelId: string
  /** Unterstuetzte Zielsprachen (Locale-Codes) */
  supportedLanguages: string[]
  /** Beschreibung der Staerken */
  strengths: string
  /** Optionale URL zur Modell-Detailseite */
  url?: string
  isActive: boolean
  order: number
  createdAt: string
  updatedAt: string
}
