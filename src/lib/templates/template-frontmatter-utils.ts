/**
 * @fileoverview Hilfsfunktionen für Frontmatter-Manipulation
 * 
 * @description
 * Funktionen zum Extrahieren und Einfügen des creation-Blocks in/aus Frontmatter.
 */

import type { TemplateCreationConfig, CreationFlowStepPreset } from './template-types'
import { parseFrontmatterObjectFromBlock } from '@/lib/markdown/frontmatter'

/**
 * Extrahiert einen verschachtelten YAML-Block nach einem Key
 * Unterstützt mehrzeilige, verschachtelte Strukturen mit korrekter Einrückung
 */
function extractYamlBlockAfterKey(frontmatterBlock: string, key: string): string | null {
  // Unterstütze sowohl \n als auch \r\n (Windows)
  const lines = frontmatterBlock.split(/\r?\n/)
  let keyLineIndex = -1
  let keyIndent = 0
  
  // Finde die Zeile mit dem Key
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!.trim()
    if (trimmed === `${key}:` || trimmed.startsWith(`${key}:`)) {
      keyLineIndex = i
      keyIndent = lines[i]!.length - trimmed.length
      break
    }
  }
  
  if (keyLineIndex === -1) {
    return null
  }
  
  // Sammle alle Zeilen, die zum Block gehören (größere Einrückung als Key)
  const blockLines: string[] = []
  
  for (let i = keyLineIndex + 1; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()
    
    // Leere Zeilen gehören zum Block (werden später gefiltert)
    if (!trimmed) {
      blockLines.push(line)
      continue
    }
    
    // Prüfe Einrückung
    const currentIndent = line.length - trimmed.length
    
    // Wenn Einrückung kleiner oder gleich der Key-Einrückung ist, sind wir raus
    // (außer es ist ein Kommentar, der auf gleicher Ebene sein kann)
    if (currentIndent <= keyIndent && !trimmed.startsWith('#')) {
      break
    }
    
    blockLines.push(line)
  }
  
  const result = blockLines.length > 0 ? blockLines.join('\n') : null
  return result
}

/**
 * Parst einen YAML-Block-String zu einem Objekt
 * Spezialisierter Parser für creation-Block-Struktur
 */
