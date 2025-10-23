export function getBaseBudget(answerLength: 'kurz' | 'mittel' | 'ausführlich'): number {
  return answerLength === 'ausführlich' ? 180000 : answerLength === 'mittel' ? 90000 : 30000
}

export function reduceBudgets(answerLength: 'kurz' | 'mittel' | 'ausführlich'): number[] {
  return answerLength === 'ausführlich' ? [120000, 90000, 60000, 30000] : answerLength === 'mittel' ? [60000, 30000] : [20000]
}

export function canAccumulate(current: number, add: number, budget: number): boolean {
  return current + add <= budget
}


