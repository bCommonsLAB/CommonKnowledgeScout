'use client'

/**
 * Shim: Re-Exportiert PerspectivePageContent und PerspectivePageContentProps
 * aus dem Submodul perspective-page-content/.
 *
 * Konsumenten koennen weiterhin diesen Pfad importieren:
 *   import { PerspectivePageContent } from '@/components/library/shared/perspective-page-content'
 *
 * Welle 3-III-c: Modul-Split — alle Implementierungsdetails liegen in:
 *   perspective-page-content/index.tsx         (Composer)
 *   perspective-page-content/header.tsx        (Navigations-Header)
 *   perspective-page-content/body.tsx          (Auswahl-Cards + CTA)
 *   perspective-page-content/helpers.ts        (Pure-Helpers)
 *   perspective-page-content/hooks/use-perspective-data.ts (State-Hook)
 */

export type { PerspectivePageContentProps } from './perspective-page-content/index'
export { PerspectivePageContent } from './perspective-page-content/index'
