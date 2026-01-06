/**
 * @fileoverview Shadow-Twin Artefakt Namenskonventionen - Parser & Builder
 * 
 * @description
 * Zentrale Funktionen zum Parsen und Generieren von Artefakt-Dateinamen.
 * 
 * Namenskonventionen:
 * - Transcript: {baseName}.{language}.md (z.B. "audio.de.md")
 * - Transformation: {baseName}.{templateName}.{language}.md (z.B. "audio.Besprechung.de.md")
 * 
 * WICHTIG: Diese Konventionen gelten sowohl für Sibling-Dateien als auch für Dateien im Dot-Folder.
 * 
 * @module shadow-twin
 * 
 * @exports
 * - parseArtifactName: Parst einen Dateinamen und extrahiert ArtifactKind, targetLanguage, templateName
 * - buildArtifactName: Generiert einen kanonischen Dateinamen aus einem ArtifactKey
 * - extractBaseName: Extrahiert den Basisnamen aus einem Dateinamen (ohne Extension und Suffixe)
 */

import type { ArtifactKind, ArtifactKey, ParsedArtifactName } from './artifact-types';
import path from 'path';

/**
 * Bekannte Sprachen (für Validierung).
 * Kann später erweitert werden.
 */
const KNOWN_LANGUAGES = ['de', 'en', 'fr', 'es', 'it'] as const;

/**
 * Extrahiert den Basisnamen aus einem Dateinamen (ohne Extension und Suffixe).
 * 
 * @param fileName Vollständiger Dateiname (z.B. "audio.Besprechung.de.md")
 * @returns Basisname (z.B. "audio")
 */
export function extractBaseName(fileName: string): string {
  // Entferne Extension (.md)
  const withoutExt = fileName.replace(/\.md$/i, '');
  
  // Entferne bekannte Suffixe (Template + Language oder nur Language)
  // Pattern: .{template}.{lang} oder .{lang}
  // Wir müssen von hinten nach vorne arbeiten, da Template-Namen variabel sind
  
  // Versuche zuerst: .{template}.{lang} Pattern
  for (const lang of KNOWN_LANGUAGES) {
    const langSuffix = `.${lang}`;
    if (withoutExt.endsWith(langSuffix)) {
      const withoutLang = withoutExt.slice(0, -langSuffix.length);
      // Wenn noch ein Punkt vorhanden, könnte das Template sein
      const lastDot = withoutLang.lastIndexOf('.');
      if (lastDot >= 0) {
        // Prüfe ob der Teil nach dem letzten Punkt ein Template sein könnte
        // (Template-Namen sind typischerweise nicht nur Zahlen)
        const potentialTemplate = withoutLang.slice(lastDot + 1);
        if (potentialTemplate.length > 0 && !/^\d+$/.test(potentialTemplate)) {
          return withoutLang.slice(0, lastDot);
        }
      }
      // Nur Language-Suffix: Basisname ist alles vor .{lang}
      return withoutLang;
    }
  }
  
  // Fallback: Entferne einfach alles nach dem letzten Punkt
  const lastDot = withoutExt.lastIndexOf('.');
  return lastDot >= 0 ? withoutExt.slice(0, lastDot) : withoutExt;
}

/**
 * Parst einen Dateinamen und extrahiert ArtifactKind, targetLanguage und templateName.
 * 
 * @param fileName Vollständiger Dateiname (z.B. "audio.de.md" oder "audio.Besprechung.de.md")
 * @param sourceBaseName Optional: Basisname der Quelle (für bessere Erkennung)
 * @returns ParsedArtifactName mit extrahierten Informationen
 */
