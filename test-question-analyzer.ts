import { analyzeQuestionForRetriever } from '@/lib/chat/common/question-analyzer'

/**
 * Test-Script für manuelle Tests der Frage-Analyse
 * 
 * Verwendung:
 * 1. In der Konsole: npx tsx test-question-analyzer.ts
 * 2. Oder in einem Test-File importieren
 */

async function testAnalyzer() {
  const testQuestions = [
    // Sollte 'chunk' empfehlen
    'Wie funktioniert die Funktion calculateScore()?',
    'Was ist die Formel für die Berechnung?',
    'Wie wird der Fehler in Zeile 42 behoben?',
    
    // Sollte 'summary' empfehlen
    'Was sind die Hauptthemen aller Dokumente?',
    'Welche Konzepte werden in den Sessions behandelt?',
    'Gib mir einen Überblick über die Dokumente.',
    
    // Sollte 'unclear' zurückgeben
    'Was gibt es?',
    'Erzähl mir etwas',
    'Hallo',
  ]

  console.log('=== Frage-Analyse Tests ===\n')

  for (const question of testQuestions) {
    try {
      console.log(`Frage: "${question}"`)
      const result = await analyzeQuestionForRetriever(question)
      console.log(`  → Recommendation: ${result.recommendation}`)
      console.log(`  → Confidence: ${result.confidence}`)
      console.log(`  → Explanation: ${result.explanation.substring(0, 100)}...`)
      if (result.recommendation === 'unclear') {
        console.log(`  → Suggested Chunk: ${result.suggestedQuestionChunk}`)
        console.log(`  → Suggested Summary: ${result.suggestedQuestionSummary}`)
      }
      console.log(`  → Reasoning: ${result.reasoning.substring(0, 100)}...`)
      console.log('')
    } catch (error) {
      console.error(`  ❌ Fehler: ${error instanceof Error ? error.message : String(error)}`)
      console.log('')
    }
  }
}

// Nur ausführen, wenn direkt aufgerufen
if (require.main === module) {
  testAnalyzer().catch(console.error)
}

export { testAnalyzer }








