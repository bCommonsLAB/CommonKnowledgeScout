#!/usr/bin/env -S node --import tsx
/**
 * Generate monthly merged markdown files from docs/_history (recursively).
 * For each month, create docs/_history/merged/YYYY-MM.md containing all notes
 * for that month. Each chapter starts with a strict header to enable downstream parsing:
 *
 * ***********************
 * ---
 * # <Dateiname_ohne_Extension>
 * ---
 *
 * Date detection rules (by filename without extension):
 *  - cursor_YYYY.MM.DD(.X)?_...
 *  - cursor_YY.MM.DD(.X)?_...
 *  - YYYY-MM-DD[_HH-mm-ss][--Title]
 *  - fallback -> unknown month
 */

import { promises as fs } from 'node:fs';
import path from 'node:path';

interface ParsedFileMeta {
  absolutePath: string;
  relDir: string; // relative subdir from history root
  filename: string;
  base: string; // filename without extension
  dateKey: string; // sortable key e.g., 2025-09-15T00:00:00
  monthKey: string; // YYYY-MM or 'unknown'
}

function isMarkdownFile(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.md') || lower.endsWith('.markdown');
}

function toFourDigitYear(yearStr: string): string {
  if (yearStr.length === 4) return yearStr;
  const yy = parseInt(yearStr, 10);
  const full = yy <= 69 ? 2000 + yy : 1900 + yy;
  return String(full);
}

function getMonthKeyFromDateKey(dateKey: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(dateKey)) return 'unknown';
  const month = dateKey.slice(0, 7);
  if (month === '0000-00') return 'unknown';
  return month;
}

function parseDateFromBase(base: string): { dateKey: string; monthKey: string } {
  // 1) cursor_YYYY.MM.DD(.X)?_...
  let m = base.match(/^cursor_(\d{4})[.\-](\d{2})[.\-](\d{2})(?:[.\-_](\d{1,2}))?/i);
  if (m) {
    const [, y, mo, d] = m;
    const dateKey = `${y}-${mo}-${d}T00:00:00`;
    return { dateKey, monthKey: getMonthKeyFromDateKey(dateKey) };
  }

  // 2) cursor_YY.MM.DD(.X)?_...
  m = base.match(/^cursor_(\d{2})[.\-](\d{2})[.\-](\d{2})(?:[.\-_](\d{1,2}))?/i);
  if (m) {
    const [, yy, mo, d] = m;
    const y = toFourDigitYear(yy);
    const dateKey = `${y}-${mo}-${d}T00:00:00`;
    return { dateKey, monthKey: getMonthKeyFromDateKey(dateKey) };
  }

  // 3) YYYY-MM-DD[_HH-mm-ss][--Title]
  const matchIso = base.match(/^(\d{4}-\d{2}-\d{2})(?:[_T](\d{2}-\d{2}-\d{2}))?(?:--(.+))?$/);
  if (matchIso) {
    const [, datePart, timePart] = matchIso;
    const dateKey = `${datePart}T${timePart ? timePart.replace(/-/g, ':') : '00:00:00'}`;
    return { dateKey, monthKey: getMonthKeyFromDateKey(dateKey) };
  }

  return { dateKey: '0000-00-00T00:00:00', monthKey: 'unknown' };
}

async function listMarkdownFilesRecursively(rootDirAbs: string, rootDirRel: string): Promise<string[]> {
  const results: string[] = [];
  const stack: string[] = [rootDirAbs];

  while (stack.length) {
    const current = stack.pop() as string;
    const dirents = await fs.readdir(current, { withFileTypes: true });

    for (const d of dirents) {
      const abs = path.join(current, d.name);
      if (d.isDirectory()) {
        if (d.name.toLowerCase() === 'merged') continue; // skip output dir
        stack.push(abs);
        continue;
      }
      if (!isMarkdownFile(d.name)) continue;
      results.push(abs);
    }
  }

  return results;
}

async function readMarkdownSafely(filePath: string): Promise<string> {
  const content = await fs.readFile(filePath, 'utf8');
  return content.endsWith('\n') ? content : `${content}\n`;
}

function buildChapter(heading: string, body: string): string {
  return `\n***********************\n---\n# ${heading}\n---\n\n${body}\n`;
}

function compareByDateKeyAsc(a: ParsedFileMeta, b: ParsedFileMeta): number {
  if (a.dateKey < b.dateKey) return -1;
  if (a.dateKey > b.dateKey) return 1;
  return a.filename.localeCompare(b.filename);
}

async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function main(): Promise<void> {
  const repoRoot = process.cwd();
  const historyDirRel = path.join('docs', '_history');
  const historyDirAbs = path.join(repoRoot, historyDirRel);
  const outputDirAbs = path.join(historyDirAbs, 'merged');

  // Validate history dir
  try {
    const stat = await fs.stat(historyDirAbs);
    if (!stat.isDirectory()) throw new Error(`${historyDirRel} ist kein Verzeichnis`);
  } catch {
    console.error(`Verzeichnis nicht gefunden: ${historyDirRel}`);
    process.exitCode = 1;
    return;
  }

  await ensureDir(outputDirAbs);

  // Collect files
  const absFiles = await listMarkdownFilesRecursively(historyDirAbs, historyDirRel);
  if (absFiles.length === 0) {
    console.error('Keine Markdown-Dateien in docs/_history gefunden.');
    process.exitCode = 2;
    return;
  }

  // Build metadata
  const metas: ParsedFileMeta[] = absFiles.map((absPath) => {
    const relFromHistory = path.relative(historyDirAbs, absPath);
    const filename = path.basename(absPath);
    const base = filename.replace(/\.(md|markdown)$/i, '');
    const { dateKey, monthKey } = parseDateFromBase(base);
    return {
      absolutePath: absPath,
      relDir: path.dirname(relFromHistory),
      filename,
      base,
      dateKey,
      monthKey,
    };
  });

  // Group by month
  const byMonth = new Map<string, ParsedFileMeta[]>();
  for (const m of metas) {
    const key = m.monthKey;
    if (!byMonth.has(key)) byMonth.set(key, []);
    byMonth.get(key)!.push(m);
  }

  // Sort keys and entries
  const monthKeys = Array.from(byMonth.keys()).sort();

  let totalChapters = 0;
  for (const monthKey of monthKeys) {
    const entries = byMonth.get(monthKey)!;
    entries.sort(compareByDateKeyAsc);

    const parts: string[] = [];
    parts.push(`# Chat-History — ${monthKey === 'unknown' ? 'Unbekannt' : monthKey}`);
    parts.push('> Automatisch generiert. Quelle: `docs/_history/`.');

    for (const e of entries) {
      const body = await readMarkdownSafely(e.absolutePath);
      parts.push(buildChapter(e.base, body));
    }

    const merged = parts.join('\n');
    const outName = `${monthKey}.md`;
    const outAbs = path.join(outputDirAbs, outName);
    await fs.writeFile(outAbs, merged, 'utf8');
    console.log(`Erstellt: ${path.relative(repoRoot, outAbs)} (${entries.length} Kapitel)`);
    totalChapters += entries.length;
  }

  console.log(`Monate: ${monthKeys.length}, Kapitel gesamt: ${totalChapters}`);
}

main().catch((error: unknown) => {
  console.error('Fehler beim Erzeugen der Monatsdateien:', error);
  process.exit(1);
});






