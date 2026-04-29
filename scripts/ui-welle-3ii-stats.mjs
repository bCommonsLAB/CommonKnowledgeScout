#!/usr/bin/env node
// Stats fuer Welle 3-II Archiv-Detail.
// Liest die explizit gelisteten Files und gibt eine Markdown-Tabelle aus,
// die direkt in 01-inventory.md kopiert werden kann.
//
// Scope-Definition (Plan-Sektion 5, Welle 3-II):
// - Detail-View Hauptkomponenten (file-preview, job-report-tab,
//   markdown-preview, media-tab, detail-view-renderer)
// - *-detail.tsx-Familie (Testimonial, Book, Climate-Action,
//   Diva-Texture, Diva-Document, Session, Ingestion-*)
// - Media-Renderer (audio-player, audio-transform, video-*, image-*,
//   pdf-canvas-viewer, pdf-phases-view, pdf-phase-settings, pdf-transform,
//   text-editor)
// - Markdown-Sub-Komponenten (markdown-metadata, markdown-audio,
//   chapter-accordion, slide-accordion)
// - Detail-Tab-Helper (event-details-accordion, transform-result-handler,
//   transform-save-options, document-preview, ingestion-status,
//   phase-stepper, cover-image-generator-dialog)
// - flow/* (artifact-tabs, pipeline-sheet, source-renderer)
// - shared/* OHNE perspective-* (gehoert zu Welle 3-III)
//
// Bewusst NICHT in 3-II (gehoeren zu anderen Wellen):
// - audio-recorder-client.tsx, pdf-bulk-import-dialog.tsx,
//   file-category-filter.tsx (alle Welle 3-I, App-Schale)
// - composite-*-dialog.tsx (Welle 3-VI Creation-Wizard)
// - chat/*, gallery/*, story/*, filter-context-bar.tsx,
//   shared/perspective-* (Welle 3-III)
// - template-management.tsx (Welle 3-IV Settings)

import fs from 'node:fs';

const FILES = [
  // Hauptkomponenten der Detail-View
  'src/components/library/file-preview.tsx',
  'src/components/library/job-report-tab.tsx',
  'src/components/library/markdown-preview.tsx',
  'src/components/library/media-tab.tsx',
  'src/components/library/detail-view-renderer.tsx',
  'src/components/library/document-preview.tsx',

  // *-detail.tsx-Familie
  'src/components/library/testimonial-detail.tsx',
  'src/components/library/book-detail.tsx',
  'src/components/library/climate-action-detail.tsx',
  'src/components/library/diva-document-detail.tsx',
  'src/components/library/diva-texture-detail.tsx',
  'src/components/library/session-detail.tsx',
  'src/components/library/ingestion-book-detail.tsx',
  'src/components/library/ingestion-climate-action-detail.tsx',
  'src/components/library/ingestion-diva-document-detail.tsx',
  'src/components/library/ingestion-diva-texture-detail.tsx',
  'src/components/library/ingestion-session-detail.tsx',

  // Audio-/Video-Renderer (audio-recorder-client = 3-I)
  'src/components/library/audio-player.tsx',
  'src/components/library/audio-transform.tsx',
  'src/components/library/video-player.tsx',
  'src/components/library/video-transform.tsx',

  // Image-Renderer
  'src/components/library/image-preview.tsx',
  'src/components/library/image-transform.tsx',

  // PDF-Renderer (pdf-bulk-import-dialog = 3-I)
  'src/components/library/pdf-canvas-viewer.tsx',
  'src/components/library/pdf-phases-view.tsx',
  'src/components/library/pdf-phase-settings.tsx',
  'src/components/library/pdf-transform.tsx',

  // Text/Markdown-Sub-Komponenten
  'src/components/library/text-editor.tsx',
  'src/components/library/markdown-metadata.tsx',
  'src/components/library/markdown-audio.tsx',
  'src/components/library/chapter-accordion.tsx',
  'src/components/library/slide-accordion.tsx',

  // Detail-Tab-Helper
  'src/components/library/event-details-accordion.tsx',
  'src/components/library/transform-result-handler.tsx',
  'src/components/library/transform-save-options.tsx',
  'src/components/library/ingestion-status.tsx',
  'src/components/library/phase-stepper.tsx',
  'src/components/library/cover-image-generator-dialog.tsx',

  // flow/*
  'src/components/library/flow/artifact-tabs.tsx',
  'src/components/library/flow/pipeline-sheet.tsx',
  'src/components/library/flow/source-renderer.tsx',

  // shared/* (ohne perspective-*)
  'src/components/library/shared/artifact-edit-dialog.tsx',
  'src/components/library/shared/artifact-info-panel.tsx',
  'src/components/library/shared/artifact-markdown-panel.tsx',
  'src/components/library/shared/freshness-comparison-panel.tsx',
  'src/components/library/shared/ingestion-data-context.tsx',
  'src/components/library/shared/ingestion-detail-panel.tsx',
  'src/components/library/shared/ingestion-status-compact.tsx',
  'src/components/library/shared/shadow-twin-artifacts-table.tsx',
  'src/components/library/shared/shadow-twin-sync-banner.tsx',
  'src/components/library/shared/source-and-transcript-pane.tsx',
  'src/components/library/shared/story-status-icons.tsx',
  'src/components/library/shared/story-status.ts',
  'src/components/library/shared/story-view.tsx',
  'src/components/library/shared/use-ingestion-data.ts',
  'src/components/library/shared/use-resolved-transcript-item.ts',
  'src/components/library/shared/use-story-status.ts',
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