export function parseArtifactName(
  fileName: string,
  sourceBaseName?: string
): ParsedArtifactName {
  // WICHTIG:
  // Der Basisname kann Punkte enthalten (z.B. "Commoning vs. Kommerz").
  // Wir dürfen daher NICHT versuchen, den Basisnamen aus dem Artefakt-Dateinamen heuristisch
  // über "letzter Punkt" zu erraten, wenn wir den echten Basisnamen der Quelle kennen.
  // Sonst wird ein Transcript wie "...vs. Kommerz.de.md" fälschlich als Transformation
  // mit templateName=" Kommerz" geparsed.
  const baseName = typeof sourceBaseName === 'string' && sourceBaseName.trim().length > 0
    ? sourceBaseName.trim()
    : extractBaseName(fileName);
  
  // Entferne Extension
  const withoutExt = fileName.replace(/\.md$/i, '');
  
  // Prüfe Pattern: .{template}.{lang} oder .{lang}
  let targetLanguage: string | null = null;
  let templateName: string | null = null;
  let kind: ArtifactKind | null = null;
  
  // Suche nach Language-Suffix (von hinten)
  for (const lang of KNOWN_LANGUAGES) {
    const langSuffix = `.${lang}`;
    if (withoutExt.endsWith(langSuffix)) {
      targetLanguage = lang;
      const withoutLang = withoutExt.slice(0, -langSuffix.length);
      
      // Prüfe ob noch ein Template vorhanden ist
      if (withoutLang === baseName) {
        // Nur Language-Suffix, kein Template
        kind = 'transcript';
      } else if (withoutLang.startsWith(`${baseName}.`)) {
        // Transformation: {baseName}.{template}.{lang}
        const templatePart = withoutLang.slice(baseName.length + 1); // +1 für den Punkt
        if (templatePart.length > 0) {
          templateName = templatePart;
          kind = 'transformation';
        } else {
          // Defensive: eigentlich unmöglich, aber wir bleiben tolerant.
          kind = 'transcript';
        }
      } else {
        // Fallback: Wenn ohneLang nicht zum baseName passt, können wir es ohne Kontext nicht sicher entscheiden.
        // Wir bleiben konservativ: Transcript (damit Resolver/Validator nicht fälschlich Templates "erfinden").
        kind = 'transcript';
      }
      break;
    }
  }
  
  // Fallback: Wenn kein Language-Suffix gefunden, aber .md vorhanden
  // könnte es ein Transcript ohne Language-Suffix sein (Legacy)
  if (!targetLanguage && fileName.endsWith('.md')) {
    // Prüfe ob es ein einfaches Transcript sein könnte (nur baseName.md)
    if (sourceBaseName && baseName === sourceBaseName) {
      kind = 'transcript';
      // targetLanguage bleibt null (Originalsprache)
    }
  }
  
  return {
    kind,
    targetLanguage,
    templateName,
    baseName,
  };
}

/**
 * Generiert einen kanonischen Dateinamen aus einem ArtifactKey.
 * 
 * @param key ArtifactKey mit sourceId, kind, targetLanguage, optional templateName
 * @param sourceFileName Vollständiger Dateiname der Quelle (für Basisname-Extraktion)
 * @returns Kanonischer Dateiname (z.B. "audio.de.md" oder "audio.Besprechung.de.md")
 */
export function buildArtifactName(
  key: ArtifactKey,
  sourceFileName: string
): string {
  // Extrahiere Basisname aus sourceFileName (ohne Extension)
  const sourceBaseName = path.parse(sourceFileName).name;
  
  if (key.kind === 'transcript') {
    // Transcript: {baseName}.{language}.md
    return `${sourceBaseName}.${key.targetLanguage}.md`;
  } else {
    // Transformation: {baseName}.{templateName}.{language}.md
    if (!key.templateName) {
      throw new Error('templateName is required for transformation artifacts');
    }
    return `${sourceBaseName}.${key.templateName}.${key.targetLanguage}.md`;
  }
}

/**
 * Prüft, ob zwei ArtifactKeys auf dasselbe Artefakt verweisen.
 * 
 * @param key1 Erster ArtifactKey
 * @param key2 Zweiter ArtifactKey
 * @returns true wenn beide Keys dasselbe Artefakt identifizieren
 */
export function artifactKeysEqual(key1: ArtifactKey, key2: ArtifactKey): boolean {
  return (
    key1.sourceId === key2.sourceId &&
    key1.kind === key2.kind &&
    key1.targetLanguage === key2.targetLanguage &&
    key1.templateName === key2.templateName
  );
}





