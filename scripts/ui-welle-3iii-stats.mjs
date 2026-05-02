#!/usr/bin/env node
// Stats fuer Welle 3-III Galerie + Story-Mode + Chat.
// Liest die explizit gelisteten Files und gibt eine Markdown-Tabelle aus,
// die direkt in 01-inventory.md kopiert werden kann.
//
// Scope-Definition (Plan-Sektion 5, Welle 3-III):
// - gallery/* (Document-Card-Grid + Tabellen + Facetten)
// - chat/* inkl. hooks/ + utils/ (RAG-Chat-UI)
// - story/* (Story-Mode-UI)
// - shared/perspective-* (Perspective-Page-Content + Display)
// - filter-context-bar.tsx (Galerie-Filterleiste)
// - file-category-filter.tsx (Kategorie-Filter, von Galerie genutzt)
//
// Bewusst NICHT in 3-III (gehoeren zu anderen Wellen):
// - Welle 3-I: library.tsx, library-header, library-switcher, file-list,
//   file-tree, upload-dialog, upload-area, create-library-dialog,
//   audio-recorder-client, pdf-bulk-import-dialog
// - Welle 3-II: file-preview, markdown-preview, job-report-tab, media-tab,
//   *-detail.tsx-Familie, audio-/video-/image-/pdf-Renderer,
//   markdown-Sub-Komponenten, flow/*, shared/* OHNE perspective-*
// - Welle 3-IV: settings/*
// - Welle 3-V: event-monitor/*, shared/job-monitor-panel
// - Welle 3-VI: creation-wizard/*

import fs from 'node:fs';

const FILES = [
  // --- gallery/* (30 Files) ---
  'src/components/library/gallery/gallery-root.tsx',
  'src/components/library/gallery/gallery-sticky-header.tsx',
  'src/components/library/gallery/gallery-card-density-toggle.tsx',
  'src/components/library/gallery/document-card.tsx',
  'src/components/library/gallery/document-share-button.tsx',
  'src/components/library/gallery/document-filter-group.tsx',
  'src/components/library/gallery/detail-overlay.tsx',
  'src/components/library/gallery/delete-document-button.tsx',
  'src/components/library/gallery/bulk-delete-button.tsx',
  'src/components/library/gallery/bulk-publish-button.tsx',
  'src/components/library/gallery/publish-document-button.tsx',
  'src/components/library/gallery/publish-status-chips.tsx',
  'src/components/library/gallery/open-in-archive-button.tsx',
  'src/components/library/gallery/items-view.tsx',
  'src/components/library/gallery/items-table.tsx',
  'src/components/library/gallery/items-grid.tsx',
  'src/components/library/gallery/grouped-items-view.tsx',
  'src/components/library/gallery/grouped-items-table.tsx',
  'src/components/library/gallery/grouped-items-grid.tsx',
  'src/components/library/gallery/virtualized-items-view.tsx',
  'src/components/library/gallery/view-mode-toggle.tsx',
  'src/components/library/gallery/switch-to-story-mode-button.tsx',
  'src/components/library/gallery/speaker-icons.tsx',
  'src/components/library/gallery/references-sheet.tsx',
  'src/components/library/gallery/references-legend.tsx',
  'src/components/library/gallery/reference-group-header.tsx',
  'src/components/library/gallery/mobile-filters-sheet.tsx',
  'src/components/library/gallery/filters-panel.tsx',
  'src/components/library/gallery/facets-list.tsx',
  'src/components/library/gallery/facet-group.tsx',

  // --- chat/* (28 Files inkl. hooks/, utils/) ---
  'src/components/library/chat/chat-panel.tsx',
  'src/components/library/chat/chat-messages-list.tsx',
  'src/components/library/chat/chat-message.tsx',
  'src/components/library/chat/chat-input.tsx',
  'src/components/library/chat/chat-config-bar.tsx',
  'src/components/library/chat/chat-config-display.tsx',
  'src/components/library/chat/chat-config-popover.tsx',
  'src/components/library/chat/chat-conversation-item.tsx',
  'src/components/library/chat/chat-document-sources.tsx',
  'src/components/library/chat/chat-filters-display.tsx',
  'src/components/library/chat/chat-reference-list.tsx',
  'src/components/library/chat/chat-selector.tsx',
  'src/components/library/chat/chat-suggested-questions.tsx',
  'src/components/library/chat/chat-welcome-assistant.tsx',
  'src/components/library/chat/debug-panel.tsx',
  'src/components/library/chat/debug-step-table.tsx',
  'src/components/library/chat/debug-timeline.tsx',
  'src/components/library/chat/debug-trace.tsx',
  'src/components/library/chat/processing-logs-dialog.tsx',
  'src/components/library/chat/processing-status.tsx',
  'src/components/library/chat/query-details-dialog.tsx',
  'src/components/library/chat/hooks/use-chat-config.ts',
  'src/components/library/chat/hooks/use-chat-history.ts',
  'src/components/library/chat/hooks/use-chat-scroll.ts',
  'src/components/library/chat/hooks/use-chat-stream.ts',
  'src/components/library/chat/hooks/use-chat-toc.ts',
  'src/components/library/chat/utils/chat-storage.ts',
  'src/components/library/chat/utils/chat-utils.ts',

  // --- story/* (3 Files) ---
  'src/components/library/story/story-mode-header.tsx',
  'src/components/library/story/story-header.tsx',
  'src/components/library/story/story-topics.tsx',

  // --- shared/perspective-* (2 Files) ---
  'src/components/library/shared/perspective-page-content.tsx',
  'src/components/library/shared/perspective-display.tsx',

  // --- filter-context-bar + file-category-filter ---
  'src/components/library/filter-context-bar.tsx',
  'src/components/library/file-category-filter.tsx',
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
  files: a.files + (r.exists ? 1 : 0),
}), { lines: 0, hooks: 0, ec: 0, any: 0, uc: 0, storage: 0, files: 0 });

console.log(`| **Summe** | **${sum.lines}** | **${sum.hooks}** | **${sum.uc}** | **${sum.ec}** | **${sum.any}** | **${sum.storage}** |`);
console.log(`\nFiles erfasst: ${sum.files}`);
