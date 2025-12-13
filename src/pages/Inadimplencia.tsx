// Inadimplencia.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { RefreshCw, AlertCircle, Building2, Home, DollarSign, Loader2, FileText } from 'lucide-react'
import { gerarRelatorioInadimplencia } from '../utils/relatorios'
import Decimal from 'decimal.js'
import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { logger } from '../utils/logger'
dayjs.extend(customParseFormat)

// ---------- Tipagens ----------
interface Condominio {
  id: string
  nome: string
  nomeFantasia: string
  idCondominio: string
}

interface UnidadeInadimplente {
  idCondominio: string
  condominioNome: string
  unidade: string
  proprietario: string
  inquilino: string
  situacao: string
  processo: string
  diasAtraso: number
  quantidadeCobrancas: number
  saldo: number
  confidence?: number
}

interface ResumoCondominio {
  idCondominio: string
  condominioNome: string
  unidades: UnidadeInadimplente[]
  totalUnidades: number
  totalCobrancas: number
  totalSaldo: number
}

// ---------- Helpers robustos ----------
function parseCurrencySafe(text?: string) {
  const raw = String(text ?? '').trim()
  if (!raw) return { value: 0, ok: false, raw }
  const cleaned = raw.replace(/[^\d,\.\-]/g, '').trim()
  let normalized = cleaned
  if (cleaned.includes('.') && cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    normalized = cleaned.replace(',', '.')
  }
  try {
    const dec = new Decimal(normalized)
    const value = dec.toNumber()
    if (!isFinite(value) || Math.abs(value) < 0.0001) return { value, ok: false, raw }
    return { value, ok: true, raw }
  } catch {
    return { value: 0, ok: false, raw }
  }
}

function parseIntSafe(text?: string) {
  if (!text) return { value: 0, ok: false }
  const cleaned = String(text).replace(/[^\d\-]/g, '')
  const n = parseInt(cleaned || '0', 10)
  return { value: isNaN(n) ? 0 : n, ok: !isNaN(n) && cleaned.length > 0 }
}

function parseDateSafe(value?: string) {
  if (!value) return { date: null, ok: false, format: null }
  const txt = value.trim()
  const formats = ['DD/MM/YYYY', 'DD/MM/YY', 'YYYY-MM-DD', 'MM/DD/YYYY']
  for (const fmt of formats) {
    const d = dayjs(txt, fmt, true)
    if (d.isValid()) return { date: d.toDate(), ok: true, format: fmt }
  }
  return { date: null, ok: false, format: null }
}

function computeConfidenceForParsedUnit(unit: Partial<UnidadeInadimplente>) {
  let score = 0
  if (unit.idCondominio && unit.idCondominio !== '') score += 0.30
  if (unit.unidade && unit.unidade !== '') score += 0.25
  if (typeof unit.saldo === 'number' && unit.saldo > 0.5) score += 0.25
  if (typeof unit.diasAtraso === 'number' && unit.diasAtraso > 0) score += 0.10
  if (unit.proprietario) score += 0.05
  return Math.min(1, score)
}

function parseHtmlSafe(html: string) {
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    return parser.parseFromString(html, 'text/html')
  }
  // Ambiente Node.js: retornar null (não suportado sem cheerio)
  // Para uso em Node, instale cheerio e use diretamente
  console.warn('[parseHtmlSafe] Ambiente Node.js detectado, mas cheerio não está disponível. Retornando null.')
  return null
}

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(valor)
}

// Função para parsear valores monetários corretamente
// A API retorna valores em centavos quando são números inteiros
// Exemplo: 166547 (centavos) = 1665.47 (reais)
// IMPORTANTE: Se o valor já vier como string formatada (ex: "1665.47"), não dividir por 100
function parseValorMonetario(valor: any, debug = false): number {
  if (valor === null || valor === undefined || valor === '') {
    if (debug) console.log('[parseValorMonetario] Valor vazio/null/undefined')
    return 0
  }
  
  const valorOriginal = valor
  
  // Se já é número
  if (typeof valor === 'number') {
    // Se o número é inteiro, provavelmente está em centavos
    // A API da Superlógica geralmente retorna valores monetários em centavos como inteiros
    // Exemplo: 166547 (centavos) = 1665.47 (reais), 500 (centavos) = 5.00 (reais)
    if (Number.isInteger(valor)) {
      const resultado = valor / 100
      if (debug) console.log(`[parseValorMonetario] Número inteiro ${valor} -> ${resultado} (dividido por 100)`)
      return resultado
    }
    // Se já tem casas decimais, já está em reais
    if (debug) console.log(`[parseValorMonetario] Número com decimais ${valor} -> ${valor} (mantido)`)
    return valor
  }
  
  // Se é string, fazer parsing normal (formato brasileiro: 1.234,56)
  const str = String(valor).trim()
  if (!str) {
    if (debug) console.log('[parseValorMonetario] String vazia')
    return 0
  }
  
  // Se a string já tem formato de número com ponto decimal (ex: "1665.47"), provavelmente já está em reais
  if (/^\d+\.\d{2}$/.test(str)) {
    const num = parseFloat(str)
    if (debug) console.log(`[parseValorMonetario] String com formato decimal "${str}" -> ${num} (já em reais)`)
    return num
  }
  
  // Remover caracteres não numéricos exceto vírgula e ponto
  const cleaned = str.replace(/[^\d,\.\-]/g, '').trim()
  if (!cleaned) {
    if (debug) console.log(`[parseValorMonetario] String "${str}" limpa ficou vazia`)
    return 0
  }
  
  // Normalizar formato brasileiro (1.234,56) para formato numérico (1234.56)
  let normalized = cleaned
  if (cleaned.includes('.') && cleaned.includes(',')) {
    // Tem ambos: ponto é milhar, vírgula é decimal
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    // Só vírgula: pode ser decimal ou milhar
    // Se tem mais de 3 dígitos antes da vírgula, provavelmente é milhar
    const parts = cleaned.split(',')
    if (parts[0].length > 3) {
      // Provavelmente milhar, remover vírgula
      normalized = cleaned.replace(',', '')
    } else {
      // Provavelmente decimal
      normalized = cleaned.replace(',', '.')
    }
  }
  
  const num = parseFloat(normalized) || 0
  
  // Se o número resultante é inteiro E a string original não tinha ponto decimal, provavelmente está em centavos
  if (Number.isInteger(num) && !str.includes('.')) {
    const resultado = num / 100
    if (debug) console.log(`[parseValorMonetario] String parseada como inteiro "${valorOriginal}" -> ${num} -> ${resultado} (dividido por 100)`)
    return resultado
  }
  
  if (debug) console.log(`[parseValorMonetario] String parseada "${valorOriginal}" -> ${num} (mantido)`)
  return num
}

