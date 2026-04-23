#!/usr/bin/env node
// Modul-Health-Report
//
// Liest alle Module unter src/lib/ und gibt pro Modul eine Health-Tabelle aus:
// - Anzahl Quelldateien
// - max. Zeilenzahl einer Datei
// - hat Tests in tests/unit/<modul>/ ja/nein
// - any-Vorkommen (Type-Annotation `: any` oder `as any` oder `<any>`)
// - leere catch-Bloecke (`catch {}` oder `catch (e) {}`)
// - 'use client'-Direktiven
//
// Schwellwerte (siehe AGENTS.md, Plan-Schritt 7 "Abnahme"):
// - 0 'any'
// - 0 leere Catches
// - 0 Dateien > 200 Zeilen (ausser dokumentierte Ausnahme)
//
// Aufruf: node scripts/module-health.mjs [--module <name>] [--json]

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const LIB_DIR = path.join(ROOT, 'src/lib');
const TESTS_DIR = path.join(ROOT, 'tests/unit');
const MAX_LINES = 200;

const args = process.argv.slice(2);
const filterModule = args.includes('--module') ? args[args.indexOf('--module') + 1] : null;
const asJson = args.includes('--json');

async function listModules() {
  const entries = await fs.readdir(LIB_DIR, { withFileTypes: true });
  const modules = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      modules.push({ name: entry.name, kind: 'dir', root: path.join(LIB_DIR, entry.name) });
    } else if (entry.isFile() && /\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      const moduleName = entry.name.replace(/\.(ts|tsx|mjs|js)$/, '');
      modules.push({ name: moduleName, kind: 'file', root: path.join(LIB_DIR, entry.name) });
    }
  }
  return modules.sort((a, b) => a.name.localeCompare(b.name));
}

async function walk(dir) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...await walk(full));
    } else if (entry.isFile() && /\.(ts|tsx|mjs|js)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

async function fileStats(filePath) {
  const text = await fs.readFile(filePath, 'utf8');
  const lines = text.split('\n').length;
  // any-Drift: matched ': any', 'as any', '<any>', '<any,', 'Array<any>'
  // ignoriert Vorkommen in Kommentar-Zeilen (sehr grobe Heuristik: Zeile beginnt mit //)
  const anyCount = text
    .split('\n')
    .filter((line) => !/^\s*\/\//.test(line))
    .filter((line) => /:\s*any\b|\bas\s+any\b|<any[\s,>]/.test(line))
    .length;
  // leere catch-Bloecke (ohne Inhalt zwischen den geschwungenen Klammern)
  const emptyCatch = (text.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) || []).length;
  // 'use client' direktive in der ersten 3 Zeilen
  const firstLines = text.split('\n').slice(0, 3).join('\n');
  const useClient = /['"]use client['"]/.test(firstLines) ? 1 : 0;
  return { lines, anyCount, emptyCatch, useClient };
}

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    // Datei/Ordner existiert nicht — ist hier nicht-fehlerhaft
    return false;
  }
}

async function moduleHealth(mod) {
  const files = mod.kind === 'dir' ? await walk(mod.root) : [mod.root];
  let totalLines = 0;
  let maxLines = 0;
  let maxLinesFile = '';
  let anyCount = 0;
  let emptyCatch = 0;
  let useClient = 0;
  let largeFiles = 0;
  for (const f of files) {
    const s = await fileStats(f);
    totalLines += s.lines;
    if (s.lines > maxLines) {
      maxLines = s.lines;
      maxLinesFile = path.relative(ROOT, f);
    }
    if (s.lines > MAX_LINES) largeFiles += 1;
    anyCount += s.anyCount;
    emptyCatch += s.emptyCatch;
    useClient += s.useClient;
  }
  const testDir = path.join(TESTS_DIR, mod.name);
  const hasTests = await pathExists(testDir);
  return {
    module: mod.name,
    files: files.length,
    totalLines,
    maxLines,
    maxLinesFile,
    largeFiles,
    hasTests,
    anyCount,
    emptyCatch,
    useClient,
  };
}

function fmtBool(v) {
  return v ? 'ja' : 'nein';
}

function renderMarkdown(reports) {
  const header = '| Modul | Files | Max-Zeilen (Datei) | >200 | Tests | any | catch{} | use client |';
  const sep = '|---|---:|---|---:|---|---:|---:|---:|';
  const rows = reports.map((r) => {
    const maxCell = `${r.maxLines} (${r.maxLinesFile || '-'})`;
    return `| \`${r.module}\` | ${r.files} | ${maxCell} | ${r.largeFiles} | ${fmtBool(r.hasTests)} | ${r.anyCount} | ${r.emptyCatch} | ${r.useClient} |`;
  });
  const totals = reports.reduce(
    (acc, r) => ({
      files: acc.files + r.files,
      large: acc.large + r.largeFiles,
      anyC: acc.anyC + r.anyCount,
      catchC: acc.catchC + r.emptyCatch,
      useC: acc.useC + r.useClient,
    }),
    { files: 0, large: 0, anyC: 0, catchC: 0, useC: 0 }
  );
  const summary = `\nSumme ${reports.length} Module: ${totals.files} Files, ${totals.large} > ${MAX_LINES} Zeilen, ${totals.anyC} any, ${totals.catchC} leere Catches, ${totals.useC} 'use client'.`;
  return [header, sep, ...rows].join('\n') + summary;
}

async function main() {
  const modules = await listModules();
  const filtered = filterModule
    ? modules.filter((m) => m.name === filterModule || m.name.startsWith(filterModule))
    : modules;
  if (filtered.length === 0) {
    console.error(`Kein Modul gefunden fuer Filter: ${filterModule}`);
    process.exit(1);
  }
  const reports = [];
  for (const mod of filtered) {
    reports.push(await moduleHealth(mod));
  }
  if (asJson) {
    console.log(JSON.stringify(reports, null, 2));
    return;
  }
  console.log('# Modul-Health (' + new Date().toISOString().slice(0, 10) + ')\n');
  console.log(renderMarkdown(reports));
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
