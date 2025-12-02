import { parseSecretaryMarkdownStrict } from '@/lib/secretary/response-parser'

export interface ParsedFrontmatter {
  meta: Record<string, unknown>
  body: string
}

/**
 * Liest YAML‑Frontmatter am Dokumentanfang strikt und gibt Meta + Body zurück.
 * Nutzt den bestehenden Secretary‑Parser als Single Source of Truth.
 */
export function parseFrontmatter(markdown: string): ParsedFrontmatter {
  const parsed = parseSecretaryMarkdownStrict(markdown)
  const meta: Record<string, unknown> = parsed?.meta && typeof parsed.meta === 'object' && !Array.isArray(parsed.meta)
    ? (parsed.meta as Record<string, unknown>)
    : {}
  // Frontmatter‑Block am Anfang entfernen
  const re = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/m
  const body = re.test(markdown) ? markdown.replace(re, '') : markdown
  return { meta, body }
}

/**
 * Entfernt ALLE Frontmatter-Blöcke am Dokumentanfang (robust gegen mehrfaches Präfixen).
 */
export function stripAllFrontmatter(text: string): string {
  let out = text
  const re = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/m
  while (re.test(out)) out = out.replace(re, '')
  return out
}

export interface FrontmatterEntry {
  key: string;
  rawValue: string;
  line: number;
}

export function extractFrontmatterBlock(markdown: string): string | null {
  if (typeof markdown !== 'string' || markdown.length === 0) return null;
  // Robustere Erkennung:
  // - optionales UTF‑8‑BOM am Anfang
  // - optionale Leerzeilen vor dem ersten Frontmatter‑Block
  // - Abschluss‑Delimiter auf eigener Zeile (mit oder ohne Zeilenumbruch danach)
  //
  // Wichtig: Der Regex muss den kompletten Block inkl. Delimiter zurückgeben.
  // Non-greedy Match (`*?`) stoppt beim ersten passenden End-Delimiter.
  // Unterstützt sowohl \n (Unix) als auch \r\n (Windows) Zeilenumbrüche.
  //
  // Pattern: Anfang → optionales BOM → optionale Leerzeilen → `---` + Zeilenumbruch
  //          → Inhalt (non-greedy) → Zeilenumbruch ODER direkt + `---` → optionaler Zeilenumbruch oder Ende
  // FIX: Unterstützt jetzt auch Fälle, wo nach dem letzten `---` direkt Text kommt (ohne Zeilenumbruch davor)
  // Geändert: Suche nach dem zweiten `---` - kann mit oder ohne Zeilenumbruch davor kommen
  // Suche nach dem ersten `---` am Anfang, dann nach dem nächsten `---` (mit oder ohne Zeilenumbruch davor)
  const startMatch = markdown.match(/^\uFEFF?(?:\s*[\r\n])*---[\r\n]+/);
  if (!startMatch) return null;
  
  const afterStart = markdown.slice(startMatch[0].length);
  // Suche nach dem nächsten `---` - kann am Anfang einer Zeile stehen (nach Zeilenumbruch) oder direkt nach Text
  // Non-greedy Match: stoppt beim ersten gefundenen `---`
  // Unterstützt beide Fälle: `\n---` (mit Zeilenumbruch) oder `---` direkt nach Text
  // Einfacher Ansatz: Suche nach dem ersten `---` nach dem Start
  // Pattern: Inhalt (non-greedy) bis zum ersten `---` gefolgt von:
  //   - Zeilenumbruch + optionaler Whitespace
  //   - ODER Ende des Strings
  //   - ODER einem Zeichen, das kein Zeilenumbruch und kein `-` ist (um `----` zu vermeiden)
  const endMatch = afterStart.match(/([\s\S]*?)---(?:\s*[\r\n]|$|[^\r\n-])/);
  if (!endMatch) {
    // Fallback: Wenn kein Match gefunden wurde, könnte das `---` am Ende des Strings sein
    // Suche einfach nach dem letzten `---` im String (als letzter Versuch)
    const lastDashIndex = afterStart.lastIndexOf('---');
    if (lastDashIndex === -1) return null;
    // Prüfe ob nach dem `---` ein Zeilenumbruch oder Ende kommt
    const afterDash = afterStart.slice(lastDashIndex + 3);
    if (afterDash.length === 0 || /^[\r\n]/.test(afterDash)) {
      return markdown.substring(0, startMatch[0].length + lastDashIndex + 3);
    }
    return null;
  }
  
  // Gib den kompletten Block zurück (inkl. beide Delimiter)
  // endMatch[0] enthält den Inhalt + das `---` + optionalen Whitespace/Zeilenumbruch
  return markdown.substring(0, startMatch[0].length + endMatch[0].length);
}

export function parseFrontmatterKeyValues(frontmatter: string): FrontmatterEntry[] {
  const lines = frontmatter.split('\n');
  const entries: FrontmatterEntry[] = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].trim();
    if (!raw || raw === '---') continue;
    const idx = raw.indexOf(':');
    if (idx <= 0) continue;
    const key = raw.slice(0, idx).trim();
    const value = raw.slice(idx + 1);
    if (!key) continue;
    entries.push({ key, rawValue: value, line: i + 1 });
  }
  return entries;
}

export function tryParseFrontmatterValue(rawValue: string): unknown {
  const trimmed = rawValue.trim();
  if (trimmed === '') return '';
  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true';
  if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed);
  const unquoted = trimmed.replace(/^"|"$/g, '');
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try { return JSON.parse(trimmed); } catch { /* fallthrough */ }
  }
  return unquoted;
}

export function parseFrontmatterObjectFromBlock(frontmatter: string): Record<string, unknown> {
  const entries = parseFrontmatterKeyValues(frontmatter);
  const meta: Record<string, unknown> = {};
  for (const e of entries) {
    meta[e.key] = tryParseFrontmatterValue(e.rawValue);
  }
  return meta;
}











