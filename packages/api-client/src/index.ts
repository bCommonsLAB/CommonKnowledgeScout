export { apiFetch, apiGet, apiPost, type ApiClientConfig } from './http'

export { fetchLlmModels, useLlmModels, type LlmModelsScope } from './llm-models'
export { fetchUserInfo, useUserInfo } from './user'
export { fetchLibraries, useLibraries } from './libraries'

// Die anonyme Sitzung (M4h): Session-ID im localStorage und der Header
// `X-Session-ID`, mit dem Galerie und Chat ohne Anmeldung die Lese-Routen
// rufen. Gehoert zum Client-Protokoll, nicht zur Galerie.
export { getOrCreateSessionId, getSessionId, clearSessionId, hasValidSession } from './anonymous-session'
export { useSessionHeaders } from './use-session-headers'
