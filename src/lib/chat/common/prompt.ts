import type { RetrievedSource } from '@/types/retriever'

export function buildContext(sources: RetrievedSource[], perSnippetLimit = 800): string {
  return sources
    .map((s, i) => `Quelle [${i + 1}] ${s.fileName ?? s.id} (Chunk ${s.chunkIndex ?? '-'}, Score ${typeof s.score === 'number' ? s.score.toFixed(3) : 'n/a'}):\n${(s.text ?? '').slice(0, perSnippetLimit)}`)
    .join('\n\n')
}

export function styleInstruction(answerLength: 'kurz' | 'mittel' | 'ausführlich'): string {
  return answerLength === 'ausführlich'
    ? 'Schreibe eine strukturierte, ausführliche Antwort (ca. 250–600 Wörter): Beginne mit 1–2 Sätzen Zusammenfassung, danach Details in Absätzen oder Stichpunkten. Vermeide Füllwörter.'
    : answerLength === 'mittel'
    ? 'Schreibe eine mittellange Antwort (ca. 120–250 Wörter): 3–6 Sätze oder eine kurze Liste der wichtigsten Punkte. Direkt und präzise.'
    : 'Schreibe eine knappe Antwort (1–3 Sätze, max. 120 Wörter). Keine Einleitung, direkt die Kernaussage.'
}

export function buildPrompt(question: string, sources: RetrievedSource[], answerLength: 'kurz' | 'mittel' | 'ausführlich'): string {
  const context = buildContext(sources)
  const style = styleInstruction(answerLength)
  return `Du bist ein präziser Assistent. Beantworte die Frage ausschließlich auf Basis der bereitgestellten Quellen.\n\nFrage:\n${question}\n\nQuellen:\n${context}\n\nAnforderungen:\n- ${style}\n- Fachlich korrekt, ohne Spekulationen.\n- Zitiere am Ende die verwendeten Quellen als [n] (Dateiname, Chunk).\n- Antworte auf Deutsch.`
}


