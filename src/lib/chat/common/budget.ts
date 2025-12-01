import type { AnswerLength } from '../constants'

export function getBaseBudget(answerLength: AnswerLength): number {
  if (answerLength === 'unbegrenzt') return Number.MAX_SAFE_INTEGER
  return answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
}

export function reduceBudgets(answerLength: AnswerLength): number[] {
  if (answerLength === 'unbegrenzt') {
    // Für unbegrenzt: Verwende Token-Limit falls verfügbar, sonst große Fallback-Werte
    const tokenBudget = getTokenBudget()
    if (tokenBudget) {
      // Konvertiere Token zu Zeichen (~4 Zeichen pro Token)
      const charBudget = tokenBudget * 4
      // Reduziere schrittweise: 80%, 60%, 50%, 40%, 30%, 20%
      return [
        Math.floor(charBudget * 0.8),
        Math.floor(charBudget * 0.6),
        Math.floor(charBudget * 0.5),
        Math.floor(charBudget * 0.4),
        Math.floor(charBudget * 0.3),
        Math.floor(charBudget * 0.2),
      ]
    }
    return [200000, 150000, 120000, 90000, 60000, 30000]
  }
  return answerLength === 'ausführlich' ? [120000, 90000, 60000, 30000] : answerLength === 'mittel' ? [60000, 30000] : [20000]
}

export function canAccumulate(current: number, add: number, budget: number): boolean {
  return current + add <= budget
}

// Tokenbasierte Budgetierung (heuristisch)
export function getTokenBudget(): number | undefined {
  const v = process.env.CHAT_MAX_INPUT_TOKENS
  const n = v ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : undefined
}

// Sehr grobe Heuristik: ~4 Zeichen ≈ 1 Token (konservativ)
export function estimateTokensFromText(text: string): number {
  if (!text) return 0
  const len = text.length
  return Math.ceil(len / 4)
}

export function canAccumulateTokens(current: number, add: number, budget: number): boolean {
  return current + add <= budget
}


