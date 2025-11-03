import type { RetrievedSource } from '@/types/retriever'
import type { Character } from '@/types/character'

/**
 * Erstellt eine benutzerfreundliche Beschreibung für eine Quelle
 * Statt "Chunk 18" → "Slide-Seite 2" oder "Videotranskript Abschnitt 5" etc.
 * 
 * @export für serverseitige Referenzen-Generierung
 */
export function getSourceDescription(source: RetrievedSource): string {
  // Prüfe sourceType (falls vorhanden)
  if (source.sourceType === 'slides' && source.slidePageNum !== undefined) {
    return `Slide-Seite ${source.slidePageNum}${source.slideTitle ? `: ${source.slideTitle}` : ''}`
  }
  if (source.sourceType === 'video_transcript') {
    // Video-Transkripte werden sequenziell gechunkt
    // Verwende chunkIndex + 1 als Abschnitt-Nummer (besser als nichts)
    // TODO: Könnte später durch eine echte Abschnittsnummer ersetzt werden
    const sectionNum = source.chunkIndex !== undefined ? source.chunkIndex + 1 : undefined
    return sectionNum ? `Videotranskript Abschnitt ${sectionNum}` : 'Videotranskript'
  }
  if (source.sourceType === 'body') {
    // Body-Chunks sind sequenziell, können aber nicht genau lokalisiert werden
    const sectionNum = source.chunkIndex !== undefined ? source.chunkIndex + 1 : undefined
    return sectionNum ? `Markdown-Body Abschnitt ${sectionNum}` : 'Markdown-Body'
  }
  if (source.sourceType === 'chapter' && source.chapterTitle) {
    return `Kapitel "${source.chapterTitle}"${source.chapterOrder !== undefined ? ` (${source.chapterOrder})` : ''}`
  }
  
  // Fallback: Prüfe Metadaten auch ohne sourceType (für ältere Dokumente)
  if (source.chapterTitle) {
    return `Kapitel "${source.chapterTitle}"${source.chapterOrder !== undefined ? ` (${source.chapterOrder})` : ''}`
  }
  if (source.slidePageNum !== undefined) {
    return `Slide-Seite ${source.slidePageNum}${source.slideTitle ? `: ${source.slideTitle}` : ''}`
  }
  
  // Letzter Fallback: Verwende chunkIndex wenn vorhanden
  if (source.chunkIndex !== undefined) {
    return `Textabschnitt ${source.chunkIndex + 1}`
  }
  return 'Unbekannte Quelle'
}

export function buildContext(sources: RetrievedSource[], perSnippetLimit = 800): string {
  return sources
    .map((s, i) => {
      const description = getSourceDescription(s)
      
      // Formatierte Metadaten für den Prompt (basierend auf Facetten-Definitionen)
      const metadataParts: string[] = []
      if (s.metadata && typeof s.metadata === 'object') {
        for (const [key, value] of Object.entries(s.metadata)) {
          if (value === undefined || value === null) continue
          
          // Formatierung basierend auf Werttyp
          if (Array.isArray(value)) {
            if (value.length > 0) {
              // Array-Werte: Komma-separiert
              const arrayStr = value.map(v => String(v)).join(', ')
              metadataParts.push(`${key}: ${arrayStr}`)
            }
          } else if (typeof value === 'string' || typeof value === 'number') {
            metadataParts.push(`${key}: ${String(value)}`)
          } else if (typeof value === 'boolean') {
            metadataParts.push(`${key}: ${value ? 'true' : 'false'}`)
          }
        }
      }
      
      const metadataLine = metadataParts.length > 0 ? ` | ${metadataParts.join(' | ')}` : ''
      
      return `Quelle [${i + 1}] ${s.fileName ?? s.id} (${description}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}${metadataLine}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`
    })
    .join('\n\n')
}

export function styleInstruction(answerLength: 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'): string {
  return answerLength === 'ausführlich' || answerLength === 'unbegrenzt'
    ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter) im Markdown-Format: Verwende Überschriften (##), Listen (-), **Fettdruck** für wichtige Begriffe, und Absätze für bessere Lesbarkeit. Beginne mit 1–2 Sätzen Zusammenfassung, danach Details in Absätzen oder Stichpunkten. Vermeide Füllwörter.'
    : answerLength === 'mittel'
    ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter) im Markdown-Format: Verwende Listen (-), **Fettdruck** für wichtige Begriffe, und Absätze. 3–6 Sätze oder eine kurze Liste der wichtigsten Punkte. Direkt und präzise.'
    : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter) im Markdown-Format: Verwende **Fettdruck** für wichtige Begriffe wenn nötig. Keine Einleitung, direkt die Kernaussage.'
}

