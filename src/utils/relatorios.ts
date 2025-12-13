// relatorios.ts - Utilitários para gerar relatórios usando a API de Condomínios
import api from '../lib/api'
import { logger } from './logger'

/**
 * Tipos de relatórios disponíveis na API
 */
export type TipoRelatorio = 
  | 'W011A' // Demonstrativo de receitas e despesas anual
  | 'W025A' // Previsão orçamentária mensal
  | 'W046A' // Previsão orçamentária
  | 'INADIMPLENCIA' // Relatório de inadimplência (código a ser verificado)

/**
 * Opções para gerar relatório de inadimplência
 */
export interface OpcoesRelatorioInadimplencia {
  idCondominio: string
  posicaoEm?: string // Data de referência (DD/MM/YYYY)
  comValoresAtualizados?: boolean
  apenasResumoInad?: boolean
  cobrancaDoTipo?: 'normal' | 'INADIMPLENTE' | 'ACORDO' | 'EXTRA'
  semAcordo?: boolean
  semProcesso?: boolean
  idUnidade?: string
  render?: 'pdf' | 'html' | 'json'
  getId?: boolean // Se true, retorna apenas o ID da impressão na fila
}

/**
 * Gerar relatório de inadimplência usando a API
 * 
 * Baseado no padrão dos relatórios W025A e W046A:
 * - Usa endpoint /relatorios/id/XXX onde XXX é o código do relatório
 * - Para inadimplência, o código pode variar (ex: WXXX, INAD, etc)
 * 
 * Se não houver código específico, usa o endpoint de inadimplência com render=pdf
 */
export async function gerarRelatorioInadimplencia(
  token: string,
  opcoes: OpcoesRelatorioInadimplencia
): Promise<{ idImpressao?: string; url?: string; data?: any }> {
  try {
    api.setToken(token)
    
    const {
      idCondominio,
      posicaoEm,
      comValoresAtualizados = false,
      apenasResumoInad = false,
      cobrancaDoTipo = 'normal',
      semAcordo = true,
      semProcesso = false,
      idUnidade = '',
      render = 'pdf',
      getId = true
    } = opcoes

    // Data padrão: hoje
    const dataReferencia = posicaoEm || new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })

    logger.info('[Relatorios] Gerando relatório de inadimplência...', {
      idCondominio,
      dataReferencia,
      render,
      getId
    })

    // Tentar primeiro com endpoint de relatórios (se houver código específico)
    // Códigos comuns de relatórios de inadimplência: WXXX, INAD, etc
    // Como não temos certeza do código, vamos tentar o endpoint de inadimplência com render
    
    const params = new URLSearchParams({
      idCondominio: idCondominio,
      posicaoEm: dataReferencia,
      comValoresAtualizados: comValoresAtualizados ? '1' : '0',
      apenasResumoInad: apenasResumoInad ? '1' : '0',
      cobrancaDoTipo: cobrancaDoTipo,
      semAcordo: semAcordo ? '1' : '0',
      semProcesso: semProcesso ? '1' : '0',
      id: idUnidade
    })

    if (render === 'pdf' || render === 'html') {
      params.append('render', render)
    }
    
    if (getId) {
      params.append('getId', '1')
    }

    // Endpoint baseado no padrão de relatórios
    // Se a API tiver um código específico para inadimplência, usar: /relatorios/id/XXX
    // Caso contrário, usar o endpoint de inadimplência com render
    const url = `/api/condominios/superlogica/inadimplencia/index?${params.toString()}`
    
    logger.info(`[Relatorios] URL: ${url.substring(0, 200)}...`)

    const response = await api.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      }
    })

    const data = response.data

    // Se getId=true, a resposta deve conter o ID da impressão na fila
    if (getId && data?.id_impressao_fimp) {
      logger.info(`[Relatorios] ✅ Relatório gerado na fila. ID: ${data.id_impressao_fimp}`)
      return {
        idImpressao: String(data.id_impressao_fimp),
        data
      }
    }

    // Se render=pdf, pode retornar URL ou dados binários
    if (render === 'pdf' && data?.url) {
      logger.info(`[Relatorios] ✅ PDF gerado. URL: ${data.url}`)
      return {
        url: data.url,
        data
      }
    }

    // Retornar dados brutos
    logger.info('[Relatorios] ✅ Relatório gerado com sucesso')
    return { data }

  } catch (error: any) {
    logger.error('[Relatorios] Erro ao gerar relatório de inadimplência:', error)
    throw error
  }
}

