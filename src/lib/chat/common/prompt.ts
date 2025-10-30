import type { RetrievedSource } from '@/types/retriever'

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
      return `Quelle [${i + 1}] ${s.fileName ?? s.id} (${description}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`
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

export function buildPrompt(question: string, sources: RetrievedSource[], answerLength: 'kurz' | 'mittel' | 'ausführlich' | 'unbegrenzt'): string {
  const context = buildContext(sources)
  const style = styleInstruction(answerLength)
  
  // Erstelle Mapping von Quelle-Nummer zu Beschreibung für bessere Klarheit
  const sourceDescriptions = sources.map((s, i) => {
    const desc = getSourceDescription(s)
    return `[${i + 1}] = ${desc}`
  }).join(', ')
  
  return `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.

Frage:
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

Antworte auf Deutsch.`
}


