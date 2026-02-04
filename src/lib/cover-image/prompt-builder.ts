/**
 * @fileoverview Cover-Image Prompt Builder
 * 
 * @description
 * Zentrale Logik für die Erstellung von Cover-Image-Prompts.
 * Wird verwendet von:
 * - Pipeline (automatische Bildgenerierung während Job)
 * - Manueller Coverbild-Generator-Dialog
 * 
 * @module cover-image
 */

export interface CoverImagePromptArgs {
  /** Frontmatter coverImagePrompt (aus Template-Metadaten, höchste Priorität) */
  frontmatterPrompt?: string | null
  /** Job-Parameter coverImagePrompt (Priorität 2, für Pipeline) */
  jobParameterPrompt?: string | null
  /** Library-Config coverImagePrompt (Fallback) */
  libraryConfigPrompt?: string | null
  /** Dokumenttitel für Variablenersetzung und Anhängen */
  title?: string | null
  /** Zusammenfassung/Teaser für Variablenersetzung und Anhängen */
  summary?: string | null
}

export interface CoverImagePromptResult {
  /** Der finale Prompt (mit ersetzten Variablen) */
  prompt: string
  /** Der Basis-Prompt (ohne Variablenersetzung, für UI-Anzeige) */
  basePrompt: string
  /** Quelle des Prompts */
  source: 'frontmatter' | 'job_parameter' | 'library_config' | 'default'
}

/** Standard-Prompt wenn keine andere Quelle vorhanden */
const DEFAULT_PROMPT = 'Erstelle ein professionelles Cover-Bild für ein Dokument mit folgendem Titel und Inhalt:'

/**
 * Erstellt einen Cover-Image-Prompt mit konsistenter Priorität:
 * 1. Frontmatter coverImagePrompt (spezifisch für dieses Template)
 * 2. Job-Parameter coverImagePrompt (für Pipeline, optional)
 * 3. Library-Config coverImagePrompt (Fallback)
 * 4. Standard-Prompt
 * 
 * Variablen wie {{title}} und {{summary}} werden ersetzt.
 * Wenn keine Variablen im Prompt, werden Title/Summary angehängt.
 * 
 * @example
 * ```ts
 * const result = buildCoverImagePrompt({
 *   frontmatterPrompt: 'Erstelle ein Bild: {{title}}',
 *   title: 'Klimaschutz',
 *   summary: 'Maßnahmen für nachhaltige Zukunft'
 * })
 * // result.prompt = 'Erstelle ein Bild: Klimaschutz'
 * // result.source = 'frontmatter'
 * ```
 */
export function buildCoverImagePrompt(args: CoverImagePromptArgs): CoverImagePromptResult {
  const { frontmatterPrompt, jobParameterPrompt, libraryConfigPrompt, title, summary } = args
  
  // Priorität 1: Frontmatter (spezifisch für Template)
  // Priorität 2: Job-Parameter (für Pipeline)
  // Priorität 3: Library-Config (Fallback)
  // Priorität 4: Standard-Prompt
  let basePrompt: string
  let source: CoverImagePromptResult['source']
  
  if (frontmatterPrompt && frontmatterPrompt.trim().length > 0) {
    basePrompt = frontmatterPrompt.trim()
    source = 'frontmatter'
  } else if (jobParameterPrompt && jobParameterPrompt.trim().length > 0) {
    basePrompt = jobParameterPrompt.trim()
    source = 'job_parameter'
  } else if (libraryConfigPrompt && libraryConfigPrompt.trim().length > 0) {
    basePrompt = libraryConfigPrompt.trim()
    source = 'library_config'
  } else {
    basePrompt = DEFAULT_PROMPT
    source = 'default'
  }
  
  // Variablen ersetzen
  const titleValue = title?.trim() || ''
  const summaryValue = summary?.trim() || ''
  
  let prompt = basePrompt
    .replace(/\{\{title\}\}/gi, titleValue)
    .replace(/\{\{summary\}\}/gi, summaryValue)
    .replace(/\{\{teaser\}\}/gi, summaryValue) // {{teaser}} als Alias für {{summary}}
  
  // Wenn Prompt Variablen hatte, sind wir fertig
  const hadVariables = basePrompt.includes('{{')
  
  // Wenn keine Variablen im Prompt, Title/Summary anhängen
  if (!hadVariables) {
    const parts: string[] = [prompt]
    
    if (titleValue) {
      parts.push(`\nTitel: ${titleValue}`)
    }
    if (summaryValue) {
      parts.push(`\nZusammenfassung: ${summaryValue}`)
    }
    
    prompt = parts.join('')
  }
  
  return {
    prompt: prompt.trim(),
    basePrompt,
    source,
  }
}

