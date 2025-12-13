// Sistema de score de confiança para validação de inadimplências

import { UnidadeInadimplente } from '../pages/Inadimplencia'

export interface ConfidenceScore {
  score: number // 0.0 a 1.0
  reasons: string[]
  warnings: string[]
}

const MIN_CONFIDENCE_THRESHOLD = 0.8 // Score mínimo para aceitar automaticamente
const REVIEW_THRESHOLD = 0.7 // Score mínimo para revisão humana

/**
 * Calcula score de confiança para uma unidade inadimplente (versão original)
 */
export function computeConfidence(unidade: Partial<UnidadeInadimplente> & { raw?: any }): ConfidenceScore {
  let score = 0
  const reasons: string[] = []
  const warnings: string[] = []
  
  // ID do condomínio presente (0.25)
  if (unidade.idCondominio && unidade.idCondominio !== 'sem-id' && unidade.idCondominio !== '') {
    score += 0.25
    reasons.push('ID do condomínio válido')
  } else {
    warnings.push('ID do condomínio ausente ou inválido')
  }
  
  // Nome da unidade presente (0.20)
  if (unidade.unidade && unidade.unidade.trim() !== '') {
    score += 0.20
    reasons.push('Unidade identificada')
  } else {
    warnings.push('Nome da unidade ausente')
  }
  
  // Saldo válido e maior que zero (0.25)
  if (unidade.saldo !== undefined && unidade.saldo > 0) {
    score += 0.25
    reasons.push(`Saldo devedor: R$ ${unidade.saldo.toFixed(2)}`)
  } else {
    warnings.push('Saldo inválido ou zero')
  }
  
  // Dias de atraso válido e maior que zero (0.15)
  if (unidade.diasAtraso !== undefined && unidade.diasAtraso > 0) {
    score += 0.15
    reasons.push(`${unidade.diasAtraso} dias em atraso`)
  } else {
    warnings.push('Dias de atraso inválido ou zero')
  }
  
  // Quantidade de cobranças (0.10)
  if (unidade.quantidadeCobrancas !== undefined && unidade.quantidadeCobrancas > 0) {
    score += 0.10
    reasons.push(`${unidade.quantidadeCobrancas} cobrança(s)`)
  }
  
  // Informações adicionais (0.05)
  if (unidade.proprietario && unidade.proprietario.trim() !== '') {
    score += 0.05
  }
  
  // Penalidades por evidências de pagamento
  if (unidade.raw) {
    const raw = unidade.raw
    // Se há data de liquidação, reduzir score drasticamente
    if (raw.dt_liquidacao_recb || raw.dataLiquidacao) {
      score = 0 // Força não-inadimplente
      warnings.push('Evidência de pagamento detectada (data de liquidação)')
    }
    
    // Se status indica liquidado/cancelado
    const status = raw.fl_status_recb || raw.status || 0
    if (status === 1 || status === 3) {
      score = 0
      warnings.push(`Status indica ${status === 1 ? 'cancelado' : 'liquidado'}`)
    }
  }
  
  // Garantir que score está entre 0 e 1
  score = Math.max(0, Math.min(1, score))
  
  return {
    score,
    reasons,
    warnings
  }
}

/**
 * Calcula score de confiança simples e auditável (nova versão)
 */
export function computeConfidenceForParsedUnit(unit: {
  idCondominio?: string
  unidade?: string
  saldo?: number
  diasAtraso?: number
  proprietario?: string
  rawEvidence?: any
}): number {
  let score = 0
  
  if (unit.idCondominio && unit.idCondominio !== '') score += 0.30
  if (unit.unidade && unit.unidade !== '') score += 0.25
  if (typeof unit.saldo === 'number' && unit.saldo > 0.5) score += 0.25 // threshold configurável
  if (typeof unit.diasAtraso === 'number' && unit.diasAtraso > 0) score += 0.10
  if (unit.proprietario) score += 0.05
  
  return Math.min(1, score)
}

/**
 * Verifica se a unidade deve ser aceita automaticamente
 */
export function shouldAcceptAutomatically(confidence: ConfidenceScore): boolean {
  return confidence.score >= MIN_CONFIDENCE_THRESHOLD
}

/**
 * Verifica se a unidade requer revisão humana
 */
export function requiresHumanReview(confidence: ConfidenceScore): boolean {
  return confidence.score >= REVIEW_THRESHOLD && confidence.score < MIN_CONFIDENCE_THRESHOLD
}

/**
 * Verifica se a unidade deve ser rejeitada automaticamente
 */
export function shouldRejectAutomatically(confidence: ConfidenceScore): boolean {
  return confidence.score < REVIEW_THRESHOLD || confidence.score === 0
}
