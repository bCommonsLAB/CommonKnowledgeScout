#!/usr/bin/env node
// Welle-3-Scope-Analyse: ordnet UI-Files den drei vom User vorgeschlagenen
// Scopes zu und summiert pro Scope die Drift-Indikatoren.
//
// Scope A "Archiv-Detail":  Datei-Detailansicht (file-preview, transforms,
//                          flow, shared, *-detail.tsx, debug, ingestion-status)
// Scope B "Framework":     App-Schale (library-loader, top-menu, settings,
//                          job-monitor, library-header/switcher, file-list,
//                          file-tree, upload-dialog, app/layout, app/library/*)
// Scope C "Galerie+Story+Chat": Konsum-Sichten (gallery/, story/, chat/,
//                              perspective-*, filter-context-bar)
//
// Aufruf: node scripts/ui-scope-analysis.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'src/components/library',
  'src/app/library',
  'src/components/settings',
  'src/components/shared',
  'src/components/event-monitor',
  'src/components/creation-wizard',
];

function walk(d) {
  const out = [];
  if (!fs.existsSync(d)) return out;
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walk(f));
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(f);
  }
  return out;
}

function stats(f) {
  const t = fs.readFileSync(f, 'utf8');
  const lines = t.split('\n').length;
  const any = t.split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .filter((l) => /:\s*any\b|\bas\s+any\b|<any[\s,>]/.test(l)).length;
  const ec = (t.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) || []).length;
  const uc = /['"]use client['"]/.test(t.split('\n').slice(0, 3).join('\n')) ? 1 : 0;
  const hooks = (t.match(/\buse[A-Z]\w+\s*\(/g) || []).length;
  const storageBranch = (t.match(/primaryStore\s*===|library\.type\s*===|library\.primaryStore/g) || []).length;
  return { f: f.replace(/\\/g, '/'), lines, any, ec, uc, hooks, storageBranch };
}

// Scope-Zuordnung per Pfad-Pattern. Erste Regel gewinnt.
function classify(f) {
  const p = f.replace(/\\/g, '/');

  // Creation-Wizard: nicht Welle 3, sondern Welle 3d (Plan)
  if (p.includes('src/components/creation-wizard/')) return 'WIZARD (3d)';
  // file-preview ist explizit Welle 3b im Plan
  if (p.endsWith('src/components/library/file-preview.tsx')) return 'PREVIEW (3b)';

  // Scope C: Galerie + Story + Chat (Konsum-Sichten)
  if (p.includes('src/components/library/gallery/')) return 'C Galerie+Story+Chat';
  if (p.includes('src/components/library/story/')) return 'C Galerie+Story+Chat';
  if (p.includes('src/components/library/chat/')) return 'C Galerie+Story+Chat';
  if (p.includes('src/components/library/shared/perspective-')) return 'C Galerie+Story+Chat';
  if (p.endsWith('/filter-context-bar.tsx')) return 'C Galerie+Story+Chat';
  if (p.endsWith('/file-category-filter.tsx')) return 'C Galerie+Story+Chat';

  // Scope B: Framework / App-Schale
  if (p.startsWith('src/app/library/')) return 'B Framework';
  if (p.endsWith('/library.tsx')) return 'B Framework';
  if (p.endsWith('/library-header.tsx')) return 'B Framework';
  if (p.endsWith('/library-switcher.tsx')) return 'B Framework';
  if (p.endsWith('/file-list.tsx')) return 'B Framework';
  if (p.endsWith('/file-tree.tsx')) return 'B Framework';
  if (p.endsWith('/upload-dialog.tsx')) return 'B Framework';
  if (p.endsWith('/upload-area.tsx')) return 'B Framework';
  if (p.endsWith('/create-library-dialog.tsx')) return 'B Framework';
  if (p.includes('src/components/settings/')) return 'B Framework';
  if (p.includes('src/components/shared/job-monitor')) return 'B Framework';
  if (p.includes('src/components/event-monitor/')) return 'B Framework';

  // Scope A: Archiv-Detail (alles andere unter src/components/library/)
  if (p.includes('src/components/library/')) return 'A Archiv-Detail';

  // shared/ ohne job-monitor: behandeln wir individuell
  if (p.includes('src/components/shared/')) return 'B Framework';

  return 'UNZUGEORDNET';
}

const all = [];
for (const d of ROOTS) all.push(...walk(d));
const reports = all.map(stats).map((s) => ({ ...s, scope: classify(s.f) }));

const scopes = {};
for (const r of reports) {
  if (!scopes[r.scope]) scopes[r.scope] = { files: 0, lines: 0, hooks: 0, any: 0, ec: 0, uc: 0, large: 0, storage: 0, top: [] };
  const s = scopes[r.scope];
  s.files += 1;
  s.lines += r.lines;
  s.hooks += r.hooks;
  s.any += r.any;
  s.ec += r.ec;
  s.uc += r.uc;
  s.storage += r.storageBranch;
  if (r.lines > 200) s.large += 1;
  s.top.push(r);
}

console.log('# Welle-3-Scope-Analyse\n');
console.log('| Scope | Files | >200 | Zeilen | Hooks | use-client | catch{} | storage | any |');
console.log('|---|---:|---:|---:|---:|---:|---:|---:|---:|');
for (const [name, s] of Object.entries(scopes).sort()) {
  console.log(`| ${name} | ${s.files} | ${s.large} | ${s.lines} | ${s.hooks} | ${s.uc} | ${s.ec} | ${s.storage} | ${s.any} |`);
}

console.log('\n## Top-10 nach Zeilen je Scope\n');
for (const [name, s] of Object.entries(scopes).sort()) {
  console.log(`### ${name}`);
  s.top.sort((a, b) => b.lines - a.lines).slice(0, 10).forEach((r) => {
    console.log(`- ${String(r.lines).padStart(5)}z  ${String(r.hooks).padStart(3)}h  ${r.f}`);
  });
  console.log('');
}
