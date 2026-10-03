/**
 * Erstellt einen Metadaten-Präfix als strukturierten Text aus docMetaJsonObj.
 * Dieser Präfix wird vor das Markdown-Body gesetzt, um die Embedding-Qualität zu verbessern.
 * 
 * @param docMetaJsonObj - Das Dokument-Metadaten-Objekt
 * @returns Formatierter Metadaten-Text oder leerer String, falls keine Metadaten vorhanden
 */
/**
 * Trennt im eingebetteten Text den Metadaten-Vorspann vom Dokument-Body.
 * Die Zitat-Ausschnitte (`zitatmarken.ts excerpt`) beginnen dahinter.
 */
export const DOKUMENT_BODY_MARKER = '--- Dokument-Body beginnt hier ---'

export function buildMetadataPrefix(docMetaJsonObj: Record<string, unknown>): string {
  const parts: string[] = []
  
  // Dokument-Titel
  const title = typeof docMetaJsonObj.title === 'string' && docMetaJsonObj.title.trim().length > 0
    ? docMetaJsonObj.title.trim()
    : undefined
  if (title) {
    parts.push(`# Dokument-Metadaten\n\n**Titel:** ${title}`)
  }
  
  // Autoren
  const authors = Array.isArray(docMetaJsonObj.authors) && docMetaJsonObj.authors.length > 0
    ? docMetaJsonObj.authors.filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    : []
  if (authors.length > 0) {
    parts.push(`**Autoren:** ${authors.join('; ')}`)
  }
  
  // Jahr
  const year = typeof docMetaJsonObj.year === 'number' && Number.isFinite(docMetaJsonObj.year)
    ? docMetaJsonObj.year
    : (typeof docMetaJsonObj.year === 'string' && docMetaJsonObj.year.trim().length > 0
      ? docMetaJsonObj.year.trim()
      : undefined)
  if (year) {
    parts.push(`**Jahr:** ${year}`)
  }
  
  // Region
  const region = typeof docMetaJsonObj.region === 'string' && docMetaJsonObj.region.trim().length > 0
    ? docMetaJsonObj.region.trim()
    : undefined
  if (region) {
    parts.push(`**Region:** ${region}`)
  }
  
  // Dokumenttyp
  const docType = typeof docMetaJsonObj.docType === 'string' && docMetaJsonObj.docType.trim().length > 0
    ? docMetaJsonObj.docType.trim()
    : undefined
  if (docType) {
    parts.push(`**Dokumenttyp:** ${docType}`)
  }
  
  // Zusammenfassung
  const summary = typeof docMetaJsonObj.summary === 'string' && docMetaJsonObj.summary.trim().length > 0
    ? docMetaJsonObj.summary.trim()
    : undefined
  if (summary) {
    parts.push(`\n**Zusammenfassung:**\n${summary}`)
  }
  
  // Teaser (falls vorhanden und von Summary verschieden)
  const teaser = typeof docMetaJsonObj.teaser === 'string' && docMetaJsonObj.teaser.trim().length > 0
    ? docMetaJsonObj.teaser.trim()
    : undefined
  if (teaser && teaser !== summary) {
    parts.push(`\n**Kurzbeschreibung:**\n${teaser}`)
  }
  
  // Tags
  const tags = Array.isArray(docMetaJsonObj.tags) && docMetaJsonObj.tags.length > 0
    ? docMetaJsonObj.tags.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : []
  if (tags.length > 0) {
    parts.push(`\n**Tags:** ${tags.join(', ')}`)
  }
  
  // Topics
  const topics = Array.isArray(docMetaJsonObj.topics) && docMetaJsonObj.topics.length > 0
    ? docMetaJsonObj.topics.filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
    : []
  if (topics.length > 0) {
    parts.push(`**Themen:** ${topics.join(', ')}`)
  }
  
  // Nur zurückgeben, wenn Metadaten vorhanden sind
  return parts.length > 0 ? parts.join('\n') : ''
}









