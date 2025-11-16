/**
 * Erstellt eine Map für schnellen Lookup von Dokumentennamen (fileId -> title)
 * 
 * @param docs - Array von Dokumenten mit fileId/id und title/shortTitle
 * @returns Map von Dokument-ID zu Titel
 */
export function createDocTitleMap(
  docs: Array<{ fileId?: string; id?: string; title?: string; shortTitle?: string }>
): Map<string, string> {
  const docTitleMap = new Map<string, string>()
  docs.forEach(doc => {
    const id = doc.fileId || doc.id
    if (id) {
      const title = doc.shortTitle || doc.title || id
      docTitleMap.set(id, title)
    }
  })
  return docTitleMap
}

