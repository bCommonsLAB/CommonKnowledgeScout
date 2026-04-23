/**
 * @fileoverview Characterization Tests fuer phase-template.ts (Empty-Input-Pfade).
 *
 * Plan-Schritt 3 (Sicherheitsnetz vor Refactor) der Pilot-Welle external-jobs.
 * Die Hauptfunktion `runTemplatePhase` (1900 Zeilen mit ~10 externen
 * Service-Calls) ist mit angemessenem Aufwand nicht direkt mockbar. Stattdessen
 * sichern wir die testbare reine Helper-Funktion `extractFixedFieldsFromTemplate`
 * ab — sie deckt den Empty-Input-Pfad direkt und vollstaendig ab.
 *
 * Begruendung: laut Plan-Schritt 4 wird phase-template.ts in Sub-Module
 * aufgesplittet. Der Helper wird dabei voraussichtlich nach z.B.
 * `phase-template/extract-meta.ts` wandern. Char-Tests garantieren, dass die
 * Verhaltensgleichheit beim Verschieben erhalten bleibt.
 */

import { describe, expect, it } from 'vitest'
import { extractFixedFieldsFromTemplate } from '@/lib/external-jobs/phase-template'

describe('extractFixedFieldsFromTemplate (empty-input)', () => {
  it('liefert leeres Objekt bei undefined Template-Content', () => {
    expect(extractFixedFieldsFromTemplate(undefined)).toEqual({})
  })

  it('liefert leeres Objekt bei leerem String', () => {
    expect(extractFixedFieldsFromTemplate('')).toEqual({})
  })

  it('liefert leeres Objekt, wenn kein Frontmatter vorhanden ist', () => {
    const content = '# Nur Body\n\nKein Frontmatter hier.'
    expect(extractFixedFieldsFromTemplate(content)).toEqual({})
  })

  it('liefert leeres Objekt, wenn Frontmatter nur aus Kommentaren besteht', () => {
    const content = '---\n# Kommentar\n# Noch ein Kommentar\n---\n\nBody'
    expect(extractFixedFieldsFromTemplate(content)).toEqual({})
  })

  it('liefert leeres Objekt, wenn alle Felder dynamisch sind', () => {
    const content = `---
title: {{title|Titel}}
summary: {{summary|Zusammenfassung}}
---

Body`
    expect(extractFixedFieldsFromTemplate(content)).toEqual({})
  })

  it('ignoriert leere Werte (kein false oder null aus Versehen)', () => {
    const content = `---
sprache:
docType: 
---

Body`
    // Leere Werte werden uebersprungen, weil "if (!isDynamic && value)" greift
    expect(extractFixedFieldsFromTemplate(content)).toEqual({})
  })
})
