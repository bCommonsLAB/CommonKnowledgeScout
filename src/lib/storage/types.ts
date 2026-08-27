/**
 * Duenne Re-Export-Fassade (Migrationsstrategie G2): der eigentliche Inhalt
 * lebt seit Welle M2 in `@ks/contracts` (`packages/contracts/src/storage-provider.ts`).
 * Breite Importeure (`@/lib/storage/types`) bleiben so unveraendert lauffaehig;
 * eine Folgewelle kann sie nach und nach auf `@ks/contracts` umstellen.
 */
export type {
  StorageItemMetadata,
  StorageItem,
  StorageValidationResult,
  StorageProvider,
} from '@ks/contracts'
export {
  StorageError,
  SPEICHER_NICHT_VERBUNDEN,
  istAnmeldungNoetig,
} from '@ks/contracts'
