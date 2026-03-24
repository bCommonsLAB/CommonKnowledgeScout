/**
 * Interner Schlüssel im Meta-Objekt während der Ingestion: Originaldateiname aus dem Job
 * (correlation.source.name). Wird nicht persistiert — vor dem Speichern entfernt, Wert
 * landet in docMetaJson.sourceFileName.
 */
export const INGEST_META_SOURCE_FILE_NAME_KEY = '_ingestSourceFileName'
