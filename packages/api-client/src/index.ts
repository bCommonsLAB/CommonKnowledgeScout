export { apiFetch, apiGet, apiPost, apiUrl, type ApiClientConfig } from './http'

// Die Instanz, gegen die ein Modul spricht (M5): Basis-URL einmal binden,
// dann `url()` und `fetch()` — in der Voll-App gleiche Herkunft, im Embed die
// zentrale Instanz.
export { createInstanceApi, SAME_ORIGIN_API, type InstanceApi } from './instance-api'

export { fetchLlmModels, useLlmModels, type LlmModelsScope } from './llm-models'
export { fetchUserInfo, useUserInfo } from './user'
export { fetchLibraries, useLibraries } from './libraries'

// Die anonyme Sitzung (M4h): Session-ID im localStorage und der Header
// `X-Session-ID`, mit dem Galerie und Chat ohne Anmeldung die Lese-Routen
// rufen. Gehoert zum Client-Protokoll, nicht zur Galerie.
export { getOrCreateSessionId, getSessionId, clearSessionId, hasValidSession } from './anonymous-session'
export { useSessionHeaders } from './use-session-headers'
