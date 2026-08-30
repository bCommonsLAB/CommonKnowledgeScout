/**
 * Zustands-Typen pro Quelle (Sterne, „nicht wichtig") liegen seit dem
 * 2026-08-30 in `@ks/contracts` — es sind API-Antwortformen, die Galerie UND
 * Route gleichermassen brauchen. Dieselbe Einordnung wie bei den
 * Kommentar-Typen. Hier weitergereicht, damit bestehende Importpfade bleiben.
 */
export type {
  SourceUserStateValue,
  SourceUserState,
  OwnUserStatesResponse,
  SetUserStateInput,
  SetUserStateResponse,
  FavoriteVoter,
} from '@ks/contracts'
