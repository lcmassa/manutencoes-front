// Utilitários seguros para parsing de datas

import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'

dayjs.extend(customParseFormat)

/**
 * Parse seguro de datas com dayjs (strict parsing)
 * Tenta formatos em ordem de prioridade
 */
export function parseDateSafe(
  value?: string,
  formats: string[] = ['DD/MM/YYYY', 'DD/MM/YY', 'YYYY-MM-DD', 'MM/DD/YYYY']
): { date: Date | null; ok: boolean; format: string | null } {
  if (!value) {
    return { date: null, ok: false, format: null }
  }
  
  const txt = value.trim()
  
  // Ordem intencional: formatos mais prováveis do relatório PT-BR primeiro
  for (const fmt of formats) {
    const d = dayjs(txt, fmt, true) // strict parsing
    if (d.isValid()) {
      return { date: d.toDate(), ok: true, format: fmt }
    }
  }
  
  return { date: null, ok: false, format: null }
}

/**
 * Calcula dias de atraso entre duas datas
 */
export function calcularDiasAtraso(dataVencimento: Date, dataReferencia: Date = new Date()): number {
  if (!dataVencimento || !(dataVencimento instanceof Date) || isNaN(dataVencimento.getTime())) {
    return 0
  }
  
  if (!dataReferencia || !(dataReferencia instanceof Date) || isNaN(dataReferencia.getTime())) {
    dataReferencia = new Date()
  }
  
  // Zerar horas para comparar apenas datas
  const venc = dayjs(dataVencimento).startOf('day')
  const ref = dayjs(dataReferencia).startOf('day')
  
  const diffDays = ref.diff(venc, 'day')
  
  return Math.max(0, diffDays) // Não retornar negativo
}