function parseYamlBlock(block: string): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  // Unterstütze sowohl \n als auch \r\n (Windows)
  const allLines = block.split(/\r?\n/)
  
  // Filtere leere Zeilen und Kommentare, behalte aber Einrückungsinfo
  const lines: string[] = []
  for (const line of allLines) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith('#')) {
      lines.push(line)
    }
  }
  
  if (lines.length === 0) {
    return result
  }
  
  // Finde minimale Einrückung (der Block kann eingerückt sein)
  let minIndent = Infinity
  for (const line of lines) {
    const indent = line.length - line.trimStart().length
    if (indent < minIndent) {
      minIndent = indent
    }
  }
  
  let i = 0
  
  function getIndent(line: string): number {
    return line.length - line.trimStart().length
  }
  
  function parseArray(parentIndent: number): unknown[] {
    const arr: unknown[] = []
    
    while (i < lines.length) {
      const line = lines[i]!
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        i++
        continue
      }
      
      const indent = getIndent(line)
      
      // Wenn Einrückung zurückgeht, sind wir fertig
      if (indent <= parentIndent) {
        break
      }
      
      // Array-Element sollte mit `-` beginnen
      if (trimmed.startsWith('-')) {
        const valuePart = trimmed.slice(1).trim()
        
        // Prüfe, ob es ein Objekt ist (entweder direkt `- id: value` oder mehrzeilig)
        if (valuePart.includes(':')) {
          const itemObj: Record<string, unknown> = {}
          
          // Parse das erste Key-Value-Paar direkt aus der `-` Zeile
          const colonIdx = valuePart.indexOf(':')
          const firstKey = valuePart.slice(0, colonIdx).trim()
          const firstValue = valuePart.slice(colonIdx + 1).trim()
          itemObj[firstKey] = firstValue ? parseYamlValue(firstValue) : null
          
          i++ // Gehe zur nächsten Zeile
          
          // Parse weitere Key-Value-Paare dieses Objekts
          while (i < lines.length) {
            const objLine = lines[i]!
            const objTrimmed = objLine.trim()
            if (!objTrimmed || objTrimmed.startsWith('#')) {
              i++
              continue
            }
            
            const objIndent = getIndent(objLine)
            
            // Wenn Einrückung zurückgeht, sind wir fertig mit diesem Objekt
            if (objIndent <= indent) {
              break
            }
            
            // Key-Value-Paar (muss mehr eingerückt sein als die `-` Zeile)
            if (objIndent > indent && objTrimmed.includes(':')) {
              const colonIdx = objTrimmed.indexOf(':')
              const key = objTrimmed.slice(0, colonIdx).trim()
              const value = objTrimmed.slice(colonIdx + 1).trim()
              i++
              
              // Prüfe, ob der Wert ein Array oder Objekt ist
              if (i < lines.length) {
                const nextLine = lines[i]!
                const nextTrimmed = nextLine.trim()
                const nextIndent = getIndent(nextLine)
                
                if (nextIndent > objIndent && nextTrimmed.startsWith('-')) {
                  // Es ist ein Array
                  itemObj[key] = parseArray(objIndent)
                  continue
                } else if (nextIndent > objIndent && nextTrimmed.includes(':')) {
                  // Es ist ein verschachteltes Objekt
                  itemObj[key] = parseObject(objIndent)
                  continue
                }
              }
              
              // Einfacher Wert
              itemObj[key] = value ? parseYamlValue(value) : null
            } else {
              break
            }
          }
          
          arr.push(itemObj)
        } else {
          // Einfacher Wert
          arr.push(parseYamlValue(valuePart))
          i++
        }
      } else {
        i++
      }
    }
    
    return arr
  }
  
  function parseObject(parentIndent: number): Record<string, unknown> {
    const obj: Record<string, unknown> = {}
    
    while (i < lines.length) {
      const line = lines[i]!
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) {
        i++
        continue
      }
      
      const indent = getIndent(line)
      
      // Wenn Einrückung zurückgeht, sind wir fertig
      if (indent <= parentIndent) {
        break
      }
      
      // Key-Value-Paar
      if (trimmed.includes(':')) {
        const colonIdx = trimmed.indexOf(':')
        const key = trimmed.slice(0, colonIdx).trim()
        const value = trimmed.slice(colonIdx + 1).trim()
        i++

        // YAML Block-Scalar: key: |  (oder |- / |+)
        // Wir unterstützen das minimal für Markdown-Inhalte im creation.welcome.
        if (value === '|' || value === '|-' || value === '|+') {
          const scalarLines: string[] = []
          let minScalarIndent = Infinity

          while (i < lines.length) {
            const l = lines[i]!
            const lTrimmed = l.trim()
            if (!lTrimmed) {
              scalarLines.push('')
              i++
              continue
            }
            const lIndent = getIndent(l)
            if (lIndent <= indent) break
            if (lIndent < minScalarIndent) minScalarIndent = lIndent
            scalarLines.push(l.slice(lIndent)) // temporär; wir normalisieren später
            i++
          }

          // Normalisiere Einrückung der Block-Scalar-Lines (entferne gemeinsame Einrückung)
          // Wenn keine echte Content-Line vorhanden ist, minScalarIndent bleibt Infinity.
          const normalized = scalarLines
            .map((line) => {
              // Wir haben oben bereits l.slice(lIndent) gespeichert, das ist schon "trimmed indent".
              // Leere Zeilen bleiben leer.
              return line
            })
            .join('\n')
            .replace(/\s+$/g, '') // trailing whitespace am Ende entfernen

          obj[key] = normalized
          continue
        }
        
        // Prüfe nächste Zeile
        if (i < lines.length) {
          const nextLine = lines[i]!
          const nextTrimmed = nextLine.trim()
          const nextIndent = getIndent(nextLine)
          
          if (nextIndent > indent) {
            if (nextTrimmed.startsWith('-')) {
              // Es ist ein Array
              obj[key] = parseArray(indent)
              continue
            } else if (nextTrimmed.includes(':')) {
              // Es ist ein verschachteltes Objekt
              obj[key] = parseObject(indent)
              continue
            }
          }
        }
        
        // Einfacher Wert
        obj[key] = value ? parseYamlValue(value) : null
      } else {
        i++
      }
    }
    
    return obj
  }
  
  // Parse Top-Level (mit minimaler Einrückung als Basis)
  while (i < lines.length) {
    const line = lines[i]!
    const trimmed = line.trim()
    
    const indent = getIndent(line)
    
    if (indent < minIndent) {
      break // Unterhalb der minimalen Einrückung
    }
    
    if (trimmed.includes(':')) {
      const colonIdx = trimmed.indexOf(':')
      const key = trimmed.slice(0, colonIdx).trim()
      const value = trimmed.slice(colonIdx + 1).trim()
      i++

      // YAML Block-Scalar auf Top-Level
      if (value === '|' || value === '|-' || value === '|+') {
        const scalarLines: string[] = []
        while (i < lines.length) {
          const l = lines[i]!
          const lTrimmed = l.trim()
          if (!lTrimmed) {
            scalarLines.push('')
            i++
            continue
          }
          const lIndent = getIndent(l)
          if (lIndent <= indent) break
          scalarLines.push(l.slice(lIndent))
          i++
        }
        result[key] = scalarLines.join('\n').replace(/\s+$/g, '')
        continue
      }
      
      // Prüfe, ob es ein Array oder Objekt ist
      if (i < lines.length) {
        const nextLine = lines[i]!
        const nextTrimmed = nextLine.trim()
        if (!nextTrimmed || nextTrimmed.startsWith('#')) {
          // Leere Zeile oder Kommentar - einfacher Wert
          result[key] = value ? parseYamlValue(value) : null
          continue
        }
        
        const nextIndent = getIndent(nextLine)
        
        if (nextIndent > indent) {
          if (nextTrimmed.startsWith('-')) {
            // Es ist ein Array
            result[key] = parseArray(indent)
            continue
          } else if (nextTrimmed.includes(':')) {
            // Es ist ein verschachteltes Objekt
            result[key] = parseObject(indent)
            continue
          }
        }
      }
      
      // Einfacher Wert
      result[key] = value ? parseYamlValue(value) : null
    } else {
      i++
    }
  }
  
  return result
}

