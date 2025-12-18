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
  
  // Robustere Erkennung für große Dateien:
  // - Suche nach dem ersten `---` am Anfang (mit optionalem BOM)
  // - Suche dann nach dem nächsten `---` am Zeilenanfang (robuster als Regex bei großen Dateien)
  // - Unterstützt sowohl \n (Unix) als auch \r\n (Windows) Zeilenumbrüche
  
  // Schritt 1: Finde Start-Delimiter
  const startMatch = markdown.match(/^\uFEFF?(?:\s*[\r\n])*---[\r\n]+/);
  if (!startMatch) return null;
  
  const afterStart = markdown.slice(startMatch[0].length);
  
  // Schritt 2: Suche nach End-Delimiter am Zeilenanfang (effizienter als Regex bei großen Dateien)
  // Suche nach `---` am Zeilenanfang (nach \n oder \r\n)
  // Begrenze die Suche auf die ersten 500KB des Dokuments (Frontmatter sollte nicht größer sein)
  const searchLimit = Math.min(afterStart.length, 500 * 1024);
  const searchArea = afterStart.slice(0, searchLimit);
  
  // Suche nach `---` am Zeilenanfang
  // Pattern: Zeilenumbruch gefolgt von `---` und dann Zeilenumbruch oder Ende
  let endIndex = -1;
  for (let i = 0; i < searchArea.length - 3; i++) {
    // Prüfe ob wir am Zeilenanfang sind (nach \n oder \r\n)
    if (i === 0 || searchArea[i - 1] === '\n' || (i > 1 && searchArea.slice(i - 2, i) === '\r\n')) {
      // Prüfe ob `---` folgt
      if (searchArea.slice(i, i + 3) === '---') {
        // Prüfe ob nach `---` ein Zeilenumbruch oder Ende kommt
        const afterDash = searchArea.slice(i + 3);
        if (afterDash.length === 0 || /^[\r\n]/.test(afterDash)) {
          endIndex = i;
          break;
        }
      }
    }
  }
  
  if (endIndex === -1) {
    // Fallback: Wenn kein Match gefunden wurde, könnte das `---` am Ende des Strings sein
    const lastDashIndex = searchArea.lastIndexOf('---');
    if (lastDashIndex !== -1) {
      const afterDash = searchArea.slice(lastDashIndex + 3);
      if (afterDash.length === 0 || /^[\r\n]/.test(afterDash)) {
        endIndex = lastDashIndex;
      }
    }
    
    if (endIndex === -1) {
      // Wenn immer noch nichts gefunden: Frontmatter könnte sehr lang sein
      // Versuche Regex als letzten Fallback (kann bei sehr großen Dateien langsam sein)
      const endMatch = afterStart.match(/([\s\S]*?)---(?:\s*[\r\n]|$|[^\r\n-])/);
      if (endMatch) {
        return markdown.substring(0, startMatch[0].length + endMatch[0].length);
      }
      return null;
    }
  }
  
  // Gib den kompletten Block zurück (inkl. beide Delimiter)
  return markdown.substring(0, startMatch[0].length + endIndex + 3);
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











