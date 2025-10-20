import { ExternalJobsRepository } from '@/lib/external-jobs-repository'

export interface PickTemplateArgs {
  provider: {
    listItemsById(parentId: string): Promise<Array<{ id: string; type: string; metadata?: { name?: string } }>>
    createFolder(parentId: string, name: string): Promise<{ id: string }>
    getBinary(itemId: string): Promise<{ blob: Blob; mimeType?: string }>
  }
  repo: ExternalJobsRepository
  jobId: string
  preferredTemplateName?: string
}

export interface PickTemplateResult {
  templateContent: string
  templateName: string
}

export async function ensureTemplatesFolderId(provider: PickTemplateArgs['provider']): Promise<string> {
  const rootItems = await provider.listItemsById('root')
  const templatesFolder = rootItems.find(it => it.type === 'folder' && (it as { metadata?: { name?: string } }).metadata?.name?.toLowerCase() === 'templates')
  if (templatesFolder) return (templatesFolder as { id: string }).id
  const created = await provider.createFolder('root', 'templates')
  return created.id
}

export async function pickTemplate(args: PickTemplateArgs): Promise<PickTemplateResult> {
  const { provider, repo, jobId } = args
  const templatesFolderId = await ensureTemplatesFolderId(provider)
  const tplItems = await provider.listItemsById(templatesFolderId)
  const preferredTemplate = (args.preferredTemplateName || '').trim()
  const pickByName = (name: string) => tplItems.find(it => it.type === 'file' && (it as { metadata: { name: string } }).metadata.name.toLowerCase() === name.toLowerCase())
  const chosenName = preferredTemplate ? (preferredTemplate.endsWith('.md') ? preferredTemplate : `${preferredTemplate}.md`) : ''
  let chosen = chosenName ? pickByName(chosenName) : undefined
  if (!chosen) chosen = pickByName('pdfanalyse.md') || pickByName('pdfanalyse_default.md') || tplItems.find(it => it.type === 'file')
  const selectedName = (chosenName || ((chosen as unknown as { metadata?: { name?: string } })?.metadata?.name) || 'pdfanalyse.md')
  try { await repo.traceAddEvent(jobId, { spanId: 'template', name: 'template_selected', attributes: { preferred: preferredTemplate, picked: !!chosen, templateName: selectedName } }) } catch {}
  if (!chosen) {
    const defaultTemplateContent = '# {{title}}\n'
    // Falls keine Vorlage vorhanden ist und keine Upload-Funktion existiert, liefere Fallback-Inhalt zurück
    return { templateContent: defaultTemplateContent, templateName: 'pdfanalyse.md' }
  }
  const bin = await provider.getBinary((chosen as { id: string }).id)
  const templateContent = await bin.blob.text()
  return { templateContent, templateName: selectedName || 'pdfanalyse.md' }
}


