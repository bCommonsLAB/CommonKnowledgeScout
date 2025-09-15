export interface PlaceholderHit {
  key: string;
  question: string;
  index: number;
}

export function extractPlaceholders(text: string): PlaceholderHit[] {
  const hits: PlaceholderHit[] = [];
  if (typeof text !== 'string' || text.length === 0) return hits;
  const re = /\{\{([^}|]+)\|([^}]+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const key = (m[1] || '').trim();
    const question = (m[2] || '').trim();
    if (key) hits.push({ key, question, index: m.index });
  }
  return hits;
}

export interface HeadingInfo {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  title: string;
  start: number;
}

export function parseHeadings(text: string): HeadingInfo[] {
  const lines = text.split('\n');
  const out: HeadingInfo[] = [];
  let offset = 0;
  for (const line of lines) {
    const m = /^(#{1,6})\s*(.*)$/.exec(line);
    if (m) {
      const level = Math.min(6, Math.max(1, m[1].length)) as 1|2|3|4|5|6;
      const title = m[2].trim();
      out.push({ level, title, start: offset });
    }
    offset += line.length + 1;
  }
  return out;
}

export function assignHeadingsToPlaceholders(text: string): Array<PlaceholderHit & { headingPath: string[] } > {
  const heads = parseHeadings(text);
  const hits = extractPlaceholders(text);
  const withPath: Array<PlaceholderHit & { headingPath: string[] }> = [];
  for (const h of hits) {
    // finde letzte Überschrift vor Index und baue Pfad auf Basis steigender Level
    const prev = heads.filter(x => x.start <= h.index);
    const path: string[] = [];
    let lastLevel = 0;
    for (const hd of prev) {
      if (hd.level >= lastLevel) {
        path.push(hd.title);
        lastLevel = hd.level;
      }
    }
    withPath.push({ ...h, headingPath: path });
  }
  return withPath;
}


