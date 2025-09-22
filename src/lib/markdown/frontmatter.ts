export interface FrontmatterEntry {
  key: string;
  rawValue: string;
  line: number;
}

export function extractFrontmatterBlock(markdown: string): string | null {
  if (typeof markdown !== 'string' || markdown.length === 0) return null;
  // Nur Frontmatter am Dokumentanfang akzeptieren und Abschluss-Delimiter auf eigener Zeile erzwingen.
  // Dadurch kollidieren wir nicht mit '---' in Tabellen oder Texten innerhalb des Frontmatters (z. B. in JSON-Strings).
  const m = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[0] : null;
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

export function parseFrontmatter(frontmatter: string): Record<string, unknown> {
  const entries = parseFrontmatterKeyValues(frontmatter);
  const meta: Record<string, unknown> = {};
  for (const e of entries) {
    meta[e.key] = tryParseFrontmatterValue(e.rawValue);
  }
  return meta;
}











