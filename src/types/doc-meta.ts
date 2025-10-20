export interface ChapterMetaEntry {
  index: number;
  id?: string;
  title?: string;
  summary?: string;
  chunkCount?: number;
}

export interface DocMeta {
  user: string;
  libraryId: string;
  fileId: string;
  fileName?: string;
  chunkCount: number;
  chaptersCount: number;
  upsertedAt: string;
  docMetaJson?: Record<string, unknown>;
  chapters?: ChapterMetaEntry[];
  // Dynamische, library-spezifische Metadaten-Felder (per Facet-Defs)
  [key: string]: unknown;
}

export interface DocMetaFilters {
  authors?: string[];
  region?: string[];
  year?: (number | string)[];
  docType?: string[];
  source?: string[];
  tags?: string[];
}


