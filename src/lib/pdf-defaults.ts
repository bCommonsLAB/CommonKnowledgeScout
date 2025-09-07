"use client";

import type { PdfTransformOptions } from "@/lib/transform/transform-service";

const KEY = (libraryId: string) => `pdfDefaults:${libraryId}`;

export function loadPdfDefaults(libraryId: string): Partial<PdfTransformOptions> {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(KEY(libraryId)) : null;
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Partial<PdfTransformOptions> = {};
    if (typeof parsed.targetLanguage === 'string') result.targetLanguage = parsed.targetLanguage;
    if (typeof parsed.fileExtension === 'string') result.fileExtension = parsed.fileExtension as PdfTransformOptions['fileExtension'];
    if (typeof parsed.extractionMethod === 'string') result.extractionMethod = parsed.extractionMethod;
    if (typeof parsed.useCache === 'boolean') result.useCache = parsed.useCache;
    if (typeof parsed.includeImages === 'boolean') result.includeImages = parsed.includeImages;
    if (typeof parsed.template === 'string') result.template = parsed.template;
    if (typeof parsed.useIngestionPipeline === 'boolean') result.useIngestionPipeline = parsed.useIngestionPipeline;
    return result;
  } catch {
    return {};
  }
}

export function savePdfDefaults(libraryId: string, options: PdfTransformOptions): void {
  try {
    const toStore: Record<string, unknown> = {
      targetLanguage: options.targetLanguage,
      fileExtension: options.fileExtension,
      extractionMethod: options.extractionMethod,
      useCache: options.useCache,
      includeImages: options.includeImages,
      template: options.template,
      useIngestionPipeline: options.useIngestionPipeline,
    };
    if (typeof window !== 'undefined') window.localStorage.setItem(KEY(libraryId), JSON.stringify(toStore));
  } catch {}
}