/**
 * Erstellt Charakter/Perspektive-Anweisung basierend auf Konfiguration.
 * Verwendet den zentralen Character-Typ aus types/character.ts.
 */
function getCharacterInstruction(character: Character): string {
  const instructions: Record<Character, string> = {
    // Knowledge & Innovation
    'developer': 'Du antwortest aus einer Entwickler-Perspektive. Fokus auf Code-Qualität, Best Practices, Technologie-Stacks, Performance, Skalierbarkeit und praktische Implementierung.',
    'technical': 'Du antwortest aus einer technischen Perspektive. Fokus auf technische Details, Architektur, Systemdesign, Engineering-Prinzipien und praktische Lösungsansätze.',
    'open-source': 'Du antwortest aus einer Open-Source-Perspektive. Fokus auf Community, Transparenz, Kollaboration, Lizenzmodelle und offene Standards.',
    'scientific': 'Du antwortest aus einer naturwissenschaftlichen Perspektive. Fokus auf Evidenz, Methodik, Reproduzierbarkeit und wissenschaftliche Genauigkeit.',
    
    // Society & Impact
    'eco-social': 'Du antwortest aus einer ökosozialen Perspektive. Fokus auf Nachhaltigkeit, soziale Gerechtigkeit, Umweltschutz und langfristige gesellschaftliche Auswirkungen.',
    'social': 'Du antwortest aus einer sozialen Perspektive. Fokus auf Gemeinschaft, Kooperation, Inklusion und gesellschaftliche Aspekte.',
    'civic': 'Du antwortest aus einer bürgerschaftlichen Perspektive. Fokus auf Bürgerbeteiligung, Demokratie, Gemeinwohl und zivilgesellschaftliches Engagement.',
    'policy': 'Du antwortest aus einer politikwissenschaftlichen Perspektive. Fokus auf Policy-Analyse, Regulierungen, Governance-Strukturen und gesellschaftspolitische Auswirkungen.',
    'cultural': 'Du antwortest aus einer kulturellen Perspektive. Fokus auf kulturelle Werte, Traditionen, gesellschaftliche Normen und kulturelle Vielfalt.',
    
    // Economy & Practice
    'business': 'Du antwortest aus einer geschäftlichen, unternehmerischen Perspektive. Fokus auf Effizienz, ROI, Marktchancen, Wettbewerbsvorteile und praktische Umsetzbarkeit.',
    'entrepreneurial': 'Du antwortest aus einer unternehmerischen Perspektive. Fokus auf Innovation, Risikobereitschaft, Geschäftsmodelle, Wachstumsstrategien und Markterfolg.',
    'legal': 'Du antwortest aus einer rechtskundlichen Perspektive. Fokus auf rechtliche Aspekte, Compliance, Lizenzen, Datenschutz und rechtliche Risiken.',
    'educational': 'Du antwortest aus einer bildungswissenschaftlichen Perspektive. Fokus auf Lernprozesse, Pädagogik, Wissensvermittlung und didaktische Ansätze.',
    'creative': 'Du antwortest aus einer kreativen Perspektive. Fokus auf Innovation, Design-Thinking, künstlerische Ansätze und kreative Problemlösung.',
  }
  return instructions[character] || instructions.developer
}

/**
 * Erstellt Sprachkontext-Anweisung basierend auf Konfiguration
 */
function getSocialContextInstruction(socialContext: 'scientific' | 'popular' | 'youth' | 'senior'): string {
  const instructions: Record<string, string> = {
    'scientific': 'Verwende eine wissenschaftliche Sprache mit Fachbegriffen. Erkläre komplexe Konzepte präzise und technisch korrekt.',
    'popular': 'Verwende eine populärwissenschaftliche Sprache. Erkläre komplexe Konzepte verständlich für ein breites Publikum.',
    'youth': 'Verwende eine jugendgerechte Sprache. Erkläre komplexe Konzepte lebendig und verständlich, vermeide zu formelle Formulierungen.',
    'senior': 'Verwende eine seniorengerechte Sprache. Erkläre komplexe Konzepte klar und ausführlich, mit angemessenem Tempo und ohne zu viele Abkürzungen.',
  }
  return instructions[socialContext] || instructions.popular
}

/**
 * Erstellt Sprach-Anweisung basierend auf Konfiguration
 */
