/**
 * @fileoverview Masked-Secret – Erkennung der Client-Maskierungs-Sentinels.
 *
 * @description
 * Neutrale Heimat fuer `isMaskedSecret`, damit sowohl der LibraryService
 * (`preserveMaskedSecrets`) als auch die Encryption-Schicht
 * (`library-credentials`) sie ohne zirkulaere Abhaengigkeit nutzen koennen.
 *
 * Erkennt die Sentinels, die `toClientLibraries()`/`maskApiKey()` an den Client
 * liefern: '********', '••••…' und 'abc….................xyz'.
 *
 * @module security
 */

/**
 * Prueft, ob ein Wert ein an den Client geliefertes Maskierungs-Sentinel ist
 * (und damit KEIN echtes Secret, das gespeichert/verschluesselt werden darf).
 */
export function isMaskedSecret(value: unknown): boolean {
  if (typeof value !== 'string' || value === '') return false
  return (
    value === '********' ||
    value.includes('••••') ||
    value.includes('....................')
  )
}