/**
 * Gerar relatório usando código específico (ex: W025A, W046A)
 * 
 * Baseado nos exemplos do Postman:
 * - W025A: Previsão orçamentária mensal
 * - W046A: Previsão orçamentária
 */
export async function gerarRelatorioPorCodigo(
  token: string,
  codigoRelatorio: TipoRelatorio,
  idCondominio: string,
  parametrosAdicionais: Record<string, string | number> = {},
  render: 'pdf' | 'html' | 'json' = 'pdf',
  getId: boolean = true
): Promise<{ idImpressao?: string; url?: string; data?: any }> {
  try {
    api.setToken(token)

    const params = new URLSearchParams({
      ID_CONDOMINIO_COND: idCondominio,
      ...Object.fromEntries(
        Object.entries(parametrosAdicionais).map(([k, v]) => [k, String(v)])
      )
    })

    if (render === 'pdf' || render === 'html') {
      params.append('render', render)
    }
    
    if (getId) {
      params.append('getId', '1')
    }

    const url = `/api/condominios/superlogica/relatorios/id/${codigoRelatorio}?${params.toString()}`
    
    logger.info(`[Relatorios] Gerando relatório ${codigoRelatorio}...`)
    logger.info(`[Relatorios] URL: ${url.substring(0, 200)}...`)

    const response = await api.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      }
    })

    const data = response.data

    if (getId && data?.id_impressao_fimp) {
      logger.info(`[Relatorios] ✅ Relatório ${codigoRelatorio} gerado na fila. ID: ${data.id_impressao_fimp}`)
      return {
        idImpressao: String(data.id_impressao_fimp),
        data
      }
    }

    if (render === 'pdf' && data?.url) {
      logger.info(`[Relatorios] ✅ PDF gerado. URL: ${data.url}`)
      return {
        url: data.url,
        data
      }
    }

    logger.info(`[Relatorios] ✅ Relatório ${codigoRelatorio} gerado com sucesso`)
    return { data }

  } catch (error: any) {
    logger.error(`[Relatorios] Erro ao gerar relatório ${codigoRelatorio}:`, error)
    throw error
  }
}

/**
 * Obter status de uma impressão na fila
 * 
 * Baseado no exemplo "Fila de Impressão" do Postman
 */
export async function obterStatusImpressao(
  token: string,
  idImpressao: string,
  compartilhar: boolean = true
): Promise<any> {
  try {
    api.setToken(token)

    const params = new URLSearchParams({
      ID_IMPRESSAO_FIMP: idImpressao,
      FL_COMPARTILHAR: compartilhar ? '1' : '0'
    })

    const url = `/api/condominios/superlogica/impressoes/post?${params.toString()}`
    
    logger.info(`[Relatorios] Verificando status da impressão ${idImpressao}...`)

    const response = await api.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      }
    })

    logger.info(`[Relatorios] ✅ Status da impressão obtido`)
    return response.data

  } catch (error: any) {
    logger.error(`[Relatorios] Erro ao obter status da impressão:`, error)
    throw error
  }
}

/**
 * Gerar relatório de balanço (Demonstrativo de receitas e despesas)
 * 
 * Baseado no exemplo W011A do Postman
 */
export async function gerarRelatorioBalanco(
  token: string,
  idCondominio: string,
  dtInicio: string, // DD/MM/YYYY
  dtFim: string, // DD/MM/YYYY
  agrupadoPorMes: boolean = true
): Promise<any> {
  try {
    api.setToken(token)

    const params = new URLSearchParams({
      idCondominio: idCondominio,
      dtInicio: dtInicio,
      dtFim: dtFim,
      agrupadoPorMes: agrupadoPorMes ? '1' : '0'
    })

    const url = `/api/condominios/superlogica/balancetes/index?${params.toString()}`
    
    logger.info(`[Relatorios] Gerando relatório de balanço...`)
    logger.info(`[Relatorios] Período: ${dtInicio} a ${dtFim}`)

    const response = await api.get<any>(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      }
    })

    logger.info(`[Relatorios] ✅ Relatório de balanço gerado`)
    return response.data

  } catch (error: any) {
    logger.error(`[Relatorios] Erro ao gerar relatório de balanço:`, error)
    throw error
  }
}