export interface CoverImagePromptUIResult {
  /** Der finale Prompt für die Anzeige */
  prompt: string
  /** Quelle des Prompts */
  source: 'template' | 'frontmatter' | 'library_config' | 'default'
  /** Der Original-Prompt aus der Quelle (vor Variablenersetzung und Anhängen) */
  originalPrompt: string | null
}

/**
 * Erstellt den Basis-Prompt für die UI-Anzeige (ohne Variablenersetzung).
 * Nützlich für den manuellen Coverbild-Generator-Dialog.
 * 
 * Wenn der Prompt Variablen enthält, werden Title/Summary NICHT angehängt,
 * da die Variablen später vom Benutzer bearbeitet werden können.
 */
export function buildCoverImagePromptForUI(args: CoverImagePromptArgs & { 
  /** Template coverImagePrompt (aus Template-Definition, höchste Priorität) */
  templatePrompt?: string | null 
}): string {
  return buildCoverImagePromptForUIWithSource(args).prompt
}

/**
 * Erweiterte Version von buildCoverImagePromptForUI, die auch die Quelle zurückgibt.
 * Nützlich für informative Anzeige im Dialog.
 */
export function buildCoverImagePromptForUIWithSource(args: CoverImagePromptArgs & { 
  templatePrompt?: string | null 
}): CoverImagePromptUIResult {
  const { templatePrompt, frontmatterPrompt, libraryConfigPrompt, title, summary } = args
  
  // Basis-Prompt mit Priorität ermitteln
  let basePrompt: string | null = null
  let source: CoverImagePromptUIResult['source'] = 'default'
  let originalPrompt: string | null = null
  
  // Priorität: 1. Template, 2. Frontmatter (LLM-generiert), 3. Library-Config, 4. Default
  if (templatePrompt && templatePrompt.trim().length > 0) {
    basePrompt = templatePrompt.trim()
    source = 'template'
    originalPrompt = templatePrompt.trim()
  } else if (frontmatterPrompt && frontmatterPrompt.trim().length > 0) {
    basePrompt = frontmatterPrompt.trim()
    source = 'frontmatter'
    originalPrompt = frontmatterPrompt.trim()
  } else if (libraryConfigPrompt && libraryConfigPrompt.trim().length > 0) {
    basePrompt = libraryConfigPrompt.trim()
    source = 'library_config'
    originalPrompt = libraryConfigPrompt.trim()
  }
  
  const parts: string[] = []
  
  if (basePrompt) {
    parts.push(basePrompt)
  }
  
  // Title/Summary nur anhängen wenn Prompt keine entsprechenden Platzhalter hat
  const titleValue = title?.trim() || ''
  const summaryValue = summary?.trim() || ''
  
  if (titleValue && (!basePrompt || !basePrompt.toLowerCase().includes('{{title}}'))) {
    parts.push(titleValue)
  }
  
  if (summaryValue && (!basePrompt || (!basePrompt.toLowerCase().includes('{{summary}}') && !basePrompt.toLowerCase().includes('{{teaser}}')))) {
    parts.push(summaryValue)
  }
  
  return {
    prompt: parts.join('\n'),
    source,
    originalPrompt,
  }
}
