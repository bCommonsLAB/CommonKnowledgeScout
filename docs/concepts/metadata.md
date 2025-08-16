---
title: Metadaten-Konzept
---

# Metadaten-Konzept

> Status: 📝 Konzept

Diese Seite fasst das Metadatenmodell für wissenschaftliche Medien archivier- und durchsuchbar zusammen. Ziel: standardisierte, maschinenlesbare Metadaten für unterschiedliche Medientypen.

## Ziele
- Standardisierte Erfassung wissenschaftlicher Medien
- Kompatibilität mit Dublin Core/BibTeX (Mapping möglich)
- Strikte Typisierung, flache Struktur mit Präfixen

## Basis-Schnittstellen (Auszug)

```typescript
interface BaseMetadata {
  type: string;
  created: string;
  modified: string;
}

interface TechnicalMetadata extends BaseMetadata {
  file_size: number;
  file_mime: string;
  file_extension: string;
  media_duration?: number;
  image_width?: number;
  image_height?: number;
  doc_pages?: number;
}

interface ContentMetadata extends BaseMetadata {
  title: string;
  authors: string[];
  language: string;
  subject_areas?: string[];
  keywords?: string[];
  abstract?: string;
  resource_type: string;
}
```

## YAML-Beispiel (Buch)

```yaml
---
title: "Ökosysteme der Nordsee"
authors: ["Dr. Maria Schmidt", "Prof. Hans Meyer"]
language: de
subject_areas: ["Meeresbiologie", "Ökologie"]
resource_type: Book
publicationDate: "2023-05-15"
isbn: "978-3-12345-678-9"
status: verified
---
```

Weitere Beispiele siehe archiviertes Originaldokument.


