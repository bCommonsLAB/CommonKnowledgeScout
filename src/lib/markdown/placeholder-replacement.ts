/**
 * @fileoverview Platzhalter-Ersetzung für Markdown-Frontmatter
 * 
 * @description
 * Ersetzt Platzhalter wie {{audiofile}} im Frontmatter durch tatsächliche Werte.
 * 
 * @module markdown
 * 
 * @exports
 * - replacePlaceholdersInMarkdown: Ersetzt Platzhalter im Markdown-Frontmatter
 */

import { extractFrontmatterBlock, parseFrontmatter } from './frontmatter';

/**
 * Ersetzt Platzhalter im Markdown-Frontmatter.
 * 
 * Unterstützte Platzhalter:
 * - {{audiofile}} → wird durch sourceFileName ersetzt
 * - {{sourcefile}} → wird durch sourceFileName ersetzt
 * 
 * @param markdown Markdown-Text mit Frontmatter
 * @param sourceFileName Tatsächlicher Dateiname der Quelle
 * @returns Markdown mit ersetzten Platzhaltern
 */
export function replacePlaceholdersInMarkdown(
  markdown: string,
  sourceFileName: string
): string {
  // Prüfe ob Frontmatter vorhanden ist
  const frontmatterBlock = extractFrontmatterBlock(markdown);
  if (!frontmatterBlock) {
    // Kein Frontmatter vorhanden, keine Ersetzung nötig
    return markdown;
  }

  // Ersetze Platzhalter im Frontmatter-Block
  let replacedFrontmatter = frontmatterBlock;
  
  // Ersetze {{audiofile}} und {{sourcefile}} durch tatsächlichen Dateinamen
  replacedFrontmatter = replacedFrontmatter.replace(/\{\{audiofile\}\}/gi, sourceFileName);
  replacedFrontmatter = replacedFrontmatter.replace(/\{\{sourcefile\}\}/gi, sourceFileName);
  
  // Ersetze auch in Anführungszeichen (falls der Platzhalter als String-Wert verwendet wird)
  replacedFrontmatter = replacedFrontmatter.replace(/"\{\{audiofile\}\}"/gi, `"${sourceFileName}"`);
  replacedFrontmatter = replacedFrontmatter.replace(/"\{\{sourcefile\}\}"/gi, `"${sourceFileName}"`);
  
  // Ersetze auch ohne Anführungszeichen (falls direkt als Wert verwendet)
  replacedFrontmatter = replacedFrontmatter.replace(/:\s*\{\{audiofile\}\}/gi, `: ${sourceFileName}`);
  replacedFrontmatter = replacedFrontmatter.replace(/:\s*\{\{sourcefile\}\}/gi, `: ${sourceFileName}`);

  // Extrahiere Body (alles nach dem Frontmatter)
  const body = markdown.slice(frontmatterBlock.length).replace(/^---\s*\n/, '');

  // Kombiniere ersetztes Frontmatter mit Body
  return `${replacedFrontmatter}---\n${body}`;
}







