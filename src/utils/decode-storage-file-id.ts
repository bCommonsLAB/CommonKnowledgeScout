/**
 * Rekonstruiert den relativen Speicherpfad aus einer fileId, sofern die ID
 * dem üblichen Schema entspricht: Base64(kodiert als „binary string“ aus UTF-8-Bytes),
 * wie in `markdown-metadata.tsx` beim Erzeugen von Streaming-URLs.
 *
 * @returns Relativer Pfad inkl. Dateiname, oder null bei unbekanntem/opaque ID-Format
 *          (z. B. `mongo-shadow-twin:…`, Graph-IDs, UUIDs).
 */
export function tryDecodeRelativePathFromFileId(fileId: string | undefined): string | null {
  const raw = typeof fileId === 'string' ? fileId.trim() : ''
  if (!raw || raw.length < 4) return null
  if (raw.startsWith('mongo-shadow-twin:')) return null

  // Nur Base64-artige Strings versuchen (keine Leerzeichen, typische Zeichen)
  if (!/^[A-Za-z0-9+/=_-]+$/.test(raw)) return null

  const normalized = raw.replace(/-/g, '+').replace(/_/g, '/')
  const padLen = (4 - (normalized.length % 4)) % 4
  const padded = normalized + '='.repeat(padLen)

  let binary: string
  try {
    binary = typeof atob === 'function' ? atob(padded) : ''
  } catch {
    return null
  }
  if (!binary || binary.length < 2) return null

  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i) & 0xff
  }
  const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes).trim()
  if (decoded.length < 1 || decoded.length > 4096) return null
  // Steuerzeichen ausschließen (kein Binär-Müll)
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(decoded)) return null

  return decoded
}
