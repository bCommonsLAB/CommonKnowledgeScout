/**
 * @ks/contracts/library-identity.ts
 *
 * Bewusst minimaler Core-API-DTO fuer `GET /api/libraries` (Welle M2) — nur
 * die Felder, die `@ks/api-client` fuer den ersten Beweis-Client braucht.
 *
 * KEIN Ersatz fuer `ClientLibrary` (`src/types/library.ts`): jenes Interface
 * traegt die vollstaendige, per-Provider-Config (824 Zeilen, haengt an
 * `@/lib/chat/constants` + `@/lib/i18n`) und ist fuer M2 zu breit (siehe
 * AGENT-BRIEF-M2.md, „Bedarfsgetrieben"/G3). Sobald ein Modul (z.B.
 * `@ks/module-archive` oder `@ks/shell` in M3/M4) die volle Library-Config
 * ueber den Client braucht, wandert `ClientLibrary` hierher bzw. wird durch
 * dieses DTO abgeloest — nicht vorher dupliziert.
 */
export interface LibraryIdentityDto {
  id: string
  label: string
  type: string
  isEnabled: boolean
  isShared?: boolean
  slug?: string
  accessRole?: 'owner' | 'co-creator' | 'contributor' | 'moderator' | 'reader'
}