function getLanguageInstruction(targetLanguage: 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar'): string {
  const languageNames: Record<string, string> = {
    'de': 'Deutsch',
    'en': 'Englisch',
    'it': 'Italienisch',
    'fr': 'Französisch',
    'es': 'Spanisch',
    'ar': 'Arabisch',
  }
  return `Antworte auf ${languageNames[targetLanguage] || 'Deutsch'}.`
}

/**
 * Formatiert Chatverlauf für den LLM-Prompt
 */
function formatChatHistory(history: Array<{ question: string; answer: string }>): string {
  if (!history || history.length === 0) return ''
  
  return history.map((item, index) => {
    return `Vorherige Frage ${index + 1}:
${item.question}

Antwort:
${item.answer}`
  }).join('\n\n---\n\n')
}

export function buildPrompt(
  question: string, 
  sources: RetrievedSource[], 
  answerLength: 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt',
  options?: {
    targetLanguage?: 'de' | 'en' | 'it' | 'fr' | 'es' | 'ar'
    character?: Character
    socialContext?: 'scientific' | 'popular' | 'youth' | 'senior'
    chatHistory?: Array<{ question: string; answer: string }>
  }
): string {
  const context = buildContext(sources)
  const style = styleInstruction(answerLength)
  
  // Erstelle Mapping von Quelle-Nummer zu Beschreibung für bessere Klarheit
  const sourceDescriptions = sources.map((s, i) => {
    const desc = getSourceDescription(s)
    return `[${i + 1}] = ${desc}`
  }).join(', ')
  
  // Erstelle System-Prompt-Komponenten basierend auf Konfiguration
  const characterInstruction = options?.character ? getCharacterInstruction(options.character) : ''
  const socialContextInstruction = options?.socialContext ? getSocialContextInstruction(options.socialContext) : ''
  const languageInstruction = options?.targetLanguage ? getLanguageInstruction(options.targetLanguage) : 'Antworte auf Deutsch.'
  
  // Formatiere Chatverlauf, falls vorhanden
  const chatHistoryText = options?.chatHistory && options.chatHistory.length > 0
    ? formatChatHistory(options.chatHistory)
    : ''
  
  // System-Prompt zusammenbauen
  const systemParts: string[] = ['Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.']
  if (characterInstruction) {
    systemParts.push(`\n${characterInstruction}`)
  }
  if (socialContextInstruction) {
    systemParts.push(`\n${socialContextInstruction}`)
  }
  
  // Chatverlauf vor der aktuellen Frage einfügen, falls vorhanden
  const chatHistorySection = chatHistoryText 
    ? `\n\nBisheriger Gesprächsverlauf:\n${chatHistoryText}\n\n---\n\n`
    : ''
  
  return `${systemParts.join('')}

${chatHistorySection}Frage:
${question}

Quellen:
${context}

Anforderungen:
- ${style}
- Fachlich korrekt, ohne Spekulationen.
- Antworte **immer im Markdown-Format** mit übersichtlicher Formatierung (Überschriften, Listen, Fettdruck).
- Zitiere am Ende die Referenznummern der verwendeten Quellen als [n] .
- WICHTIG: Verwende nur die Nummern, NICHT "Chunk X".
- Beispiel: "[1] [2] [5]".
- Verfügbare Beschreibungen: ${sourceDescriptions}
${chatHistoryText ? '\n- Berücksichtige den bisherigen Gesprächsverlauf und baue darauf auf, wenn relevant.' : ''}

Ausgabe-Format:
Antworte IMMER als JSON-Objekt mit genau diesen drei Feldern:
- "answer": Markdown-formatierter Text mit Referenz-Nummern [1], [2], etc.
- "suggestedQuestions": Array mit genau 7 sinnvollen Folgefragen basierend auf dem behandelten Kontext
- "usedReferences": Array von Zahlen, die die Referenznummern aller Quellen enthält, die du tatsächlich in deiner Antwort verwendet hast (z.B. [2, 4, 6, 7, 9, 17])

Beispiel:
{
  "answer": "## Einleitung\\n\\nDie Themen werden behandelt...\\n\\n[1] [2]",
  "suggestedQuestions": [
    "Wie funktioniert X?",
    "Was sind die Voraussetzungen für Y?",
    ...
  ],
  "usedReferences": [1, 2]
}

WICHTIG: 
- Referenzen werden serverseitig hinzugefügt, generiere sie nicht im JSON.
- Das Feld "usedReferences" muss alle Nummern enthalten, die du in deiner Antwort als [n] zitierst.

${languageInstruction}`
}