function parseYamlValue(value: string): unknown {
  const trimmed = value.trim()
  if (trimmed === '') return ''
  if (trimmed === 'true' || trimmed === 'false') return trimmed === 'true'
  if (/^[-+]?[0-9]+(\.[0-9]+)?$/.test(trimmed)) return Number(trimmed)
  // Entferne Quotes
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * Extrahiert den creation-Block aus Frontmatter
 * Unterstützt verschachtelte YAML-Strukturen
 */
export function extractCreationFromFrontmatter(frontmatter: string): TemplateCreationConfig | null {
  if (!frontmatter || !frontmatter.trim()) {
    return null
  }
  
  try {
    // Unterstütze sowohl \n als auch \r\n (Windows)
    const frontmatterBlock = frontmatter.replace(/^---\r?\n/, '').replace(/\r?\n---$/, '')
    
    // Prüfe, ob creation: im Frontmatter vorhanden ist
    if (!frontmatterBlock.includes('creation:')) {
      return null
    }
    
    // Versuche zuerst, den creation-Block als verschachtelte YAML-Struktur zu extrahieren
    const creationBlock = extractYamlBlockAfterKey(frontmatterBlock, 'creation')
    
    if (creationBlock) {
      const creationObj = parseYamlBlock(creationBlock)
      
      if (creationObj && typeof creationObj === 'object') {
        // Validiere und normalisiere creation-Objekt
        const obj = creationObj as Record<string, unknown>
        const supportedSources = Array.isArray(obj.supportedSources) ? obj.supportedSources : []
        const flow = obj.flow && typeof obj.flow === 'object' ? obj.flow as Record<string, unknown> : {}
        const steps = Array.isArray(flow.steps) ? flow.steps : []
        
        // UI-Metadaten extrahieren
        const ui = obj.ui && typeof obj.ui === 'object' ? obj.ui as Record<string, unknown> : null
        const uiConfig = ui ? {
          displayName: typeof ui.displayName === 'string' ? ui.displayName : undefined,
          description: typeof ui.description === 'string' ? ui.description : undefined,
          icon: typeof ui.icon === 'string' ? ui.icon : undefined
        } : undefined

        // Folge-Wizards (optional) extrahieren
        const follow = obj.followWizards && typeof obj.followWizards === 'object' ? obj.followWizards as Record<string, unknown> : null
        const followWizards = follow ? {
          testimonialTemplateId: typeof follow.testimonialTemplateId === 'string' ? follow.testimonialTemplateId : undefined,
          finalizeTemplateId: typeof follow.finalizeTemplateId === 'string' ? follow.finalizeTemplateId : undefined,
          publishTemplateId: typeof follow.publishTemplateId === 'string' ? follow.publishTemplateId : undefined,
        } : undefined

        // Welcome (Markdown) extrahieren
        const welcomeObj = obj.welcome && typeof obj.welcome === 'object' ? obj.welcome as Record<string, unknown> : null
        const welcomeMarkdown = welcomeObj && typeof welcomeObj.markdown === 'string' ? welcomeObj.markdown : undefined

        // Preview (Detailansicht) extrahieren
        const previewObj = obj.preview && typeof obj.preview === 'object' ? obj.preview as Record<string, unknown> : null
        const detailViewType = previewObj && typeof previewObj.detailViewType === 'string' ? previewObj.detailViewType : undefined

        // Output (Dateiname-Regeln) extrahieren
        const outputObj = obj.output && typeof obj.output === 'object' ? obj.output as Record<string, unknown> : null
        const fileNameObj =
          outputObj?.fileName && typeof outputObj.fileName === 'object'
            ? (outputObj.fileName as Record<string, unknown>)
            : null
        const metadataFieldKey = fileNameObj && typeof fileNameObj.metadataFieldKey === 'string' ? fileNameObj.metadataFieldKey : undefined
        const autoFillMetadataField = fileNameObj && typeof fileNameObj.autoFillMetadataField === 'boolean' ? fileNameObj.autoFillMetadataField : undefined
        const extension = fileNameObj && typeof fileNameObj.extension === 'string' ? fileNameObj.extension : undefined
        const fallbackPrefix = fileNameObj && typeof fileNameObj.fallbackPrefix === 'string' ? fileNameObj.fallbackPrefix : undefined
        const createInOwnFolder = outputObj && typeof outputObj.createInOwnFolder === 'boolean' ? outputObj.createInOwnFolder : undefined
        
        // ImageFields extrahieren
        const imageFields = Array.isArray(obj.imageFields) ? obj.imageFields : []
        const parsedImageFields = imageFields.map((field: unknown) => {
          if (field && typeof field === 'object') {
            const f = field as Record<string, unknown>
            return {
              key: typeof f.key === 'string' ? f.key : '',
              label: typeof f.label === 'string' ? f.label : undefined,
              multiple: typeof f.multiple === 'boolean' ? f.multiple : undefined
            }
          }
          return null
        }).filter((f): f is { key: string; label: string | undefined; multiple: boolean | undefined } => f !== null && f.key.length > 0)
        
        const result: TemplateCreationConfig = {
          supportedSources: supportedSources.map((src: unknown) => {
            if (src && typeof src === 'object') {
              const s = src as Record<string, unknown>
              return {
                id: typeof s.id === 'string' ? s.id : '',
                type: (typeof s.type === 'string' ? s.type : 'text') as TemplateCreationConfig['supportedSources'][0]['type'],
                label: typeof s.label === 'string' ? s.label : '',
                helpText: typeof s.helpText === 'string' ? s.helpText : undefined
              }
            }
            return { id: '', type: 'text' as const, label: '' }
          }).filter(s => s.id && s.label),
          flow: { 
            steps: steps.map((step: unknown) => {
              if (step && typeof step === 'object') {
                const st = step as Record<string, unknown>
                const presetValue = typeof st.preset === 'string' ? st.preset : ''
                return {
                  id: typeof st.id === 'string' ? st.id : '',
                  preset: presetValue as CreationFlowStepPreset,
                  title: typeof st.title === 'string' ? st.title : undefined,
                  description: typeof st.description === 'string' ? st.description : undefined,
                  fields: Array.isArray(st.fields) ? st.fields.filter((f): f is string => typeof f === 'string') : undefined,
                  imageFieldKeys: Array.isArray(st.imageFieldKeys) ? st.imageFieldKeys.filter((f): f is string => typeof f === 'string') : undefined
                }
              }
              return { id: '', preset: '' as CreationFlowStepPreset }
            }).filter(s => s.id && s.preset)
          }
        }

        if (followWizards && (followWizards.testimonialTemplateId || followWizards.finalizeTemplateId || followWizards.publishTemplateId)) {
          result.followWizards = followWizards
        }

        if (welcomeMarkdown && welcomeMarkdown.trim()) {
          result.welcome = { markdown: welcomeMarkdown }
        }
        if (detailViewType === 'book' || detailViewType === 'session' || detailViewType === 'testimonial' || detailViewType === 'blog') {
          result.preview = { detailViewType }
        }
        if (metadataFieldKey || autoFillMetadataField !== undefined || extension || fallbackPrefix || createInOwnFolder !== undefined) {
          result.output = {
            fileName: {
              metadataFieldKey,
              autoFillMetadataField,
              extension,
              fallbackPrefix,
            },
            createInOwnFolder,
          }
        }
        
        if (uiConfig && (uiConfig.displayName || uiConfig.description || uiConfig.icon)) {
          result.ui = uiConfig
        }
        
        if (parsedImageFields.length > 0) {
          result.imageFields = parsedImageFields
        }
        
        return result
      }
    }
    
    // Fallback: Versuche über parseFrontmatterObjectFromBlock (für flache Strukturen)
    const frontmatterObj = parseFrontmatterObjectFromBlock(frontmatterBlock)
    if (frontmatterObj && typeof frontmatterObj === 'object' && 'creation' in frontmatterObj) {
      const creation = frontmatterObj.creation as unknown
      if (creation && typeof creation === 'object') {
        // Validiere und normalisiere creation-Objekt
        const obj = creation as Record<string, unknown>
        const supportedSources = Array.isArray(obj.supportedSources) ? obj.supportedSources : []
        const flow = obj.flow && typeof obj.flow === 'object' ? obj.flow as Record<string, unknown> : {}
        const steps = Array.isArray(flow.steps) ? flow.steps : []
        
        // UI-Metadaten extrahieren (Fallback-Parsing)
        const ui = obj.ui && typeof obj.ui === 'object' ? obj.ui as Record<string, unknown> : null
        const uiConfig = ui ? {
          displayName: typeof ui.displayName === 'string' ? ui.displayName : undefined,
          description: typeof ui.description === 'string' ? ui.description : undefined,
          icon: typeof ui.icon === 'string' ? ui.icon : undefined
        } : undefined

        // Folge-Wizards (optional) extrahieren (Fallback)
        const follow = obj.followWizards && typeof obj.followWizards === 'object' ? obj.followWizards as Record<string, unknown> : null
        const followWizards = follow ? {
          testimonialTemplateId: typeof follow.testimonialTemplateId === 'string' ? follow.testimonialTemplateId : undefined,
          finalizeTemplateId: typeof follow.finalizeTemplateId === 'string' ? follow.finalizeTemplateId : undefined,
          publishTemplateId: typeof follow.publishTemplateId === 'string' ? follow.publishTemplateId : undefined,
        } : undefined

        // Welcome (Markdown) extrahieren (Fallback)
        const welcomeObj = obj.welcome && typeof obj.welcome === 'object' ? obj.welcome as Record<string, unknown> : null
        const welcomeMarkdown = welcomeObj && typeof welcomeObj.markdown === 'string' ? welcomeObj.markdown : undefined

        // Preview (Detailansicht) extrahieren (Fallback)
        const previewObj = obj.preview && typeof obj.preview === 'object' ? obj.preview as Record<string, unknown> : null
        const detailViewType = previewObj && typeof previewObj.detailViewType === 'string' ? previewObj.detailViewType : undefined

        // Output (Dateiname-Regeln) extrahieren (Fallback)
        const outputObj = obj.output && typeof obj.output === 'object' ? obj.output as Record<string, unknown> : null
        const fileNameObj =
          outputObj?.fileName && typeof outputObj.fileName === 'object'
            ? (outputObj.fileName as Record<string, unknown>)
            : null
        const metadataFieldKey = fileNameObj && typeof fileNameObj.metadataFieldKey === 'string' ? fileNameObj.metadataFieldKey : undefined
        const autoFillMetadataField = fileNameObj && typeof fileNameObj.autoFillMetadataField === 'boolean' ? fileNameObj.autoFillMetadataField : undefined
        const extension = fileNameObj && typeof fileNameObj.extension === 'string' ? fileNameObj.extension : undefined
        const fallbackPrefix = fileNameObj && typeof fileNameObj.fallbackPrefix === 'string' ? fileNameObj.fallbackPrefix : undefined
        const createInOwnFolder = outputObj && typeof outputObj.createInOwnFolder === 'boolean' ? outputObj.createInOwnFolder : undefined
        
        // ImageFields extrahieren (Fallback)
        const imageFields = Array.isArray(obj.imageFields) ? obj.imageFields : []
        const parsedImageFields = imageFields.map((field: unknown) => {
          if (field && typeof field === 'object') {
            const f = field as Record<string, unknown>
            return {
              key: typeof f.key === 'string' ? f.key : '',
              label: typeof f.label === 'string' ? f.label : undefined,
              multiple: typeof f.multiple === 'boolean' ? f.multiple : undefined
            }
          }
          return null
        }).filter((f): f is { key: string; label: string | undefined; multiple: boolean | undefined } => f !== null && f.key.length > 0)
        
        const result: TemplateCreationConfig = {
          supportedSources: supportedSources.map((src: unknown) => {
            if (src && typeof src === 'object') {
              const s = src as Record<string, unknown>
              return {
                id: typeof s.id === 'string' ? s.id : '',
                type: (typeof s.type === 'string' ? s.type : 'text') as TemplateCreationConfig['supportedSources'][0]['type'],
                label: typeof s.label === 'string' ? s.label : '',
                helpText: typeof s.helpText === 'string' ? s.helpText : undefined
              }
            }
            return { id: '', type: 'text' as const, label: '' }
          }).filter(s => s.id && s.label),
          flow: { 
            steps: steps.map((step: unknown) => {
              if (step && typeof step === 'object') {
                const st = step as Record<string, unknown>
                const presetValue = typeof st.preset === 'string' ? st.preset : ''
                return {
                  id: typeof st.id === 'string' ? st.id : '',
                  preset: presetValue as CreationFlowStepPreset,
                  title: typeof st.title === 'string' ? st.title : undefined,
                  description: typeof st.description === 'string' ? st.description : undefined,
                  fields: Array.isArray(st.fields) ? st.fields.filter((f): f is string => typeof f === 'string') : undefined,
                  imageFieldKeys: Array.isArray(st.imageFieldKeys) ? st.imageFieldKeys.filter((f): f is string => typeof f === 'string') : undefined
                }
              }
              return { id: '', preset: '' as CreationFlowStepPreset }
            }).filter(s => s.id && s.preset)
          }
        }

        if (followWizards && (followWizards.testimonialTemplateId || followWizards.finalizeTemplateId || followWizards.publishTemplateId)) {
          result.followWizards = followWizards
        }

        if (welcomeMarkdown && welcomeMarkdown.trim()) {
          result.welcome = { markdown: welcomeMarkdown }
        }
        if (detailViewType === 'book' || detailViewType === 'session' || detailViewType === 'testimonial' || detailViewType === 'blog') {
          result.preview = { detailViewType }
        }
        if (metadataFieldKey || autoFillMetadataField !== undefined || extension || fallbackPrefix || createInOwnFolder !== undefined) {
          result.output = {
            fileName: {
              metadataFieldKey,
              autoFillMetadataField,
              extension,
              fallbackPrefix,
            },
            createInOwnFolder,
          }
        }
        
        if (uiConfig && (uiConfig.displayName || uiConfig.description || uiConfig.icon)) {
          result.ui = uiConfig
        }
        
        if (parsedImageFields.length > 0) {
          result.imageFields = parsedImageFields
        }
        
        return result
      }
    }
  } catch (error) {
    // Fehler beim Parsen - ignoriere
    console.warn('Fehler beim Extrahieren des creation-Blocks:', error)
  }
  
  return null
}

/**
 * Fügt creation-Block in Frontmatter ein oder aktualisiert ihn
 */
export function injectCreationIntoFrontmatter(
  frontmatter: string,
  creation: TemplateCreationConfig | null
): string {
  if (!frontmatter || !frontmatter.trim()) {
    // Kein Frontmatter vorhanden - erstelle neues
    if (!creation) {
      return '---\n---'
    }
    return serializeCreationToFrontmatter(creation)
  }
  
  // Entferne --- Marker
  const frontmatterBlock = frontmatter.replace(/^---\n/, '').replace(/\n---$/, '')
  const lines = frontmatterBlock.split('\n')
  
  // Finde creation-Block und entferne ihn
  const newLines: string[] = []
  let inCreationBlock = false
  let creationIndent = 0
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()
    
    if (trimmed === 'creation:') {
      inCreationBlock = true
      creationIndent = line.length - trimmed.length
      continue
    }
    
    if (inCreationBlock) {
      // Prüfe, ob wir noch im creation-Block sind (anhand der Einrückung)
      const currentIndent = line.length - line.trimStart().length
      if (currentIndent <= creationIndent && trimmed && !trimmed.startsWith('#')) {
        // Wir sind aus dem Block raus
        inCreationBlock = false
        newLines.push(line)
      }
      // Sonst: Zeile überspringen (Teil des creation-Blocks)
    } else {
      newLines.push(line)
    }
  }
  
  // Füge creation-Block hinzu, falls vorhanden
  if (creation) {
    const creationYaml = serializeCreationToYaml(creation, 0)
    newLines.push('creation:')
    newLines.push(...creationYaml.split('\n').map(l => `  ${l}`))
  }
  
  return `---\n${newLines.join('\n')}\n---`
}

