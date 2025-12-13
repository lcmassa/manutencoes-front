// Utilitários seguros para parsing de dados

import Decimal from 'decimal.js'

/**
 * Parse seguro de valores monetários usando Decimal.js
 * Suporta formatos brasileiros (R$ 1.234,56) e internacionais
 */
export function parseCurrencySafe(text?: string | number): { value: number; ok: boolean; raw: string } {
  const raw = String(text ?? '').trim()
  
  if (!raw) {
    return { value: 0, ok: false, raw }
  }
  
  // Se já for número, retornar diretamente
  if (typeof text === 'number' && isFinite(text)) {
    return { value: text, ok: text > 0, raw: String(text) }
  }
  
  // Remove tudo que não seja dígito, vírgula, ponto ou sinal de menos
  const cleaned = raw.replace(/[^\d,\.\-]/g, '').trim()
  
  if (!cleaned) {
    return { value: 0, ok: false, raw }
  }
  
  let normalized = cleaned
  
  // Se há "." e ",", assumir '.'=thousands, ','=decimals (pt-BR)
  if (cleaned.includes('.') && cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // '1234,56' => '1234.56'
    normalized = cleaned.replace(',', '.')
  }
  // else assume dot is decimal
  
  try {
    const dec = new Decimal(normalized)
    const value = dec.toNumber()
    
    // Threshold mínimo para considerar valor significativo
    if (!isFinite(value) || Math.abs(value) < 0.0001) {
      return { value, ok: false, raw }
    }
    
    return { value, ok: true, raw }
  } catch {
    return { value: 0, ok: false, raw }
  }
}

/**
 * Parse seguro de números inteiros
 */
export function parseIntSafe(text?: string | number): { value: number; ok: boolean } {
  if (typeof text === 'number' && isFinite(text)) {
    return { value: Math.floor(text), ok: true }
  }
  
  if (!text) {
    return { value: 0, ok: false }
  }
  
  const cleaned = String(text).replace(/[^\d\-]/g, '')
  const n = parseInt(cleaned || '0', 10)
  
  return { value: isNaN(n) ? 0 : n, ok: !isNaN(n) && cleaned.length > 0 }
}
