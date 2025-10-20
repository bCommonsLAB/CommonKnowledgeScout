import { stripAllFrontmatter } from '@/lib/markdown/frontmatter'

export function createMarkdownWithFrontmatter(body: string, meta: Record<string, unknown>): string {
  const fm = '---\n' + Object.entries(meta)
    .map(([k, v]) => `${k}: ${formatValue(v)}`)
    .join('\n') + '\n---\n'
  const cleansed = stripAllFrontmatter(body)
  return fm + cleansed
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') return JSON.stringify(v)
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v) || (v && typeof v === 'object')) return JSON.stringify(v)
  return '""'
}


