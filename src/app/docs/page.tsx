import { redirect } from 'next/navigation'

/**
 * Route Handler für /docs
 * Leitet auf /docs/ um, damit Next.js die statische index.html aus public/docs serviert
 */
export default function DocsPage() {
  // Next.js serviert automatisch statische Dateien aus public/
  // /docs/index.html wird automatisch unter /docs/ verfügbar sein
  // Leite /docs auf /docs/ um für konsistente URLs
  redirect('/docs/')
}

