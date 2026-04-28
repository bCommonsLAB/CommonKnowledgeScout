#!/usr/bin/env node
// Stats fuer Welle 3-I Schale+Loader.
// Liest die explizit gelisteten Files und gibt eine Markdown-Tabelle aus,
// die direkt in 01-inventory.md kopiert werden kann.

import fs from 'node:fs';
import path from 'node:path';

const FILES = [
  // App-Schale
  'src/components/library/library.tsx',
  'src/components/library/library-header.tsx',
  'src/components/library/library-switcher.tsx',
  'src/app/library/page.tsx',
  'src/app/library/gallery/page.tsx',
  'src/app/library/gallery/page-client.tsx',
  'src/app/library/gallery/client.tsx',
  'src/app/library/gallery/ensure-library.tsx',
  'src/app/library/gallery/perspective/page.tsx',
  'src/app/library/create/page.tsx',
  'src/app/library/create/[typeId]/page.tsx',
  // Library-Loader
  'src/components/library/file-list.tsx',
  'src/components/library/file-tree.tsx',
  'src/components/library/upload-dialog.tsx',
  'src/components/library/upload-area.tsx',
  'src/components/library/create-library-dialog.tsx',
];

function stats(f) {
  if (!fs.existsSync(f)) return { f, exists: false, lines: 0, hooks: 0, any: 0, ec: 0, uc: 0, storageBranch: 0 };
  const t = fs.readFileSync(f, 'utf8');
  const lines = t.split('\n').length;
  const any = t.split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .filter((l) => /:\s*any\b|\bas\s+any\b|<any[\s,>]/.test(l)).length;
  const ec = (t.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) || []).length;
  const uc = /['"]use client['"]/.test(t.split('\n').slice(0, 3).join('\n')) ? 1 : 0;
  const hooks = (t.match(/\buse[A-Z]\w+\s*\(/g) || []).length;
  const storageBranch = (t.match(/primaryStore\s*===|library\.type\s*===|library\.primaryStore/g) || []).length;
  return { f, exists: true, lines, hooks, any, ec, uc, storageBranch };
}

const reports = FILES.map(stats);

console.log('| Datei | Zeilen | Hooks | use-client | catch{} | any | storage-branch |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
for (const r of reports) {
  if (!r.exists) {
    console.log(`| \`${r.f}\` | FEHLT | - | - | - | - | - |`);
    continue;
  }
  console.log(`| \`${r.f}\` | ${r.lines} | ${r.hooks} | ${r.uc} | ${r.ec} | ${r.any} | ${r.storageBranch} |`);
}

const sum = reports.reduce((a, r) => ({
  lines: a.lines + r.lines, hooks: a.hooks + r.hooks, ec: a.ec + r.ec,
  any: a.any + r.any, uc: a.uc + r.uc, storage: a.storage + r.storageBranch,
}), { lines: 0, hooks: 0, ec: 0, any: 0, uc: 0, storage: 0 });

console.log(`| **Summe** | **${sum.lines}** | **${sum.hooks}** | **${sum.uc}** | **${sum.ec}** | **${sum.any}** | **${sum.storage}** |`);
