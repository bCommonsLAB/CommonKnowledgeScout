import type { DocCardMeta } from '@/lib/gallery/types'

/**
 * Optimistischer Patch fuer Stern-Toggle: aktualisiert favoriteCount,
 * favoriteVoters und isFavorite lokal, bis der Server den Read-Pfad
 * bestaetigt hat.
 */
export function applyFavoriteToggleOptimistic(
  doc: DocCardMeta,
  nextFavorited: boolean,
  selfEmail: string,
  selfDisplayName: string,
): DocCardMeta {
  const emailNorm = selfEmail.trim().toLowerCase()
  const was = doc.isFavorite === true
  let voters = [...(doc.favoriteVoters ?? [])]
  let count = doc.favoriteCount ?? 0

  if (nextFavorited) {
    if (!was) count += 1
    const idx = voters.findIndex((v) => v.email.toLowerCase() === emailNorm)
    const label =
      selfDisplayName.trim() ||
      (emailNorm.includes('@') ? emailNorm.slice(0, emailNorm.indexOf('@')) : emailNorm)
    if (idx < 0) {
      voters.push({ email: emailNorm, name: label })
    } else {
      voters[idx] = { email: emailNorm, name: label || voters[idx].name }
    }
    voters.sort((a, b) => a.name.localeCompare(b.name, 'de'))
    return { ...doc, isFavorite: true, favoriteCount: count, favoriteVoters: voters }
  }

  if (was) count = Math.max(0, count - 1)
  voters = voters.filter((v) => v.email.toLowerCase() !== emailNorm)
  return { ...doc, isFavorite: false, favoriteCount: count, favoriteVoters: voters }
}

export function findDocInGroupedDocs(
  docsByYear: Array<[number | string, DocCardMeta[]]>,
  fileId: string,
): DocCardMeta | undefined {
  for (const [, docs] of docsByYear) {
    const d = docs.find((x) => x.fileId === fileId || x.id === fileId)
    if (d) return d
  }
  return undefined
}

/** Aktuelles Meta fuer eine fileId: zuerst `primary`, sonst Geschwister-Liste. */
export function findDocMetaByFileId(
  primary: DocCardMeta | undefined,
  fileId: string,
  siblings: DocCardMeta[] | undefined,
): DocCardMeta | undefined {
  if (primary && (primary.fileId === fileId || primary.id === fileId)) {
    return primary
  }
  if (siblings) {
    return siblings.find((d) => d.fileId === fileId || d.id === fileId)
  }
  return undefined
}
