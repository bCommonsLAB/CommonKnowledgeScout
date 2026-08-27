/**
 * @ks/api-client/llm-models.ts
 *
 * Core-API-Client fuer `llm-models*` (Modul-Landkarte §3). `scope: 'public'`
 * (Default) ruft die anonym erreichbare Route auf, `scope: 'authenticated'`
 * die Clerk-geschuetzte Variante mit denselben Daten.
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { LlmModelDto } from '@ks/contracts'
import { apiGet, type ApiClientConfig } from './http'

export type LlmModelsScope = 'public' | 'authenticated'

function llmModelsPath(scope: LlmModelsScope): string {
  return scope === 'public' ? '/api/public/llm-models' : '/api/llm-models'
}

export function fetchLlmModels(
  scope: LlmModelsScope = 'public',
  config?: ApiClientConfig,
): Promise<LlmModelDto[]> {
  return apiGet<LlmModelDto[]>(llmModelsPath(scope), config)
}

export interface UseLlmModelsOptions extends ApiClientConfig {
  /** Query nur ausfuehren, wenn true (Default: true) — z.B. aus wenn der Aufrufer bereits Modelle hat. */
  enabled?: boolean
}

export function useLlmModels(
  scope: LlmModelsScope = 'public',
  options?: UseLlmModelsOptions,
): UseQueryResult<LlmModelDto[], Error> {
  return useQuery({
    queryKey: ['ks-api-client', 'llm-models', scope],
    queryFn: () => fetchLlmModels(scope, options),
    enabled: options?.enabled ?? true,
  })
}
