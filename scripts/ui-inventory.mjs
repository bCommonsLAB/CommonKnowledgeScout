#!/usr/bin/env node
// Ad-hoc UI-Inventur fuer Welle 3a (Archiv-Ansicht).
// Liest src/components/library und src/app/library, gibt Top-Files
// nach Zeilen mit Drift-Indikatoren aus (any-Count, leere Catches,
// 'use client', Hook-Anzahl, Storage-Branches).
//
// Aufruf: node scripts/ui-inventory.mjs

import fs from 'node:fs';
import path from 'node:path';

const ROOTS = [
  'src/components/library',
  'src/app/library',
  'src/components/settings',
];

function walk(d) {
  const out = [];
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
  const any = t
    .split('\n')
    .filter((l) => !/^\s*\/\//.test(l))
    .filter((l) => /:\s*any\b|\bas\s+any\b|<any[\s,>]/.test(l))
    .length;
  const ec = (t.match(/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g) || []).length;
  const uc = /['"]use client['"]/.test(t.split('\n').slice(0, 3).join('\n')) ? 1 : 0;
  const hooks = (t.match(/\buse[A-Z]\w+\s*\(/g) || []).length;
  // grobe Storage-Branch-Heuristik (Verstoss gegen storage-abstraction)
  const storageBranch = (t.match(/primaryStore\s*===|library\.type\s*===|library\.primaryStore/g) || []).length;
  return { f, lines, any, ec, uc, hooks, storageBranch };
}

const all = [];
for (const d of ROOTS) {
  if (fs.existsSync(d)) all.push(...walk(d));
}
const reports = all.map(stats);
const top = [...reports].sort((a, b) => b.lines - a.lines).slice(0, 40);

console.log('Top-40 nach Zeilen (Welle 3a Scope-Analyse):');
console.log('Lines | use-client | hooks | any | catch{} | storage-branch | Datei');
for (const r of top) {
  const cells = [
    String(r.lines).padStart(5),
    String(r.uc).padStart(10),
    String(r.hooks).padStart(5),
    String(r.any).padStart(3),
    String(r.ec).padStart(7),
    String(r.storageBranch).padStart(14),
    r.f.replace(/\\/g, '/'),
  ];
  console.log(cells.join(' | '));
}
console.log('\nGesamt-Files:', all.length);
console.log('Gesamt-Zeilen:', reports.reduce((a, b) => a + b.lines, 0));
console.log('Gesamt any:', reports.reduce((a, b) => a + b.any, 0));
console.log('Gesamt leere Catches:', reports.reduce((a, b) => a + b.ec, 0));
console.log('Gesamt Storage-Branches:', reports.reduce((a, b) => a + b.storageBranch, 0));
console.log('Gesamt > 200 Zeilen:', reports.filter((r) => r.lines > 200).length);