// ---------- Funções de rede (corrigidas) ----------
async function buscarCondominios(apiInstance: typeof api): Promise<Condominio[]> {
  try {
    const todosCondominios: Condominio[] = []
    let pagina = 1
    let temMais = true

    while (temMais) {
      const url = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${pagina}`
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:200',message:'Request condominios - BEFORE',data:{url,pagina,companyId:localStorage.getItem('x-company-id')||'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const response = await apiInstance.get<any>(url)
      const data = response.data
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:202',message:'Request condominios - AFTER success',data:{status:response.status,isArray:Array.isArray(data),dataKeys:data&&typeof data==='object'?Object.keys(data):[],dataLength:Array.isArray(data)?data.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'D'})}).catch(()=>{});
      // #endregion
      const listCondominios = Array.isArray(data) ? data : data?.data || data?.condominios || []
      if (listCondominios.length === 0) { temMais = false; break }

      listCondominios.forEach((cond: any) => {
        const nomeFantasia = (cond.st_fantasia_cond || cond.nomeFantasia || '').trim()
        const nome = (cond.st_nome_cond || cond.nome || '').trim()
        const nomeFinal = nomeFantasia || nome || ''
        const idCondominio = cond.id_condominio_cond || cond.id || ''
        if (nomeFinal && idCondominio) {
          todosCondominios.push({
            id: idCondominio,
            nome: nomeFinal,
            nomeFantasia: nomeFantasia || nomeFinal,
            idCondominio: idCondominio
          })
          
          // Log para encontrar o ID do condomínio Alecrins
          if (nomeFinal.toLowerCase().includes('alecrins') || nome.toLowerCase().includes('alecrins')) {
            logger.info(`[Inadimplencia] 🔍 Condomínio Alecrins encontrado: ID=${idCondominio}, Nome=${nomeFinal}`)
          }
        }
      })

      if (listCondominios.length < 100) temMais = false
      else pagina++
    }

    const condominiosOrdenados = todosCondominios.sort((a, b) => {
      const nomeA = (a.nomeFantasia || a.nome || '').toLowerCase().trim()
      const nomeB = (b.nomeFantasia || b.nome || '').toLowerCase().trim()
      return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true, ignorePunctuation: true })
    })

    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:236',message:'buscarCondominios - COMPLETED',data:{totalCondominios:condominiosOrdenados.length,condominios:condominiosOrdenados.map(c=>({id:c.idCondominio,nome:c.nome||c.nomeFantasia}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'O'})}).catch(()=>{});
    // #endregion

    return condominiosOrdenados
  } catch (error: any) {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:237',message:'Request condominios - ERROR',data:{status:error?.response?.status,statusText:error?.response?.statusText,message:error?.message,errorData:error?.response?.data?JSON.stringify(error.response.data).substring(0,500):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
    // #endregion
    console.error('[Inadimplencia] Erro ao buscar condomínios:', error?.message || error)
    throw error
  }
}

/**
 * buscarInadimplenciasPorCondominio - nota importante:
 * - posicaoEm precisa ser DD/MM/YYYY (corrigido)
 * - apenasResumoInad=0 para obter dados detalhados (1 retorna apenas resumo)
 * - NÃO usar cobrancaDoTipo: 'INADIMPLENTE' (muitas vezes retorna vazio)
 * - Documentação mostra apenasResumoInad=1, mas isso retorna apenas resumo sem detalhes
 */
async function buscarInadimplenciasPorCondominio(
  apiInstance: typeof api,
  idCondominio: string,
  token: string,
  dataAtualFormatada: string,
  condominios: Condominio[] = [],
  companyId: string | null = null,
  isSingleCondominio: boolean = false // Novo parâmetro para indicar se é busca de um único condomínio
): Promise<UnidadeInadimplente[]> {
  const unidades: UnidadeInadimplente[] = []
  const recebimentosPorUnidade = new Map<string, any[]>()
  let pagina = 1
  let temMais = true
  const itensPorPagina = 1000

  while (temMais) {
    // Definir params e url fora do try para acesso no catch
    // Baseado no curl de exemplo: apenasResumoInad=0 (não 1), cobrancaDoTipo=normal (minúsculo)
    // Validar data antes de usar
    if (!dataAtualFormatada || !/^\d{2}\/\d{2}\/\d{4}$/.test(dataAtualFormatada)) {
      logger.error(`[Inadimplencia] ❌ Data inválida: "${dataAtualFormatada}". Esperado formato: DD/MM/YYYY`)
      throw new Error(`Data inválida: ${dataAtualFormatada}. Formato esperado: DD/MM/YYYY`)
    }
    
    // Validar idCondominio
    if (!idCondominio || idCondominio.trim() === '') {
      logger.error(`[Inadimplencia] ❌ idCondominio vazio ou inválido`)
      throw new Error('ID do condomínio não informado')
    }
    
      // Parâmetros da API
      // IMPORTANTE: apenasResumoInad=0 para obter dados detalhados das unidades
      // Se usar apenasResumoInad=1, retorna apenas resumo sem detalhes das unidades
      // NOTA: Removendo filtros restritivos (semAcordo, semProcesso, cobrancaDoTipo) 
      // para incluir TODAS as inadimplências, conforme o CSV mostra que existem
      const params = new URLSearchParams({
      comValoresAtualizados: '0',
      comValoresAtualizadosPorComposicao: '0', // Conforme documentação
      apenasResumoInad: '0', // 0 = dados detalhados, 1 = apenas resumo (sem detalhes)
      posicaoEm: dataAtualFormatada, // DD/MM/YYYY - data de referência para a posição
      idCondominio: idCondominio.trim(),
      comDadosDaReceita: '1',
      itensPorPagina: String(itensPorPagina),
      pagina: String(pagina)
      // Removidos semAcordo, semProcesso e cobrancaDoTipo para incluir todas as inadimplências
      // O CSV mostra que há unidades com processos e diferentes tipos de cobrança
    })

    const url = `/api/condominios/superlogica/inadimplencia/index?${params.toString()}`
    
    // Log da URL para debug
    if (pagina === 1) {
      logger.info(`[Inadimplencia] 🔍 Buscando inadimplências para condomínio ${idCondominio}:`, {
        url,
        params: Object.fromEntries(params.entries()),
        dataAtualFormatada
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:309',message:'buscarInadimplenciasPorCondominio - FIRST PAGE',data:{idCondominio,url,params:Object.fromEntries(params.entries()),dataAtualFormatada},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'R'})}).catch(()=>{});
      // #endregion
    }
    
    try {
      // Headers conforme documentação: Authorization e x-company-id
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Authorization': `Bearer ${token}`
      }
      
      // Adicionar x-company-id se disponível (conforme documentação)
      if (companyId) {
        headers['x-company-id'] = companyId
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:321',message:'Request report - BEFORE',data:{url,params:Object.fromEntries(params.entries()),headers:Object.keys(headers),hasCompanyId:!!companyId,companyId:companyId||'null',token:token?token.substring(0,20)+'...':'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      const response = await apiInstance.get<any>(url, {
        headers
      })

      const data = response.data
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:325',message:'Request report - AFTER success',data:{status:response.status,isArray:Array.isArray(data),dataKeys:data&&typeof data==='object'?Object.keys(data):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'F'})}).catch(()=>{});
      // #endregion
      
      // Log detalhado da resposta para debug (apenas primeira página)
      if (pagina === 1) {
        const chaves = data && typeof data === 'object' ? Object.keys(data) : []
        const isArray = Array.isArray(data)
        const arrayLength = isArray ? data.length : 0
        
        logger.info(`[Inadimplencia] 📥 Resposta da API para condomínio ${idCondominio} (página ${pagina}):`, {
          tipo: typeof data,
          ehArray: isArray,
          tamanhoArray: arrayLength,
          chaves: chaves,
          temData: chaves.includes('data'),
          temRecebimentos: chaves.includes('recebimentos'),
          temInadimplencias: chaves.includes('inadimplencias'),
          temItens: chaves.includes('itens'),
          temResultado: chaves.includes('resultado'),
          status: data?.status,
          msg: data?.msg,
          estruturaCompleta: JSON.stringify(data).substring(0, 2000)
        })
        
        // Se for array, mostrar primeiro item como exemplo
        if (isArray && arrayLength > 0) {
          logger.info(`[Inadimplencia] 📋 Primeiro item do array:`, {
            chaves: Object.keys(data[0]),
            temRecebimentos: Array.isArray(data[0]?.recebimento) || Array.isArray(data[0]?.recebimentos),
            numRecebimentos: Array.isArray(data[0]?.recebimento) ? data[0].recebimento.length : 
                            Array.isArray(data[0]?.recebimentos) ? data[0].recebimentos.length : 0,
            exemplo: JSON.stringify(data[0]).substring(0, 1000)
          })
        }
      }
      
      // Verificar se a resposta tem apenas metadados sem dados (resposta vazia)
      const chaves = data && typeof data === 'object' ? Object.keys(data) : []
      const temApenasMetadados = chaves.length > 0 && 
        chaves.every(k => ['status', 'session', 'msg', 'executiontime'].includes(k)) &&
        !chaves.includes('data') && !chaves.includes('recebimentos') && !chaves.includes('inadimplencias') && !chaves.includes('itens') && !chaves.includes('resultado')
      
      if (temApenasMetadados) {
        // Resposta vazia - parar imediatamente
        if (pagina === 1) {
          logger.warn(`[Inadimplencia] ⚠️ API retornou apenas metadados (sem dados) para condomínio ${idCondominio}. Mensagem: "${data.msg || 'N/A'}"`)
        }
        temMais = false
        break
      }
      
      let dadosArray: any[] = []
      if (Array.isArray(data)) {
        dadosArray = data
        if (pagina === 1 && dadosArray.length > 0) {
          logger.info(`[Inadimplencia] ✅ Encontrado array direto com ${dadosArray.length} itens`)
        }
      } else if (data && typeof data === 'object') {
        // Tentar diferentes estruturas possíveis
        if (Array.isArray(data.data)) {
          dadosArray = data.data
          if (pagina === 1) {
            logger.info(`[Inadimplencia] ✅ Encontrado data.data com ${dadosArray.length} itens`)
          }
        } else if (Array.isArray(data.recebimentos)) {
          dadosArray = data.recebimentos
          if (pagina === 1) {
            logger.info(`[Inadimplencia] ✅ Encontrado data.recebimentos com ${dadosArray.length} itens`)
          }
        } else if (Array.isArray(data.inadimplencias)) {
          dadosArray = data.inadimplencias
          if (pagina === 1) {
            logger.info(`[Inadimplencia] ✅ Encontrado data.inadimplencias com ${dadosArray.length} itens`)
          }
        } else if (Array.isArray(data.itens)) {
          dadosArray = data.itens
          if (pagina === 1) {
            logger.info(`[Inadimplencia] ✅ Encontrado data.itens com ${dadosArray.length} itens`)
          }
        } else if (data.status === 'success' && Array.isArray(data.resultado)) {
          // Estrutura alternativa: { status: 'success', resultado: [...] }
          dadosArray = data.resultado
          if (pagina === 1) {
            logger.info(`[Inadimplencia] ✅ Encontrado data.resultado com ${dadosArray.length} itens`)
          }
        } else if (data.msg && typeof data.msg === 'string' && data.msg.toLowerCase().includes('nenhum')) {
          // Resposta vazia com mensagem
          logger.warn(`[Inadimplencia] ⚠️ API retornou mensagem indicando vazio: "${data.msg}"`)
          dadosArray = []
        } else {
          // Se não encontrou array conhecido e não tem apenas metadados, pode ser estrutura diferente
          // Mas não tentar processar objeto único se não tiver campos esperados
          const temCamposEsperados = chaves.some(k => 
            k.includes('recebimento') || k.includes('inadimplencia') || k.includes('unidade') || k.includes('condominio')
          )
          if (!temCamposEsperados) {
            // Não tem campos esperados - resposta vazia
            logger.warn(`[Inadimplencia] ⚠️ Resposta não tem campos esperados. Chaves disponíveis:`, chaves)
            dadosArray = []
          } else {
            logger.info(`[Inadimplencia] 🔍 Resposta não é array conhecido, tentando processar como objeto único. Chaves:`, chaves)
            dadosArray = [data]
          }
        }
      }

      if (!dadosArray || dadosArray.length === 0) {
        if (pagina === 1) {
          logger.error(`[Inadimplencia] ❌ Nenhum dado encontrado na página ${pagina} do condomínio ${idCondominio}`)
          
          // Log detalhado da estrutura completa da resposta para debug
          const estruturaCompleta = data && typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
          logger.error(`[Inadimplencia] ❌ Estrutura completa da resposta (primeiros 3000 chars):`, estruturaCompleta.substring(0, 3000))
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:449',message:'No data found for condominio',data:{idCondominio,url,params:Object.fromEntries(params.entries()),responseStructure:data&&typeof data==='object'?Object.keys(data):[],responseMsg:data?.msg||'N/A',responseStatus:data?.status||'N/A',responseData:JSON.stringify(data).substring(0,1000)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'P'})}).catch(()=>{});
          // #endregion
          
          // Verificar se há mensagem na resposta
          if (data?.msg) {
            logger.error(`[Inadimplencia] ❌ Mensagem da API: ${data.msg}`)
          }
          
          // Verificar se há status na resposta
          if (data?.status) {
            logger.error(`[Inadimplencia] ❌ Status da API: ${data.status}`)
          }
          
          // Log dos parâmetros usados
          logger.error(`[Inadimplencia] ❌ Parâmetros usados na requisição:`, Object.fromEntries(params.entries()))
          logger.error(`[Inadimplencia] ❌ URL completa: ${url}`)
        }
        temMais = false
        break
      }
      
      if (pagina === 1 && dadosArray.length > 0) {
        logger.info(`[Inadimplencia] ✅ Processando ${dadosArray.length} itens da página ${pagina} do condomínio ${idCondominio}`)
      }

      for (const item of dadosArray) {
        let recebimentos: any[] = []
        if (Array.isArray(item.recebimentos)) recebimentos = item.recebimentos
        else if (Array.isArray(item.recebimento)) recebimentos = item.recebimento
        else if (item.inad && Array.isArray(item.inad.recebimentos)) recebimentos = item.inad.recebimentos
        else if (item.id_recebimento_recb || item.idRecebimento) recebimentos = [item]

        if (recebimentos.length === 0) {
          if (pagina === 1) {
            logger.debug(`[Inadimplencia] Item sem recebimentos. Chaves do item:`, Object.keys(item))
          }
          continue
        }
        
        if (pagina === 1 && recebimentos.length > 0) {
          logger.info(`[Inadimplencia] Encontrado ${recebimentos.length} recebimentos no item. Primeiro recebimento:`, {
            chaves: Object.keys(recebimentos[0]),
            idRecebimento: recebimentos[0].id_recebimento_recb || recebimentos[0].idRecebimento,
            idUnidade: recebimentos[0].id_unidade_uni || recebimentos[0].idUnidade,
            valor: recebimentos[0].vl_total_recb || recebimentos[0].valorTotal,
            dataVencimento: recebimentos[0].dt_vencimento_recb || recebimentos[0].dataVencimento,
            status: recebimentos[0].fl_status_recb || recebimentos[0].status
          })
        }

        const inad = item.inad || item
        const idCondominioItem = inad.id_condominio_cond || inad.idCondominio || item.id_condominio_cond || item.idCondominio || idCondominio
        let condominioNome = inad.st_fantasia_cond || inad.st_nome_cond || inad.nomeCondominio || inad.nomeFantasia || item.st_fantasia_cond || item.st_nome_cond || item.nomeCondominio || item.nomeFantasia || ''

        for (const rec of recebimentos) {
          const idUnidade = rec.id_unidade_uni || rec.idUnidade || inad.id_unidade_uni || inad.idUnidade || ''
          const nomeUnidade = rec.st_unidade_uni || rec.nomeUnidade || inad.st_unidade_uni || inad.nomeUnidade || inad.unidade || ''
          if (!idUnidade) {
            if (recebimentos.length > 0) {
              const primeiroRec = recebimentos[0]
              const idUnidadeAlt = primeiroRec.id_unidade_uni || primeiroRec.idUnidade || ''
              if (idUnidadeAlt) {
                if (!recebimentosPorUnidade.has(idUnidadeAlt)) recebimentosPorUnidade.set(idUnidadeAlt, [])
                recebimentosPorUnidade.get(idUnidadeAlt)!.push(rec)
              }
            }
            continue
          }
          if (!recebimentosPorUnidade.has(idUnidade)) recebimentosPorUnidade.set(idUnidade, [])
          rec._idCondominio = idCondominioItem
          rec._condominioNome = condominioNome
          rec._idUnidade = idUnidade
          rec._nomeUnidade = nomeUnidade
          rec._inad = inad
          recebimentosPorUnidade.get(idUnidade)!.push(rec)
        }
      }

      if (dadosArray.length < itensPorPagina) temMais = false
      else pagina++
    } catch (error: any) {
      const status = error?.response?.status || error?.status
      const errorData = error?.response?.data || error?.data
      const errorMessage = error?.response?.data?.msg || error?.response?.data?.message || error?.message || 'Erro desconhecido'
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:515',message:'Request report - ERROR',data:{status,statusText:error?.response?.statusText,message:errorMessage,errorData:errorData?JSON.stringify(errorData).substring(0,500):'N/A',url,idCondominio,dataAtualFormatada,companyId:companyId||'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'G'})}).catch(()=>{});
      // #endregion
      
      if (status === 422) {
        // Erro de validação - log detalhado para debug
        const paramsObj = Object.fromEntries(params.entries())
        logger.error(`[Inadimplencia] ❌ Erro 422 (Validação) ao buscar página ${pagina} do condomínio ${idCondominio}:`, {
          url,
          params: paramsObj,
          errorMessage,
          errorData: errorData ? JSON.stringify(errorData).substring(0, 1000) : 'N/A',
          dataAtualFormatada,
          idCondominio
        })
        
        // IMPORTANTE: Não lançar erro na primeira página - isso faz o condomínio ser ignorado completamente
        // Em vez disso, logar o erro e retornar unidades já encontradas (ou vazio se primeira página)
        // Isso permite que outros condomínios continuem sendo processados
        if (pagina === 1) {
          // Primeira página com erro 422 - pode ser problema de validação, mas não devemos parar todo o processamento
          // Retornar vazio para este condomínio específico, mas continuar com os outros
          logger.warn(`[Inadimplencia] ⚠️ Erro 422 na primeira página do condomínio ${idCondominio} - pulando este condomínio mas continuando processamento`)
          return unidades // Retornar vazio (unidades ainda está vazio na primeira página)
        }
        
        // Se não for a primeira página, retornar unidades já encontradas
        return unidades
      }
      
      if (status === 401) {
        logger.error(`[Inadimplencia] Erro 401 (Não autorizado) ao buscar condomínio ${idCondominio}`)
        // IMPORTANTE: Se for busca de um único condomínio específico, lançar erro para mostrar ao usuário
        // Se for processamento em batch, retornar vazio para continuar com outros condomínios
        if (isSingleCondominio) {
          throw error
        } else {
          logger.warn(`[Inadimplencia] ⚠️ Erro 401 no condomínio ${idCondominio} - pulando este condomínio mas continuando processamento`)
          return unidades
        }
      }
      
      // Outros erros - não lançar exceção, apenas logar e retornar unidades já encontradas
      logger.error(`[Inadimplencia] Erro ${status || 'desconhecido'} ao buscar página ${pagina} do condomínio ${idCondominio}:`, {
        status,
        errorMessage,
        url
      })
      // Se for primeira página, retornar vazio (unidades ainda está vazio)
      // Se não for primeira página, retornar unidades já encontradas
      return unidades
    }
  }

  // Processar recebimentos agrupados por unidade
  logger.info(`[Inadimplencia] 🔄 Processando ${recebimentosPorUnidade.size} unidades com recebimentos para condomínio ${idCondominio}`)
  
  let totalRecebimentos = 0
  let totalRecebimentosEmAberto = 0
  let unidadesComRecebimentos = 0
  let unidadesComRecebimentosEmAberto = 0
  let unidadesRejeitadasPorSaldo = 0
  let unidadesRejeitadasPorFiltro = 0
  
  for (const [idUnidade, recebimentos] of recebimentosPorUnidade.entries()) {
    if (!recebimentos || recebimentos.length === 0) continue
    
    unidadesComRecebimentos++
    totalRecebimentos += recebimentos.length

    // Filtros mais permissivos: incluir recebimentos que não estão claramente pagos/liquidados
    const recebimentosEmAberto = recebimentos.filter((rec: any) => {
      // Verificar flag_liquidado - só excluir se explicitamente marcado como liquidado
      const flagLiquidado = rec.flag_liquidado ?? rec.flagLiquidado ?? rec.fl_liquidado_recb
      if (typeof flagLiquidado !== 'undefined' && flagLiquidado !== null) {
        const flagValor = typeof flagLiquidado === 'string'
          ? flagLiquidado.trim().toLowerCase()
          : flagLiquidado
        const ehLiquidado =
          flagValor === true ||
          flagValor === 1 ||
          flagValor === '1' ||
          flagValor === 'true' ||
          flagValor === 'sim' ||
          flagValor === 's'
        if (ehLiquidado) {
          logger.debug(`[Inadimplencia] Recebimento ${rec.id_recebimento_recb || 'N/A'} excluído: flag_liquidado=${flagLiquidado}`)
          return false
        }
      }

      // Verificar data de liquidação - só excluir se tiver data de liquidação
      const dataLiquidacao = rec.dt_liquidacao_recb || rec.dataLiquidacao
      if (dataLiquidacao && dataLiquidacao.trim() !== '' && dataLiquidacao !== '0000-00-00' && dataLiquidacao !== '00/00/0000') {
        logger.debug(`[Inadimplencia] Recebimento ${rec.id_recebimento_recb || 'N/A'} excluído: dataLiquidacao=${dataLiquidacao}`)
        return false
      }
      
      // Status: 0 = em aberto, 1 = pago, 2 = cancelado, 3 = estornado
      // Incluir apenas recebimentos em aberto (status 0, 2 ou não definido)
      // Status 2 (cancelado) pode ser incluído se não tiver data de liquidação
      const status = rec.fl_status_recb ?? rec.status ?? 0
      if (status === 1) {
        // Status 1 = pago - excluir
        logger.debug(`[Inadimplencia] Recebimento ${rec.id_recebimento_recb || 'N/A'} excluído: status=1 (pago)`)
        return false
      }
      // Status 3 (estornado) pode ser incluído se não tiver flag_liquidado ou dataLiquidacao
      
      const valorBruto = rec.vl_total_recb || rec.valorTotal || rec.vl_emitido_recb || rec.valorEmitido || 0
      const valor = parseValorMonetario(valorBruto)
      
      // Log para debug apenas no primeiro recebimento de cada unidade
      if (recebimentos.length > 0 && recebimentos.indexOf(rec) === 0) {
        logger.info(`[Inadimplencia] 🔍 Debug parsing valor - Original: ${valorBruto} (tipo: ${typeof valorBruto}) -> Parseado: ${valor}`)
      }
      
      if (valor <= 0) {
        logger.warn(`[Inadimplencia] ⚠️ Recebimento ${rec.id_recebimento_recb || 'N/A'} excluído: valor parseado=${valor} (valor bruto=${valorBruto})`)
        return false
      }
      
      return true
    })

    if (recebimentosEmAberto.length === 0) {
      unidadesRejeitadasPorFiltro++
      // Log detalhado para as primeiras 10 unidades rejeitadas para debug
      if (unidadesRejeitadasPorFiltro <= 10) {
        logger.warn(`[Inadimplencia] ⚠️ Unidade ${idUnidade} (condomínio ${idCondominio}) tem ${recebimentos.length} recebimentos, mas nenhum em aberto após filtro`)
        // Log do primeiro recebimento para entender por que foi filtrado
        if (recebimentos.length > 0) {
          const primeiroRec = recebimentos[0]
          logger.warn(`[Inadimplencia] Exemplo de recebimento filtrado:`, {
            idRecebimento: primeiroRec.id_recebimento_recb || primeiroRec.idRecebimento,
            flagLiquidado: primeiroRec.flag_liquidado ?? primeiroRec.flagLiquidado ?? primeiroRec.fl_liquidado_recb,
            dataLiquidacao: primeiroRec.dt_liquidacao_recb || primeiroRec.dataLiquidacao,
            status: primeiroRec.fl_status_recb ?? primeiroRec.status,
            valor: primeiroRec.vl_total_recb || primeiroRec.valorTotal || primeiroRec.vl_emitido_recb || primeiroRec.valorEmitido
          })
        }
      }
      continue
    }
    
    unidadesComRecebimentosEmAberto++
    totalRecebimentosEmAberto += recebimentosEmAberto.length
    logger.info(`[Inadimplencia] ✅ Unidade ${idUnidade}: ${recebimentosEmAberto.length} recebimentos em aberto de ${recebimentos.length} totais`)

    const saldoTotal = recebimentosEmAberto.reduce((total: number, rec: any) => {
      const valorBruto = rec.vl_total_recb || rec.valorTotal || rec.vl_emitido_recb || rec.valorEmitido || 0
      const valor = parseValorMonetario(valorBruto)
      return total + valor
    }, 0)
    
    // Log para debug do primeiro recebimento da unidade
    if (recebimentosEmAberto.length > 0) {
      const primeiroRec = recebimentosEmAberto[0]
      const valorBrutoPrimeiro = primeiroRec.vl_total_recb || primeiroRec.valorTotal || primeiroRec.vl_emitido_recb || primeiroRec.valorEmitido || 0
      logger.info(`[Inadimplencia] 💰 Unidade ${idUnidade} - Primeiro recebimento: valor bruto=${valorBrutoPrimeiro} (tipo: ${typeof valorBrutoPrimeiro}), saldo total=${saldoTotal.toFixed(2)}`)
    }

    const datasVencimento = recebimentosEmAberto.map((rec: any) => {
      const dataVencimento = rec.dt_vencimento_recb || rec.dataVencimento
      const [dataPart] = dataVencimento.split(' ')
      const [dia, mes, ano] = dataPart.split('/')
      return new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia))
    }).filter((data) => !isNaN(data.getTime()))
    let diasAtraso = 0
    if (datasVencimento.length > 0) {
      const dataMaisAntiga = new Date(Math.min(...datasVencimento.map(d => d.getTime())))
      const hoje = new Date(); hoje.setHours(0,0,0,0)
      diasAtraso = Math.max(0, Math.floor((hoje.getTime() - dataMaisAntiga.getTime()) / (1000 * 60 * 60 * 24)))
    }

    const primeiroRec = recebimentosEmAberto[0]
    const inad = primeiroRec._inad || primeiroRec.inad || {}

    const idCondominioItem = primeiroRec._idCondominio || inad.id_condominio_cond || inad.idCondominio || idCondominio
    let condominioNome = primeiroRec._condominioNome || ''
    if (!condominioNome && idCondominioItem) {
      const condEncont = condominios.find(c => c.idCondominio === idCondominioItem)
      if (condEncont) condominioNome = condEncont.nomeFantasia || condEncont.nome || ''
    }
    if (!condominioNome) condominioNome = inad.st_fantasia_cond || inad.st_nome_cond || inad.nomeCondominio || inad.nomeFantasia || ''

    const nomeUnidade = primeiroRec._nomeUnidade || inad.st_unidade_uni || inad.nomeUnidade || inad.unidade || idUnidade
    const proprietario = primeiroRec.st_nome_con || primeiroRec.nomeProprietario || inad.st_nome_con || inad.nomeProprietario || inad.proprietario || ''
    const inquilino = primeiroRec.st_nome_inquilino || primeiroRec.nomeInquilino || inad.st_nome_inquilino || inad.nomeInquilino || inad.inquilino || ''
    const situacao = primeiroRec.situacao || inad.situacao || ''
    const processo = primeiroRec.id_processo_proc || primeiroRec.processo || inad.id_processo_proc || inad.processo || ''

    const unidadeObj: UnidadeInadimplente = {
      idCondominio: idCondominioItem,
      condominioNome,
      unidade: nomeUnidade,
      proprietario,
      inquilino,
      situacao,
      processo,
      diasAtraso,
      quantidadeCobrancas: recebimentosEmAberto.length,
      saldo: saldoTotal
    }

    // Calcular confidence (apenas para informação, não para filtrar)
    const score = computeConfidenceForParsedUnit(unidadeObj)
    unidadeObj.confidence = score

    // Incluir TODAS as unidades com saldo > 0, independente do score
    // O score é apenas informativo para indicar a qualidade dos dados
    if (unidadeObj.saldo > 0) {
      unidades.push(unidadeObj)
      
      // Log apenas se o score for baixo para investigação
      if (score < 0.50) {
        logger.warn(`[Inadimplencia] ⚠️ Unidade incluída com score baixo (${score.toFixed(2)}):`, {
          unidade: unidadeObj.unidade,
          condominio: unidadeObj.condominioNome,
          saldo: unidadeObj.saldo,
          diasAtraso: unidadeObj.diasAtraso,
          confidence: score
        })
      } else {
        logger.debug(`[Inadimplencia] ✅ Unidade incluída (score: ${score.toFixed(2)}):`, {
          unidade: unidadeObj.unidade,
          condominio: unidadeObj.condominioNome,
          saldo: unidadeObj.saldo,
          diasAtraso: unidadeObj.diasAtraso
        })
      }
    } else {
      unidadesRejeitadasPorSaldo++
      if (unidadesRejeitadasPorSaldo <= 5) {
        logger.warn(`[Inadimplencia] ⚠️ Unidade rejeitada: saldo=${unidadeObj.saldo}, diasAtraso=${unidadeObj.diasAtraso}, unidade=${unidadeObj.unidade}`)
      }
    }
  }

  logger.info(`[Inadimplencia] 📊 Resumo do processamento para condomínio ${idCondominio}:`, {
    unidadesComRecebimentos,
    unidadesComRecebimentosEmAberto,
    unidadesRejeitadasPorFiltro,
    unidadesRejeitadasPorSaldo,
    totalRecebimentos,
    totalRecebimentosEmAberto,
    unidadesInadimplentes: unidades.length
  })
  
  if (unidades.length === 0 && recebimentosPorUnidade.size > 0) {
    logger.error(`[Inadimplencia] ❌ ATENÇÃO CRÍTICA: Condomínio ${idCondominio} tem ${recebimentosPorUnidade.size} unidades com recebimentos, mas NENHUMA passou nos filtros!`)
    logger.error(`[Inadimplencia] ❌ Estatísticas: ${unidadesRejeitadasPorFiltro} rejeitadas por filtro, ${unidadesRejeitadasPorSaldo} rejeitadas por saldo=0`)
    logger.error(`[Inadimplencia] ❌ Total recebimentos: ${totalRecebimentos}, Recebimentos em aberto: ${totalRecebimentosEmAberto}`)
    logger.error(`[Inadimplencia] ❌ Verifique os logs acima para entender por que os recebimentos foram filtrados.`)
    
    // Log detalhado de algumas unidades para debug
    let contador = 0
    for (const [idUnidade, recebimentos] of recebimentosPorUnidade.entries()) {
      if (contador >= 3) break
      contador++
      logger.error(`[Inadimplencia] Exemplo unidade ${idUnidade}:`, {
        totalRecebimentos: recebimentos.length,
        primeiroRecebimento: recebimentos[0] ? {
          id: recebimentos[0].id_recebimento_recb || recebimentos[0].idRecebimento,
          flagLiquidado: recebimentos[0].flag_liquidado ?? recebimentos[0].flagLiquidado ?? recebimentos[0].fl_liquidado_recb,
          dataLiquidacao: recebimentos[0].dt_liquidacao_recb || recebimentos[0].dataLiquidacao,
          status: recebimentos[0].fl_status_recb ?? recebimentos[0].status,
          valor: recebimentos[0].vl_total_recb || recebimentos[0].valorTotal || recebimentos[0].vl_emitido_recb || recebimentos[0].valoEmitido
        } : null
      })
    }
  }
  
  return unidades
}

// ---------- Agrupamento ----------
function agruparPorCondominio(unidades: UnidadeInadimplente[], listaCondominios: Condominio[] = []): ResumoCondominio[] {
  const condominiosMapPorId = new Map<string, Condominio>()
  listaCondominios.forEach(cond => { condominiosMapPorId.set(cond.idCondominio, cond) })
  const condominiosMap = new Map<string, ResumoCondominio>()

  unidades.forEach((unidade) => {
    const idCondominio = unidade.idCondominio || 'sem-id'
    let condominioNome = unidade.condominioNome || ''
    if (!condominioNome && idCondominio !== 'sem-id') {
      const condEncontrado = condominiosMapPorId.get(idCondominio)
      if (condEncontrado) condominioNome = condEncontrado.nomeFantasia || condEncontrado.nome || ''
    }
    if (!condominioNome) condominioNome = unidade.condominioNome || 'Condomínio não identificado'

    if (!condominiosMap.has(idCondominio)) {
      condominiosMap.set(idCondominio, {
        idCondominio,
        condominioNome,
        unidades: [],
        totalUnidades: 0,
        totalCobrancas: 0,
        totalSaldo: 0
      })
    }

    const cond = condominiosMap.get(idCondominio)!
    cond.unidades.push(unidade)
  })

  const condominios: ResumoCondominio[] = Array.from(condominiosMap.values())
  condominios.forEach(cond => {
    // Filtrar apenas unidades com saldo > 0 (já deveriam estar filtradas, mas garantir)
    const unidadesComSaldo = cond.unidades.filter(u => u.saldo > 0)
    
    // Se não houver unidades com saldo, remover o condomínio da lista
    if (unidadesComSaldo.length === 0) {
      logger.debug(`[Inadimplencia] Condomínio ${cond.condominioNome} removido: nenhuma unidade com saldo > 0`)
      return
    }
    
    cond.totalUnidades = unidadesComSaldo.length
    cond.totalCobrancas = unidadesComSaldo.reduce((sum, u) => sum + u.quantidadeCobrancas, 0)
    cond.totalSaldo = unidadesComSaldo.reduce((sum, u) => sum + u.saldo, 0)
    cond.unidades = unidadesComSaldo.sort((a, b) => b.saldo - a.saldo)
  })
  
  // Filtrar condomínios que ficaram sem unidades
  const condominiosComUnidades = condominios.filter(cond => cond.unidades.length > 0)
  
  logger.info(`[Inadimplencia] 📊 Agrupamento: ${unidades.length} unidades em ${condominiosComUnidades.length} condomínios`)
  
  return condominiosComUnidades

  condominios.sort((a, b) => {
    const nomeA = (a.condominioNome || '').toLowerCase().trim()
    const nomeB = (b.condominioNome || '').toLowerCase().trim()
    return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true, ignorePunctuation: true })
  })

  return condominios
}

// ---------- Componente ----------
export function Inadimplencia() {
  const { token, companyId } = useAuth()

  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [condominioSelecionado, setCondominioSelecionado] = useState<string>('')
  const [resumosCondominios, setResumosCondominios] = useState<ResumoCondominio[]>([])
  const [progresso, setProgresso] = useState<{ processados: number; total: number } | null>(null)
  const [gerandoPDF, setGerandoPDF] = useState(false)
  const loadingRef = useRef(false)
  const carregouRef = useRef(false)
  const tokenAnteriorRef = useRef<string | null>(null)

  // Log quando token mudar para debug
  useEffect(() => {
    if (token) {
      console.log('[Inadimplencia] Token recebido:', token.substring(0, 30) + '...')
      // Verificar se token é válido (não expirado)
      try {
        const parts = token.split('.')
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
          if (payload.exp) {
            const expDate = new Date(payload.exp * 1000)
            const now = new Date()
            if (expDate < now) {
              console.error('[Inadimplencia] ⚠️ Token está EXPIRADO!')
              setErro('Token de autenticação expirado. Execute ./iap auth para renovar.')
            } else {
              const diffMs = expDate.getTime() - now.getTime()
              const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
              console.log(`[Inadimplencia] ✅ Token válido por mais ${diffHours}h`)
            }
          }
        }
      } catch (e) {
        console.warn('[Inadimplencia] ⚠️ Erro ao validar token:', e)
      }
    } else {
      console.warn('[Inadimplencia] ⚠️ Token não disponível')
    }
  }, [token])

  // carregar condomínios quando token mudar
  useEffect(() => {
    if (!token) {
      setCondominios([])
      return
    }
    
    const carregar = async () => {
      try {
        // Sempre atualizar token na API antes de buscar condomínios
        api.setToken(token)
        console.log('[Inadimplencia] Carregando condomínios com token:', token.substring(0, 20) + '...')
        const conds = await buscarCondominios(api)
        setCondominios(conds)
        console.log('[Inadimplencia] Condomínios carregados:', conds.length)
      } catch (err: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:902',message:'carregarCondominios useEffect - ERROR',data:{status:err?.response?.status,message:err?.message,errorData:err?.response?.data?JSON.stringify(err.response.data).substring(0,500):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H'})}).catch(()=>{});
        // #endregion
        console.error('[Inadimplencia] Erro ao carregar condomínios:', err)
        const errorMsg = err?.response?.status === 422 
          ? `Erro ao carregar condomínios: HTTP ${err.response.status}: ${err?.response?.data?.msg || err?.response?.data?.message || err?.message || 'Unprocessable Entity'}`
          : `Erro ao carregar condomínios: ${err?.message || 'Erro desconhecido'}`
        setErro(errorMsg)
        setCondominios([])
      }
    }
    carregar()
  }, [token, companyId])

  const carregarRelatorio = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:956',message:'carregarRelatorio - ENTRY',data:{condominioSelecionado,loadingRef:loadingRef.current,hasToken:!!token},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'T'})}).catch(()=>{});
    // #endregion
    if (loadingRef.current) {
      console.debug('[Inadimplencia] Carregamento já em andamento')
      return
    }
    if (!token) {
      setErro('Token de autenticação não disponível. Recarregue a página.')
      setResumosCondominios([])
      return
    }

    // Sempre atualizar o token na API antes de fazer requisições
    api.setToken(token)
    console.log('[Inadimplencia] Token atualizado na API:', token.substring(0, 20) + '...')
    
    setLoading(true)
    setErro(null)
    setProgresso(null)
    loadingRef.current = true

    try {
      // Formato DD/MM/YYYY
      const hoje = new Date()
      const dia = String(hoje.getDate()).padStart(2, '0')
      const mes = String(hoje.getMonth() + 1).padStart(2, '0')
      const ano = hoje.getFullYear()
      const dataAtualFormatada = `${dia}/${mes}/${ano}`

      const idCondominio = condominioSelecionado || undefined
      let unidades: UnidadeInadimplente[] = []

      if (!idCondominio) {
        const lista = await buscarCondominios(api)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:967',message:'Starting batch processing',data:{totalCondominios:lista.length,condominios:lista.map(c=>({id:c.idCondominio,nome:c.nome||c.nomeFantasia}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'N'})}).catch(()=>{});
        // #endregion
        // processar em batches maiores (10 paralelos) para acelerar
        const batchSize = 10
        let processados = 0
        let comDados = 0
        let semDados = 0
        const total = lista.length
        setProgresso({ processados: 0, total })
        
        logger.info(`[Inadimplencia] Iniciando processamento de ${total} condomínios...`)
        
        for (let i = 0; i < lista.length; i += batchSize) {
          const batch = lista.slice(i, i + batchSize)
          const promises = batch.map(async (cond) => {
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:980',message:'Processing condominio - START',data:{idCondominio:cond.idCondominio,nome:cond.nome||cond.nomeFantasia,index:i+batch.indexOf(cond),total:lista.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
            // #endregion
            try {
              const resultado = await buscarInadimplenciasPorCondominio(api, cond.idCondominio, token, dataAtualFormatada, lista, companyId, false)
              processados++
              if (resultado.length > 0) {
                comDados++
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:983',message:'Processing condominio - SUCCESS with data',data:{idCondominio:cond.idCondominio,nome:cond.nome||cond.nomeFantasia,unidadesCount:resultado.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                // #endregion
              } else {
                semDados++
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:987',message:'Processing condominio - SUCCESS no data',data:{idCondominio:cond.idCondominio,nome:cond.nome||cond.nomeFantasia},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'K'})}).catch(()=>{});
                // #endregion
              }
              // Atualizar progresso na UI
              setProgresso({ processados, total })
              // Log de progresso a cada 10 condomínios
              if (processados % 10 === 0 || processados === total) {
                logger.info(`[Inadimplencia] Progresso: ${processados}/${total} condomínios processados (${comDados} com dados, ${semDados} sem dados)`)
              }
              return resultado
            } catch (e: any) {
              processados++
              semDados++
              setProgresso({ processados, total })
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:996',message:'Processing condominio - ERROR',data:{idCondominio:cond.idCondominio,nome:cond.nome||cond.nomeFantasia,status:e?.response?.status,message:e?.message,errorData:e?.response?.data?JSON.stringify(e.response.data).substring(0,300):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'L'})}).catch(()=>{});
              // #endregion
              logger.warn(`[Inadimplencia] Erro em condomínio ${cond.idCondominio} (${cond.nome || cond.nomeFantasia}):`, e?.message || e)
              return [] as UnidadeInadimplente[]
            }
          })
          const resultados = await Promise.all(promises)
          resultados.forEach(r => {
            if (r.length > 0) unidades.push(...r)
          })
        }
        logger.info(`[Inadimplencia] ✅ Processamento concluído:`, {
          totalCondominios: processados,
          totalCondominiosLista: lista.length,
          comDados,
          semDados,
          totalUnidadesInadimplentes: unidades.length
        })
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1009',message:'Processing batch - COMPLETED',data:{totalCondominios:processados,totalCondominiosLista:lista.length,comDados,semDados,totalUnidades:unidades.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'M'})}).catch(()=>{});
        // #endregion
        
        // Log detalhado para debug
        if (unidades.length > 0) {
          const unidadesPorCondominio = new Map<string, number>()
          unidades.forEach(u => {
            const count = unidadesPorCondominio.get(u.idCondominio) || 0
            unidadesPorCondominio.set(u.idCondominio, count + 1)
          })
          logger.info(`[Inadimplencia] 📊 Unidades por condomínio (antes do agrupamento):`, {
            totalUnidades: unidades.length,
            totalCondominiosComUnidades: unidadesPorCondominio.size,
            distribuicao: Array.from(unidadesPorCondominio.entries()).map(([id, count]) => ({ id, count }))
          })
        }
        
        setProgresso(null)
      } else {
        // Buscar para condomínio específico
        const condSelecionado = condominios.find(c => c.idCondominio === idCondominio)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1067',message:'Processing specific condominio - START',data:{idCondominio,condominioSelecionado,condSelecionado:condSelecionado?{id:condSelecionado.idCondominio,nome:condSelecionado.nome||condSelecionado.nomeFantasia}:null,dataAtualFormatada,companyId,totalCondominios:condominios.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Q'})}).catch(()=>{});
        // #endregion
        logger.info(`[Inadimplencia] 🔍 Buscando inadimplências para condomínio específico:`, {
          idCondominio,
          nome: condSelecionado?.nomeFantasia || condSelecionado?.nome || 'N/A',
          dataAtualFormatada,
          companyId
        })
        
        try {
          unidades = await buscarInadimplenciasPorCondominio(api, idCondominio, token, dataAtualFormatada, condominios, companyId, true)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1077',message:'Processing specific condominio - AFTER buscarInadimplenciasPorCondominio',data:{idCondominio,unidadesEncontradas:unidades.length,unidades:unidades.length>0?unidades.map(u=>({unidade:u.unidade,saldo:u.saldo,quantidadeCobrancas:u.quantidadeCobrancas})).slice(0,5):[]},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Q'})}).catch(()=>{});
          // #endregion
        } catch (err: any) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1080',message:'Processing specific condominio - ERROR in buscarInadimplenciasPorCondominio',data:{idCondominio,status:err?.response?.status,message:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Q'})}).catch(()=>{});
          // #endregion
          // Se for erro 401 ou outro erro crítico, propagar para que seja tratado no catch externo
          throw err
        }
        
        logger.info(`[Inadimplencia] 📊 Resultado para condomínio ${idCondominio} (${condSelecionado?.nomeFantasia || 'N/A'}):`, {
          unidadesEncontradas: unidades.length,
          unidades: unidades.length > 0 ? unidades.map(u => ({
            unidade: u.unidade,
            saldo: u.saldo,
            quantidadeCobrancas: u.quantidadeCobrancas
          })) : []
        })
      }

      if (unidades.length === 0) {
        setErro('Nenhuma receita não recebida encontrada.')
        setResumosCondominios([])
        return
      }

      logger.info(`[Inadimplencia] 🔄 Agrupando ${unidades.length} unidades em condomínios...`)
      const resumos = agruparPorCondominio(unidades, condominios)
      logger.info(`[Inadimplencia] ✅ Após agrupamento: ${resumos.length} condomínios com unidades`)
      
      // Log detalhado dos condomínios encontrados
      resumos.forEach((resumo, idx) => {
        logger.info(`[Inadimplencia] Condomínio ${idx + 1}/${resumos.length}: ${resumo.condominioNome} - ${resumo.totalUnidades} unidades, R$ ${resumo.totalSaldo.toFixed(2)}`)
      })
      
      setResumosCondominios(resumos)
    } catch (error: any) {
      console.error('[Inadimplencia] Erro ao carregar relatório:', error)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1045',message:'carregarRelatorio - ERROR',data:{status:error?.response?.status,statusText:error?.response?.statusText,message:error?.message,errorData:error?.response?.data?JSON.stringify(error.response.data).substring(0,500):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'I'})}).catch(()=>{});
      // #endregion
      
      // Extrair mensagem de erro mais detalhada
      let mensagemErro = error?.message || 'Erro ao gerar relatório.'
      
      // Se for erro 422, tentar extrair detalhes da resposta
      if (error?.response?.status === 422) {
        const errorData = error?.response?.data
        if (errorData?.msg) {
          mensagemErro = `Erro de validação: ${errorData.msg}`
        } else if (errorData?.errors) {
          const errors = Array.isArray(errorData.errors) 
            ? errorData.errors.join(', ')
            : JSON.stringify(errorData.errors)
          mensagemErro = `Erro de validação: ${errors}`
        } else if (errorData?.message) {
          mensagemErro = `Erro de validação: ${errorData.message}`
        } else {
          mensagemErro = `Erro de validação (422). Verifique os parâmetros da requisição. Detalhes no console.`
        }
      } else if (error?.response?.status === 401) {
        mensagemErro = 'Erro de autenticação. Token expirado ou inválido. Execute ./iap auth para renovar.'
      } else if (error?.response?.status) {
        mensagemErro = `Erro HTTP ${error.response.status}: ${mensagemErro}`
      }
      
      logger.error('[Inadimplencia] Erro completo:', {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        stack: error?.stack
      })
      
      setErro(mensagemErro)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [token, condominioSelecionado, condominios.length])

  // Efeito para carregar relatório quando token ou condomínios mudarem
  useEffect(() => {
    console.log('[Inadimplencia] useEffect - token e condomínios:', {
      temToken: !!token,
      numCondominios: condominios.length,
      carregouRef: carregouRef.current,
      tokenAnterior: tokenAnteriorRef.current?.substring(0, 20),
      tokenAtual: token?.substring(0, 20)
    })

    if (!token) {
      console.log('[Inadimplencia] ⚠️ Token não disponível, limpando estado')
      carregouRef.current = false
      tokenAnteriorRef.current = null
      setResumosCondominios([])
      setErro(null)
      return
    }

    if (condominios.length === 0) {
      console.log('[Inadimplencia] ⚠️ Condomínios ainda não carregados, aguardando...')
      carregouRef.current = false
      return
    }

    // Detectar se o token mudou comparando com o token anterior
    const tokenMudou = tokenAnteriorRef.current !== null && tokenAnteriorRef.current !== token
    
    // Se token mudou ou ainda não carregou, recarregar
    if (tokenMudou || !carregouRef.current) {
      console.log('[Inadimplencia] ✅ Condições atendidas, carregando relatório...', {
        tokenMudou,
        carregouRef: carregouRef.current,
        tokenAnterior: tokenAnteriorRef.current?.substring(0, 20),
        tokenAtual: token.substring(0, 20)
      })
      tokenAnteriorRef.current = token
      carregouRef.current = true // Marcar como carregando para evitar múltiplas chamadas simultâneas
      // Chamar carregarRelatorio de forma assíncrona
      carregarRelatorio().catch((err) => {
        console.error('[Inadimplencia] Erro ao carregar relatório:', err)
        carregouRef.current = false // Resetar em caso de erro para permitir nova tentativa
      })
    } else {
      console.log('[Inadimplencia] ⏭️ Já carregado, pulando recarregamento')
      // Atualizar referência do token mesmo se não recarregar
      tokenAnteriorRef.current = token
    }
  }, [token, condominios.length, carregarRelatorio])

  // Efeito para recarregar quando condomínio selecionado mudar
  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1222',message:'useEffect condominioSelecionado - TRIGGERED',data:{condominioSelecionado,hasToken:!!token,condominiosLength:condominios.length,carregouRef:carregouRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'S'})}).catch(()=>{});
    // #endregion
    // IMPORTANTE: Recarregar sempre que condomínio selecionado mudar, independente de carregouRef
    // Isso garante que quando o usuário seleciona um condomínio, o relatório seja recarregado
    if (token && condominios.length > 0) {
      console.log('[Inadimplencia] Condomínio selecionado mudou, recarregando relatório...')
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1224',message:'useEffect condominioSelecionado - CALLING carregarRelatorio',data:{condominioSelecionado},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'S'})}).catch(()=>{});
      // #endregion
      carregouRef.current = false
      carregarRelatorio().catch((err) => {
        console.error('[Inadimplencia] Erro ao carregar relatório:', err)
        carregouRef.current = false
      })
    } else {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Inadimplencia.tsx:1228',message:'useEffect condominioSelecionado - NOT CALLING carregarRelatorio',data:{hasToken:!!token,condominiosLength:condominios.length,carregouRef:carregouRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'S'})}).catch(()=>{});
      // #endregion
    }
  }, [condominioSelecionado, token, condominios.length, carregarRelatorio])

  const totalGeral = resumosCondominios.reduce((sum, c) => sum + c.totalSaldo, 0)
  const totalUnidadesGeral = resumosCondominios.reduce((sum, c) => sum + c.totalUnidades, 0)
  const totalCobrancasGeral = resumosCondominios.reduce((sum, c) => sum + c.totalCobrancas, 0)

  return (
    <div className="p-2 space-y-2">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-sm font-bold text-gray-900">Receitas Não Recebidas</h1>
          <p className="text-xs text-gray-600">Relatório 001B - Relação por condomínio com total por unidade</p>
        </div>
        <div className="flex items-center gap-2">
          {condominios.length > 0 && (
            <select
              value={condominioSelecionado}
              onChange={(e) => { setCondominioSelecionado(e.target.value); carregouRef.current = false }}
              className="px-2 py-1 text-xs border border-gray-300 rounded bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading}
            >
              <option value="">Todos os condomínios</option>
              {condominios.map(cond => (
                <option key={cond.idCondominio} value={cond.idCondominio}>
                  {cond.nomeFantasia}
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => { carregouRef.current = false; carregarRelatorio() }}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <RefreshCw className="w-3 h-3" />
                Recarregar
              </>
            )}
          </button>

          {condominioSelecionado && (
            <button
              onClick={async () => {
                if (!token || !condominioSelecionado) return
                setGerandoPDF(true)
                try {
                  const hoje = new Date().toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                  })
                  
                  const resultado = await gerarRelatorioInadimplencia(token, {
                    idCondominio: condominioSelecionado,
                    posicaoEm: hoje,
                    comValoresAtualizados: false,
                    apenasResumoInad: false,
                    cobrancaDoTipo: 'normal',
                    semAcordo: true,
                    semProcesso: false,
                    render: 'pdf',
                    getId: true
                  })

                  if (resultado.idImpressao) {
                    alert(`Relatório gerado na fila de impressão!\nID: ${resultado.idImpressao}\n\nUse a função obterStatusImpressao() para verificar quando estiver pronto.`)
                  } else if (resultado.url) {
                    window.open(resultado.url, '_blank')
                  } else {
                    alert('Relatório gerado com sucesso!')
                  }
                } catch (err: any) {
                  console.error('[Inadimplencia] Erro ao gerar PDF:', err)
                  alert(`Erro ao gerar PDF: ${err?.message || 'Erro desconhecido'}`)
                } finally {
                  setGerandoPDF(false)
                }
              }}
              disabled={loading || gerandoPDF || !condominioSelecionado}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {gerandoPDF ? (
                <>
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Gerando PDF...
                </>
              ) : (
                <>
                  <FileText className="w-3 h-3" />
                  Gerar PDF
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div className="mb-2 p-3 text-xs bg-red-50 border border-red-200 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-800 font-semibold mb-1">Erro ao carregar relatório</p>
              <p className="text-red-700 whitespace-pre-wrap">{erro}</p>
              <button
                onClick={() => { 
                  carregouRef.current = false
                  setErro(null)
                  carregarRelatorio() 
                }}
                className="mt-2 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
              >
                Tentar Novamente
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && resumosCondominios.length === 0 && (
        <div className="flex flex-col items-center justify-center py-6">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="mt-2 text-xs text-gray-600">
            {progresso 
              ? `Processando condomínios... ${progresso.processados}/${progresso.total}`
              : 'Gerando relatório 001B...'}
          </span>
          {progresso && (
            <div className="mt-2 w-64 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(progresso.processados / progresso.total) * 100}%` }}
              />
            </div>
          )}
        </div>
      )}

      {!loading && resumosCondominios.length === 0 && !erro && (
        <div className="bg-white rounded border border-gray-200 p-4 text-center">
          <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
          <p className="text-xs text-gray-600">Nenhuma receita não recebida encontrada.</p>
        </div>
      )}

      {resumosCondominios.length > 0 && (
        <>
          <div className="mb-2 grid grid-cols-1 md:grid-cols-3 gap-2">
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Building2 className="w-3 h-3 text-blue-600" />
                <span className="text-xs text-gray-600">Condomínios</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{resumosCondominios.length}</p>
            </div>
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <Home className="w-3 h-3 text-green-600" />
                <span className="text-xs text-gray-600">Unidades com Receitas Não Recebidas</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{totalUnidadesGeral}</p>
            </div>
            <div className="bg-white rounded border border-gray-200 p-2">
              <div className="flex items-center gap-1 mb-0.5">
                <DollarSign className="w-3 h-3 text-red-600" />
                <span className="text-xs text-gray-600">Total Não Recebido</span>
              </div>
              <p className="text-lg font-bold text-red-600">{formatarValor(totalGeral)}</p>
            </div>
          </div>

          <div className="space-y-2">
            {resumosCondominios.map((resumo) => (
              <div key={resumo.idCondominio} className="bg-white rounded border border-gray-200 overflow-hidden">
                {/* Cabeçalho do Condomínio */}
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-300 px-2 py-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="w-3 h-3 text-blue-600 flex-shrink-0" />
                      <div>
                        <h2 className="text-xs font-bold text-gray-900 leading-tight">{resumo.condominioNome}</h2>
                        <p className="text-[10px] text-gray-600 leading-tight">
                          {resumo.totalUnidades} {resumo.totalUnidades === 1 ? 'unidade' : 'unidades'} • {resumo.totalCobrancas} {resumo.totalCobrancas === 1 ? 'receita não recebida' : 'receitas não recebidas'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right bg-white px-2 py-0.5 rounded border border-gray-300">
                      <p className="text-[9px] text-gray-500 uppercase font-semibold">Total não recebido</p>
                      <p className="text-sm font-bold text-red-600">{formatarValor(resumo.totalSaldo)}</p>
                    </div>
                  </div>
                </div>

                {/* Tabela de Unidades */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs" style={{ fontSize: '10px' }}>
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-1.5 py-0.5 text-left font-semibold text-gray-700 text-[10px]">Unidade</th>
                        <th className="px-1.5 py-0.5 text-left font-semibold text-gray-700 text-[10px]">Proprietário</th>
                        <th className="px-1.5 py-0.5 text-center font-semibold text-gray-700 text-[10px]">Qtd. Receitas</th>
                        <th className="px-1.5 py-0.5 text-center font-semibold text-gray-700 text-[10px]">Dias em Atraso</th>
                        <th className="px-1.5 py-0.5 text-right font-semibold text-gray-700 text-[10px]">Total Não Recebido</th>
                        {resumo.unidades.some(u => u.processo) && (
                          <th className="px-1.5 py-0.5 text-center font-semibold text-gray-700 text-[10px]">Processo</th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100" style={{ lineHeight: '1.2' }}>
                      {resumo.unidades.map((unidade, index) => (
                        <tr 
                          key={`${unidade.idCondominio}-${unidade.unidade}-${index}`} 
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-1.5 py-0.5">
                            <div className="flex items-center gap-1">
                              <Home className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                              <span className="font-medium text-gray-900 text-[10px]">{unidade.unidade || 'N/A'}</span>
                            </div>
                          </td>
                          <td className="px-1.5 py-0.5">
                            <span className="text-gray-700 truncate block max-w-[150px] text-[10px]">
                              {unidade.proprietario || '-'}
                            </span>
                          </td>
                          <td className="px-1.5 py-0.5 text-center">
                            <span className="text-gray-700 font-medium text-[10px]">
                              {unidade.quantidadeCobrancas}
                            </span>
                          </td>
                          <td className="px-1.5 py-0.5 text-center">
                            {unidade.diasAtraso > 0 ? (
                              <span className="text-red-600 font-semibold text-[10px]">
                                {unidade.diasAtraso} {unidade.diasAtraso === 1 ? 'dia' : 'dias'}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-[10px]">-</span>
                            )}
                          </td>
                          <td className="px-1.5 py-0.5 text-right">
                            <span className="font-bold text-gray-900 text-[10px]">{formatarValor(unidade.saldo)}</span>
                            {unidade.confidence !== undefined && unidade.confidence < 0.95 && (
                              <p className="text-[8px] text-gray-400 mt-0">conf: {(unidade.confidence * 100).toFixed(0)}%</p>
                            )}
                          </td>
                          {resumo.unidades.some(u => u.processo) && (
                            <td className="px-1.5 py-0.5 text-center">
                              {unidade.processo ? (
                                <span className="text-[10px] text-orange-600 font-medium">{unidade.processo}</span>
                              ) : (
                                <span className="text-gray-300 text-[10px]">-</span>
                              )}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    {/* Rodapé com subtotal */}
                    <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                      <tr>
                        <td colSpan={resumo.unidades.some(u => u.processo) ? 5 : 4} className="px-1.5 py-0.5 text-right font-semibold text-gray-700 text-[10px]">
                          Subtotal ({resumo.totalUnidades} {resumo.totalUnidades === 1 ? 'unidade' : 'unidades'}):
                        </td>
                        <td className="px-1.5 py-0.5 text-right">
                          <span className="font-bold text-red-600 text-xs">{formatarValor(resumo.totalSaldo)}</span>
                        </td>
                        {resumo.unidades.some(u => u.processo) && <td></td>}
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
