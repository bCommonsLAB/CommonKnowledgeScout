import type { AnswerLength } from '../constants'

export function getBaseBudget(answerLength: AnswerLength): number {
  if (answerLength === 'unbegrenzt') return Number.MAX_SAFE_INTEGER
  return answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
}

export function reduceBudgets(answerLength: AnswerLength): number[] {
  if (answerLength === 'unbegrenzt') return [200000, 150000, 120000, 90000, 60000, 30000]
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