/**
 * Serialisiert creation-Block zu YAML-String
 */
function serializeCreationToYaml(creation: TemplateCreationConfig, indent: number): string {
  const indentStr = ' '.repeat(indent)
  const lines: string[] = []

  // welcome (optional)
  if (creation.welcome?.markdown && creation.welcome.markdown.trim()) {
    lines.push(`${indentStr}welcome:`)
    lines.push(`${indentStr}  markdown: |`)
    for (const line of creation.welcome.markdown.split('\n')) {
      lines.push(`${indentStr}    ${line}`)
    }
  }

  // preview (optional)
  if (creation.preview?.detailViewType) {
    lines.push(`${indentStr}preview:`)
    lines.push(`${indentStr}  detailViewType: ${creation.preview.detailViewType}`)
  }

  // output.fileName und output.createInOwnFolder (optional)
  if (creation.output?.fileName || creation.output?.createInOwnFolder !== undefined) {
    const fn = creation.output.fileName
    const hasFileName =
      Boolean(fn?.metadataFieldKey) ||
      fn?.autoFillMetadataField !== undefined ||
      Boolean(fn?.extension) ||
      Boolean(fn?.fallbackPrefix)
    const hasCreateInOwnFolder = creation.output.createInOwnFolder !== undefined
    
    if (hasFileName || hasCreateInOwnFolder) {
      lines.push(`${indentStr}output:`)
      if (hasFileName && fn) {
        lines.push(`${indentStr}  fileName:`)
        if (fn.metadataFieldKey) lines.push(`${indentStr}    metadataFieldKey: ${fn.metadataFieldKey}`)
        if (fn.autoFillMetadataField !== undefined) lines.push(`${indentStr}    autoFillMetadataField: ${fn.autoFillMetadataField ? 'true' : 'false'}`)
        if (fn.extension) lines.push(`${indentStr}    extension: ${fn.extension}`)
        if (fn.fallbackPrefix) lines.push(`${indentStr}    fallbackPrefix: "${fn.fallbackPrefix.replace(/"/g, '\\"')}"`)
      }
      if (hasCreateInOwnFolder) {
        lines.push(`${indentStr}  createInOwnFolder: ${creation.output.createInOwnFolder ? 'true' : 'false'}`)
      }
    }
  }

  // followWizards (optional) – Orchestrierung auf Preset-Ebene
  if (creation.followWizards) {
    const fw = creation.followWizards
    const hasAny = Boolean(fw.testimonialTemplateId || fw.finalizeTemplateId || fw.publishTemplateId)
    if (hasAny) {
      lines.push(`${indentStr}followWizards:`)
      if (fw.testimonialTemplateId) lines.push(`${indentStr}  testimonialTemplateId: ${fw.testimonialTemplateId}`)
      if (fw.finalizeTemplateId) lines.push(`${indentStr}  finalizeTemplateId: ${fw.finalizeTemplateId}`)
      if (fw.publishTemplateId) lines.push(`${indentStr}  publishTemplateId: ${fw.publishTemplateId}`)
    }
  }
  
  // supportedSources
  lines.push(`${indentStr}supportedSources:`)
  for (const source of creation.supportedSources) {
    lines.push(`${indentStr}  - id: ${source.id}`)
    lines.push(`${indentStr}    type: ${source.type}`)
    lines.push(`${indentStr}    label: "${source.label.replace(/"/g, '\\"')}"`)
    if (source.helpText) {
      lines.push(`${indentStr}    helpText: "${source.helpText.replace(/"/g, '\\"')}"`)
    }
  }
  
  // flow.steps
  lines.push(`${indentStr}flow:`)
  lines.push(`${indentStr}  steps:`)
  for (const step of creation.flow.steps) {
    lines.push(`${indentStr}    - id: ${step.id}`)
    lines.push(`${indentStr}      preset: ${step.preset}`)
    if (step.title) {
      lines.push(`${indentStr}      title: "${step.title.replace(/"/g, '\\"')}"`)
    }
    if (step.description) {
      lines.push(`${indentStr}      description: "${step.description.replace(/"/g, '\\"')}"`)
    }
    if (step.fields && step.fields.length > 0) {
      lines.push(`${indentStr}      fields:`)
      for (const field of step.fields) {
        lines.push(`${indentStr}        - ${field}`)
      }
    }
    if (step.imageFieldKeys && step.imageFieldKeys.length > 0) {
      lines.push(`${indentStr}      imageFieldKeys:`)
      for (const fieldKey of step.imageFieldKeys) {
        lines.push(`${indentStr}        - ${fieldKey}`)
      }
    }
  }
  
  // UI-Metadaten (optional)
  if (creation.ui) {
    lines.push(`${indentStr}ui:`)
    if (creation.ui.displayName) {
      lines.push(`${indentStr}  displayName: "${creation.ui.displayName.replace(/"/g, '\\"')}"`)
    }
    if (creation.ui.description) {
      lines.push(`${indentStr}  description: "${creation.ui.description.replace(/"/g, '\\"')}"`)
    }
    if (creation.ui.icon) {
      lines.push(`${indentStr}  icon: ${creation.ui.icon}`)
    }
  }
  
  // imageFields (optional)
  if (creation.imageFields && creation.imageFields.length > 0) {
    lines.push(`${indentStr}imageFields:`)
    for (const field of creation.imageFields) {
      lines.push(`${indentStr}  - key: ${field.key}`)
      if (field.label) {
        lines.push(`${indentStr}    label: "${field.label.replace(/"/g, '\\"')}"`)
      }
      if (field.multiple !== undefined) {
        lines.push(`${indentStr}    multiple: ${field.multiple ? 'true' : 'false'}`)
      }
    }
  }
  
  return lines.join('\n')
}

/**
 * Serialisiert creation-Block zu komplettem Frontmatter
 */
function serializeCreationToFrontmatter(creation: TemplateCreationConfig): string {
  return `---\n${serializeCreationToYaml(creation, 0)}\n---`
}

