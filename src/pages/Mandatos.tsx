import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenInfo } from '../components/TokenInfo'
import { 
  carregarAssembleias, 
  salvarAssembleia, 
  atualizarDataRealizada,
  mesclarDadosMandatoComAssembleia,
  salvarAssembleiasEmBatch,
  type AssembleiaData 
} from '../utils/assembleias-db'
import { Edit2, Check, X } from 'lucide-react'

type Mandato = {
  id: string
  condominio: string
  nomeFantasia: string
  nomeResponsavel: string
  cargo: string
  dataEntrada: string
  dataSaida: string | null
  email: string
  telefone: string
  celular: string
  status: 'ativo' | 'encerrado' | 'futuro'
  observacoes?: string
}

export function Mandatos() {
  const { token, companyId } = useAuth()
  const [data, setData] = useState<Mandato[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [ordenacao, setOrdenacao] = useState<'vencimento' | 'nome'>('vencimento')
  const loadingRef = useRef(false)
  const tokenExpiredRef = useRef(false)
  const [assembleiasDB, setAssembleiasDB] = useState<Map<string, AssembleiaData>>(new Map())
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [dataRealizadaEditando, setDataRealizadaEditando] = useState<string>('')

  // Função auxiliar para parse de datas (memoizada para evitar recriações)
  const parseDate = useCallback((dateString: string): Date | null => {
    if (!dateString || dateString === '-') return null
    try {
      // Se já está no formato dd/mm/yyyy, parsear diretamente
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString.trim())) {
        const dateParts = dateString.trim().split('/')
        const dia = parseInt(dateParts[0], 10)
        const mes = parseInt(dateParts[1], 10) - 1 // Mês é 0-indexed em Date
        const ano = parseInt(dateParts[2], 10)
        
        // Validar se os valores são válidos
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
        if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || ano < 1900 || ano > 2100) return null
        
        return new Date(ano, mes, dia)
      }
      
      // Formato esperado: "01/01/2018 00:00:00" ou "01/01/2018" (DD/MM/YYYY)
      const parts = dateString.trim().split(' ')
      const datePart = parts[0]
      const dateParts = datePart.split('/')
      
      if (dateParts.length === 3) {
        // DD/MM/YYYY (formato brasileiro)
        const dia = parseInt(dateParts[0], 10)
        const mes = parseInt(dateParts[1], 10) - 1 // Mês é 0-indexed em Date
        const ano = parseInt(dateParts[2], 10)
        
        // Validar se os valores são válidos
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
        if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || ano < 1900 || ano > 2100) return null
        
        return new Date(ano, mes, dia)
      }
      
      // Tentar parse direto (formato ISO ou outros)
      const date = new Date(dateString)
      if (isNaN(date.getTime())) return null
      return date
    } catch {
      return null
    }
  }, [])

  const carregarMandatos = useCallback(async () => {
    // Evita múltiplas requisições simultâneas
    if (loadingRef.current) {
      console.log('[Mandatos] Requisição já em andamento, ignorando...')
      return
    }
    
    // Se já detectamos token expirado, não tenta novamente automaticamente
    if (tokenExpiredRef.current) {
      console.log('[Mandatos] Token expirado detectado anteriormente, ignorando requisição automática...')
      return
    }
    
    console.log('[Mandatos] ========== INICIANDO CARREGAMENTO DE MANDATOS ==========')
    console.log('[Mandatos] Timestamp:', new Date().toISOString())
    console.log('[Mandatos] Token disponível:', !!token)
    console.log('[Mandatos] Token (primeiros 20 chars):', token ? token.substring(0, 20) + '...' : 'N/A')
    console.log('[Mandatos] Company ID:', companyId)
    
    if (!token) {
      console.error('[Mandatos] ❌ ERRO: Token não disponível!')
      setErro('Token de autenticação não disponível. Aguarde a autenticação ou recarregue a página.')
      setLoading(false)
      loadingRef.current = false
      return
    }
    
    loadingRef.current = true
    setLoading(true)
    setErro(null)
    
    // Timeout de segurança: se demorar mais de 5 minutos, cancelar
    const timeoutId = setTimeout(() => {
      if (loadingRef.current) {
        console.error('[Mandatos] ⚠️ Timeout: Carregamento demorou mais de 5 minutos, cancelando...')
        setErro('Timeout: O carregamento demorou muito. Tente recarregar a página ou verifique sua conexão.')
        setLoading(false)
        loadingRef.current = false
      }
    }, 5 * 60 * 1000) // 5 minutos
    
    try {
      const startTimeTotal = Date.now()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:129',message:'carregarMandatos - START',data:{timestamp:startTimeTotal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'U'})}).catch(()=>{});
      // #endregion
      // Garantir formato correto: abimoveis-003 (minúsculas com hífen)
      let companyIdNormalizado = companyId || localStorage.getItem('x-company-id') || 'abimoveis-003'
      // Normalizar: remover espaços, substituir "=" por "-", converter para minúsculas
      companyIdNormalizado = companyIdNormalizado.trim().toLowerCase().replace(/=/g, '-').replace(/\s+/g, '')
      // Se contém "abimoveis" e "003", garantir formato "abimoveis-003"
      if (companyIdNormalizado.includes('abimoveis') && companyIdNormalizado.includes('003')) {
        companyIdNormalizado = 'abimoveis-003'
      }
      const currentCompanyId = companyIdNormalizado || 'abimoveis-003'
      console.log('[Mandatos] Company ID final:', currentCompanyId)
      
      // Preparar headers com x-company-id para todas as requisições
      const headersRequisicoes: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
      
      if (currentCompanyId) {
        headersRequisicoes['x-company-id'] = currentCompanyId
        headersRequisicoes['company-id'] = currentCompanyId
      }
      
      // Função auxiliar para fazer requisição de uma página específica
      const fazerRequisicaoPagina = async (comStatus: string, idCondominio?: string, pagina: number = 1): Promise<{ list: any[], totalPaginas?: number, totalItens?: number }> => {
        const params = new URLSearchParams({
          itensPorPagina: '50', // API recomenda no máximo 50 (conforme Postman e CertificadoDigital)
          pagina: String(pagina),
        })
        
        if (idCondominio) {
          params.append('idCondominio', idCondominio)
        }
        
        // Só adiciona comStatus se não for vazio (string vazia significa buscar todos sem filtro)
        if (comStatus && comStatus.trim() !== '') {
          params.append('comStatus', comStatus.trim())
        }
        
        const url = `/api/condominios/superlogica/sindicos?${params.toString()}`
        const statusLabel = comStatus && comStatus.trim() !== '' ? comStatus : 'todos (sem filtro)'
        console.log(`[Mandatos] Buscando ${statusLabel} página ${pagina} na URL:`, url)
        
        let responseData: any
        
        try {
          console.log(`[Mandatos] 🔍 Fazendo requisição para: ${url}`)
          // Usar a nova API que injeta token automaticamente, com headers incluindo x-company-id
          const response = await api.get<any>(url, { headers: headersRequisicoes })
          
          console.log(`[Mandatos] ✅ Resposta recebida - Status: ${response.status}`)
          
          // A nova API retorna { data, status, statusText }
          responseData = response.data
          
          // Log detalhado da resposta da API
          const responseKeys = typeof responseData === 'object' && responseData !== null ? Object.keys(responseData) : []
          const responsePreview = typeof responseData === 'object' && responseData !== null 
            ? JSON.stringify(responseData).substring(0, 500) 
            : String(responseData).substring(0, 500)
          
          console.log(`[Mandatos] 📦 Resposta da API (página ${pagina}, ${comStatus || 'sem filtro'}):`, {
            tipo: Array.isArray(responseData) ? 'array' : typeof responseData,
            keys: responseKeys,
            preview: Array.isArray(responseData) 
              ? `Array com ${responseData.length} itens` 
              : responsePreview
          })
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:167',message:'fazerRequisicaoPagina - Resposta API',data:{comStatus,idCondominio,pagina,isArray:Array.isArray(responseData),responseKeys:responseKeys,responsePreview:responsePreview,hasData:!!responseData?.data,dataIsArray:Array.isArray(responseData?.data),dataLength:Array.isArray(responseData?.data)?responseData.data.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'AA'})}).catch(()=>{});
          // #endregion
          
          if (Array.isArray(responseData) && responseData.length > 0) {
            console.log(`[Mandatos] ✅ Array com ${responseData.length} itens recebido`)
            console.log(`[Mandatos] Primeiro item:`, responseData[0])
          } else if (responseData && typeof responseData === 'object') {
            console.log(`[Mandatos] 📋 Objeto recebido, chaves:`, Object.keys(responseData))
          } else {
            console.warn(`[Mandatos] ⚠️ Resposta vazia ou inesperada`)
          }
        } catch (err: any) {
          // Tratar erros da nova API
          const status = err?.response?.status || 500
          const errorData = err?.response?.data || err?.message || 'Erro desconhecido'
          
          console.error(`[Mandatos] ❌ ERRO ao buscar ${comStatus || 'sem filtro'} página ${pagina}:`, {
            status,
            error: errorData,
            url,
            erroCompleto: err
          })
          
          if (status === 401) {
            tokenExpiredRef.current = true
            console.error(`[Mandatos] ❌ Token expirado ou inválido!`)
            console.error(`[Mandatos] ❌ Para renovar, execute: ./iap auth`)
            // Parar todas as requisições pendentes
            throw new Error(`HTTP ${status}: Token de autenticação expirado ou inválido. Execute: ./iap auth`)
          } else if (status === 422) {
            // Erro 422: retornar lista vazia
            console.warn(`[Mandatos] ⚠️ Retornando lista vazia devido ao erro 422`)
            return { list: [], totalPaginas: 0, totalItens: 0 }
          }
          
          // Log detalhado do erro
          console.error(`[Mandatos] Erro completo:`, {
            message: err?.message,
            response: err?.response,
            stack: err?.stack
          })
          
          throw new Error(`HTTP ${status}: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`)
        }
        
        // Continuar processamento apenas se chegou aqui (sem erro)
        if (!responseData) {
          return { list: [], totalPaginas: 0, totalItens: 0 }
        }
        
        // Log completo da estrutura da resposta para debug
        if (typeof responseData === 'object' && responseData !== null && !Array.isArray(responseData)) {
          console.log(`[Mandatos] Estrutura completa da resposta (página ${pagina}):`, {
            status: responseData.status,
            session: responseData.session,
            msg: responseData.msg,
            dataLength: Array.isArray(responseData.data) ? responseData.data.length : 'não é array',
            totalPaginas: responseData.totalPaginas,
            totalItens: responseData.totalItens,
            total: responseData.total,
            executiontime: responseData.executiontime,
            todasAsChaves: Object.keys(responseData)
          })
        }
        
        // Extrair lista de dados
        let list: any[] = []
        let totalPaginas: number | undefined
        let totalItens: number | undefined
        
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:245',message:'fazerRequisicaoPagina - Extraindo lista',data:{comStatus,idCondominio,pagina,isArray:Array.isArray(responseData),hasData:!!responseData?.data,dataIsArray:Array.isArray(responseData?.data),hasSindicos:!!responseData?.sindicos,sindicosIsArray:Array.isArray(responseData?.sindicos)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'AA'})}).catch(()=>{});
        // #endregion
        
        if (Array.isArray(responseData)) {
          list = responseData
        } else if (responseData?.data && Array.isArray(responseData.data)) {
          list = responseData.data
          // Tentar extrair informações de paginação
          if (responseData.totalPaginas !== undefined) totalPaginas = responseData.totalPaginas
          if (responseData.totalItens !== undefined) totalItens = responseData.totalItens
          if (responseData.total !== undefined) totalItens = responseData.total
        } else if (responseData?.sindicos && Array.isArray(responseData.sindicos)) {
          list = responseData.sindicos
        } else if (responseData?.result && Array.isArray(responseData.result)) {
          list = responseData.result
        } else if (typeof responseData === 'object' && responseData !== null) {
          const keys = Object.keys(responseData)
          for (const key of keys) {
            if (Array.isArray(responseData[key])) {
              list = responseData[key]
              console.log(`[Mandatos] Lista encontrada na chave "${key}" com ${list.length} itens`)
              break
            }
          }
          // Tentar extrair informações de paginação
          if (responseData.totalPaginas !== undefined) totalPaginas = responseData.totalPaginas
          if (responseData.totalItens !== undefined) totalItens = responseData.totalItens
          if (responseData.total !== undefined) totalItens = responseData.total
        }
        
        // Log detalhado dos condomínios únicos nesta página
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:275',message:'fazerRequisicaoPagina - Lista extraida',data:{comStatus,idCondominio,pagina,listLength:list.length,totalPaginas,totalItens},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'AA'})}).catch(()=>{});
        // #endregion
        if (list.length > 0) {
          const condominiosUnicos = new Set(list.map((item: any) => 
            item.st_nome_cond || item.ST_NOME_COND || item.condominio || 'Sem nome'
          ))
          console.log(`[Mandatos] Página ${pagina}: ${list.length} itens, ${condominiosUnicos.size} condomínios únicos:`, Array.from(condominiosUnicos))
        } else {
          console.log(`[Mandatos] Página ${pagina}: Nenhum item retornado`)
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:282',message:'fazerRequisicaoPagina - Lista vazia',data:{comStatus,idCondominio,pagina,responseDataKeys:typeof responseData==='object'&&responseData!==null?Object.keys(responseData):[],responseDataString:typeof responseData==='object'?JSON.stringify(responseData).substring(0,500):String(responseData).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'AA'})}).catch(()=>{});
          // #endregion
        }
        
        return { list, totalPaginas, totalItens }
      }
      
      // Função para buscar todas as páginas de um status
      const fazerRequisicaoCompleta = async (comStatus: string, idCondominio?: string): Promise<any[]> => {
        const reqStartTime = Date.now()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:284',message:'fazerRequisicaoCompleta - START',data:{comStatus,idCondominio},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'X'})}).catch(()=>{});
        // #endregion
        // Verificar se token expirou antes de começar
        if (tokenExpiredRef.current) {
          console.warn(`[Mandatos] ⚠️ Token expirado detectado, parando busca de ${comStatus}`)
          return []
        }
        
        let todasPaginas: any[] = []
        let paginaAtual = 1
        let temMaisPaginas = true
        let totalPaginasConhecido: number | undefined
        const itensPorPagina = 50 // API recomenda no máximo 50
        let totalRequests = 0
        
        while (temMaisPaginas && !tokenExpiredRef.current) {
          const pageStartTime = Date.now()
          // Verificar novamente antes de cada requisição
          if (tokenExpiredRef.current) {
            console.warn(`[Mandatos] ⚠️ Token expirado durante busca, parando...`)
            break
          }
          
          const resultado = await fazerRequisicaoPagina(comStatus, idCondominio, paginaAtual)
          const pageTime = Date.now() - pageStartTime
          totalRequests++
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:304',message:'fazerRequisicaoCompleta - PAGE',data:{comStatus,idCondominio,pagina:paginaAtual,itensCount:resultado.list.length,timeMs:pageTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'X'})}).catch(()=>{});
          // #endregion
          todasPaginas = todasPaginas.concat(resultado.list)
          
          const statusLabel = comStatus && comStatus.trim() !== '' ? comStatus : 'todos'
          console.log(`[Mandatos] ${statusLabel} página ${paginaAtual}: ${resultado.list.length} itens`)
          
          // Se a API retornou informação de total de páginas, usar isso
          if (resultado.totalPaginas !== undefined) {
            totalPaginasConhecido = resultado.totalPaginas
            temMaisPaginas = paginaAtual < totalPaginasConhecido
            console.log(`[Mandatos] ${statusLabel} total de páginas conhecido: ${totalPaginasConhecido}`)
          } else if (resultado.totalItens !== undefined) {
            // Calcular total de páginas baseado no total de itens
            const calculado = Math.ceil(resultado.totalItens / itensPorPagina)
            if (totalPaginasConhecido === undefined || calculado > totalPaginasConhecido) {
              totalPaginasConhecido = calculado
            }
            temMaisPaginas = totalPaginasConhecido !== undefined && paginaAtual < totalPaginasConhecido
            console.log(`[Mandatos] ${statusLabel} total de itens: ${resultado.totalItens}, páginas calculadas: ${totalPaginasConhecido}`)
          } else {
            // Caso contrário, parar se retornou menos que o máximo de itens
            // Se retornou exatamente itensPorPagina, provavelmente há mais páginas
            if (resultado.list.length === itensPorPagina) {
              temMaisPaginas = true
              console.log(`[Mandatos] ${statusLabel} página ${paginaAtual} retornou ${resultado.list.length} itens (máximo), continuando...`)
            } else {
              // Retornou menos que o máximo - esta é a última página
              console.log(`[Mandatos] ${statusLabel} página ${paginaAtual} retornou ${resultado.list.length} itens (menos que máximo), última página`)
              temMaisPaginas = false
            }
          }
          
          // Limite de segurança: máximo 200 páginas
          if (paginaAtual >= 200) {
            console.warn(`[Mandatos] ⚠️ Limite de 200 páginas atingido para ${statusLabel}`)
            temMaisPaginas = false
            break
          }
          
          // Se não retornou itens, parar
          if (resultado.list.length === 0) {
            console.log(`[Mandatos] ${statusLabel} página ${paginaAtual} retornou 0 itens, parando paginação`)
            temMaisPaginas = false
            break
          }
          
          // Incrementar página ANTES de continuar
          paginaAtual++
          
          // Proteção adicional: se já processou muitas páginas sem encontrar dados novos, parar
          if (paginaAtual > 10 && todasPaginas.length === 0) {
            console.warn(`[Mandatos] ⚠️ Processou ${paginaAtual} páginas sem encontrar dados, parando`)
            temMaisPaginas = false
            break
          }
        }
        
        const reqTime = Date.now() - reqStartTime
        const statusLabel = comStatus && comStatus.trim() !== '' ? comStatus : 'todos'
        const condominiosUnicos = new Set(todasPaginas.map((item: any) => 
          item.st_nome_cond || item.ST_NOME_COND || item.condominio || 'Sem nome'
        ))
        console.log(`[Mandatos] ${statusLabel} total: ${todasPaginas.length} itens de ${paginaAtual - 1} página(s)`)
        console.log(`[Mandatos] ${statusLabel} condomínios únicos encontrados: ${condominiosUnicos.size}`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:370',message:'fazerRequisicaoCompleta - END',data:{comStatus,idCondominio,totalItens:todasPaginas.length,totalPages:paginaAtual-1,totalRequests,timeMs:reqTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'X'})}).catch(()=>{});
        // #endregion
        if (condominiosUnicos.size > 0) {
          console.log(`[Mandatos] ${statusLabel} lista de condomínios:`, Array.from(condominiosUnicos).slice(0, 10))
        }
        return todasPaginas
      }
      
      // ESTRATÉGIA: Buscar todos os condomínios primeiro, depois buscar síndicos para cada um
      // Isso garante que pegamos todos os 68 condomínios
      console.log('[Mandatos] ========== BUSCANDO TODOS OS CONDOMÍNIOS PRIMEIRO ==========')
      console.log('[Mandatos] Company ID:', currentCompanyId)
      
      // Passo 1: Buscar todos os condomínios
      const startTimeCondominios = Date.now()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:378',message:'carregarMandatos - START buscar condominios',data:{timestamp:startTimeCondominios},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'U'})}).catch(()=>{});
      // #endregion
      let todosCondominios: any[] = []
      let paginaCondominios = 1
      let temMaisCondominios = true
      
      // Garantir que o companyId está disponível para os headers
      // O currentCompanyId já foi normalizado acima, mas garantir novamente
      let companyIdParaHeader = currentCompanyId || localStorage.getItem('x-company-id') || 'abimoveis-003'
      companyIdParaHeader = companyIdParaHeader.trim().toLowerCase().replace(/=/g, '-').replace(/\s+/g, '')
      if (companyIdParaHeader.includes('abimoveis') && companyIdParaHeader.includes('003')) {
        companyIdParaHeader = 'abimoveis-003'
      }
      console.log('[Mandatos] Company ID para header:', companyIdParaHeader)
      
      // Preparar headers com x-company-id explícito (obrigatório para este endpoint)
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
      
      if (companyIdParaHeader) {
        headers['x-company-id'] = companyIdParaHeader
        headers['company-id'] = companyIdParaHeader
        console.log('[Mandatos] ✅ Headers configurados com x-company-id:', companyIdParaHeader)
      } else {
        console.error('[Mandatos] ❌ Company ID não encontrado!')
      }
      
      try {
        while (temMaisCondominios) {
          try {
            const urlCondominios = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${paginaCondominios}`
            console.log(`[Mandatos] Buscando condomínios ATIVOS página ${paginaCondominios}...`)
            console.log(`[Mandatos] URL: ${urlCondominios}`)
            const responseCondominios = await api.get<any>(urlCondominios, { headers })
            
            const dataCondominios = responseCondominios.data
            console.log(`[Mandatos] 📊 Resposta da API (página ${paginaCondominios}):`, {
              isArray: Array.isArray(dataCondominios),
              hasData: !!dataCondominios?.data,
              hasCondominios: !!dataCondominios?.condominios,
              keys: typeof dataCondominios === 'object' && dataCondominios !== null ? Object.keys(dataCondominios) : [],
              preview: typeof dataCondominios === 'object' ? JSON.stringify(dataCondominios).substring(0, 500) : String(dataCondominios).substring(0, 500)
            })
            
            // Verificar primeiro se é um erro (status 409 ou outro código de erro)
            if (dataCondominios?.status && dataCondominios.status !== '200' && dataCondominios.status !== 200) {
              const statusCode = String(dataCondominios.status)
              console.error(`[Mandatos] ❌ API retornou status ${statusCode} no JSON:`, {
                status: statusCode,
                msg: dataCondominios.msg,
                session: dataCondominios.session,
                executiontime: dataCondominios.executiontime
              })
              
              // Se for 409, pode ser que não há dados disponíveis
              if (statusCode === '409' || statusCode === '409') {
                console.warn('[Mandatos] ⚠️ Status 409 (Conflict) - Não há condomínios cadastrados ou o endpoint não está disponível para esta company')
                console.warn('[Mandatos] 💡 Isso é normal se não há condomínios cadastrados no sistema para a company "abimoveis-003"')
                // Status 409 significa que não há dados - parar a busca imediatamente
                temMaisCondominios = false
                break
              } else {
                // Para outros status de erro, pular esta página
                console.warn(`[Mandatos] ⚠️ Status ${statusCode} - Pulando esta página`)
                temMaisCondominios = false
                break
              }
            }
            
            // Log completo do objeto para debug (apenas se não for erro)
            if (typeof dataCondominios === 'object' && dataCondominios !== null) {
              console.log(`[Mandatos] 🔍 Estrutura completa da resposta:`, dataCondominios)
              const keys = Object.keys(dataCondominios)
              keys.forEach(key => {
                const value = dataCondominios[key]
                console.log(`[Mandatos]   - Chave "${key}":`, {
                  type: typeof value,
                  isArray: Array.isArray(value),
                  length: Array.isArray(value) ? value.length : (typeof value === 'string' ? value.length : 'N/A'),
                  value: value, // Mostrar o valor completo
                  preview: Array.isArray(value) 
                    ? `Array com ${value.length} itens` 
                    : typeof value === 'object' && value !== null
                    ? JSON.stringify(value).substring(0, 200)
                    : String(value).substring(0, 200)
                })
              })
            }
            
            // Tentar múltiplas formas de extrair a lista
            let listCondominios: any[] = []
            
            if (Array.isArray(dataCondominios)) {
              listCondominios = dataCondominios
              console.log(`[Mandatos] ✅ Lista encontrada como array direto: ${listCondominios.length} itens`)
            } else if (dataCondominios?.data && Array.isArray(dataCondominios.data)) {
              listCondominios = dataCondominios.data
              console.log(`[Mandatos] ✅ Lista encontrada em data.data: ${listCondominios.length} itens`)
            } else if (dataCondominios?.condominios && Array.isArray(dataCondominios.condominios)) {
              listCondominios = dataCondominios.condominios
              console.log(`[Mandatos] ✅ Lista encontrada em data.condominios: ${listCondominios.length} itens`)
            } else if (dataCondominios?.result && Array.isArray(dataCondominios.result)) {
              listCondominios = dataCondominios.result
              console.log(`[Mandatos] ✅ Lista encontrada em data.result: ${listCondominios.length} itens`)
            } else if (dataCondominios?.list && Array.isArray(dataCondominios.list)) {
              listCondominios = dataCondominios.list
              console.log(`[Mandatos] ✅ Lista encontrada em data.list: ${listCondominios.length} itens`)
            } else if (typeof dataCondominios === 'object' && dataCondominios !== null) {
              // Procurar qualquer array no objeto
              const keys = Object.keys(dataCondominios)
              for (const key of keys) {
                if (Array.isArray(dataCondominios[key])) {
                  listCondominios = dataCondominios[key]
                  console.log(`[Mandatos] ✅ Lista encontrada na chave "${key}": ${listCondominios.length} itens`)
                  break
                }
              }
            }
            
            console.log(`[Mandatos] 📋 Lista extraída: ${listCondominios.length} condomínios`)
            
            if (listCondominios.length === 0) {
              console.log(`[Mandatos] Nenhum condomínio encontrado na página ${paginaCondominios}, parando...`)
              // Verificar se há algum array em outras chaves
              if (typeof dataCondominios === 'object' && dataCondominios !== null) {
                const keys = Object.keys(dataCondominios)
                for (const key of keys) {
                  if (Array.isArray(dataCondominios[key])) {
                    console.warn(`[Mandatos] ⚠️ Encontrado array na chave "${key}" com ${dataCondominios[key].length} itens, mas não foi usado`)
                  }
                }
              }
              temMaisCondominios = false
              break
            }
            
            todosCondominios = todosCondominios.concat(listCondominios)
            console.log(`[Mandatos] Condomínios página ${paginaCondominios}: ${listCondominios.length} encontrados (total: ${todosCondominios.length})`)
            
            // Se retornou menos que 100, é a última página
            if (listCondominios.length < 100) {
              temMaisCondominios = false
            } else {
              paginaCondominios++
              // Limite de segurança
              if (paginaCondominios > 50) {
                console.warn('[Mandatos] ⚠️ Limite de 50 páginas de condomínios atingido')
                temMaisCondominios = false
              }
            }
          } catch (err: any) {
            console.error(`[Mandatos] Erro ao buscar condomínios página ${paginaCondominios}:`, err)
            // Se for erro 401, parar imediatamente
            if (err?.response?.status === 401) {
              tokenExpiredRef.current = true
              throw err
            }
            temMaisCondominios = false
          }
        }
        
        console.log(`[Mandatos] ✅ Total de condomínios encontrados: ${todosCondominios.length}`)
        const timeCondominios = Date.now() - startTimeCondominios
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:427',message:'carregarMandatos - END buscar condominios',data:{totalCondominios:todosCondominios.length,timeMs:timeCondominios},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'U'})}).catch(()=>{});
        // #endregion
        
        // Fallback: se não encontrou nenhum, tentar uma consulta sem filtros (alguns ambientes não aceitam os parâmetros de filtro)
        if (todosCondominios.length === 0) {
          try {
            const urlCondominiosFallback = `/api/condominios/superlogica/condominios/get?id=-1&itensPorPagina=100&pagina=1`
            console.warn('[Mandatos] ⚠️ Nenhum condomínio encontrado com filtros. Tentando fallback sem filtros...')
            console.warn('[Mandatos] URL (fallback):', urlCondominiosFallback)
            const responseFallback = await api.get<any>(urlCondominiosFallback, { headers })
            const dataFallback = responseFallback.data
            console.log(`[Mandatos] 📊 Resposta do fallback:`, {
              isArray: Array.isArray(dataFallback),
              hasData: !!dataFallback?.data,
              hasCondominios: !!dataFallback?.condominios,
              keys: typeof dataFallback === 'object' && dataFallback !== null ? Object.keys(dataFallback) : [],
              preview: typeof dataFallback === 'object' ? JSON.stringify(dataFallback).substring(0, 500) : String(dataFallback).substring(0, 500)
            })
            
            // Tentar múltiplas formas de extrair a lista do fallback
            let listFallback: any[] = []
            
            // Verificar se é um erro (status 409 ou outro código de erro)
            if (dataFallback?.status && dataFallback.status !== '200' && dataFallback.status !== 200) {
              const statusCode = String(dataFallback.status)
              console.error(`[Mandatos] ❌ Fallback retornou status ${statusCode} no JSON:`, {
                status: statusCode,
                msg: dataFallback.msg,
                session: dataFallback.session,
                executiontime: dataFallback.executiontime
              })
              
              if (statusCode === '409' || statusCode === '409') {
                console.warn('[Mandatos] ⚠️ Status 409 no fallback também - Não há condomínios cadastrados para esta company')
                console.warn('[Mandatos] 💡 A API está retornando status 409, indicando que não há condomínios disponíveis para "abimoveis-003"')
                // Não há dados no fallback também - não continuar
                listFallback = []
              } else {
                // Para outros status, tentar extrair dados mesmo assim
                console.warn(`[Mandatos] ⚠️ Status ${statusCode} no fallback, mas tentando extrair dados mesmo assim`)
              }
            }
            
            if (Array.isArray(dataFallback)) {
              listFallback = dataFallback
              console.log(`[Mandatos] ✅ Fallback: Lista encontrada como array direto: ${listFallback.length} itens`)
            } else if (dataFallback?.data && Array.isArray(dataFallback.data)) {
              listFallback = dataFallback.data
              console.log(`[Mandatos] ✅ Fallback: Lista encontrada em data.data: ${listFallback.length} itens`)
            } else if (dataFallback?.condominios && Array.isArray(dataFallback.condominios)) {
              listFallback = dataFallback.condominios
              console.log(`[Mandatos] ✅ Fallback: Lista encontrada em data.condominios: ${listFallback.length} itens`)
            } else if (dataFallback?.result && Array.isArray(dataFallback.result)) {
              listFallback = dataFallback.result
              console.log(`[Mandatos] ✅ Fallback: Lista encontrada em data.result: ${listFallback.length} itens`)
            } else if (dataFallback?.list && Array.isArray(dataFallback.list)) {
              listFallback = dataFallback.list
              console.log(`[Mandatos] ✅ Fallback: Lista encontrada em data.list: ${listFallback.length} itens`)
            } else if (typeof dataFallback === 'object' && dataFallback !== null) {
              // Procurar qualquer array no objeto
              const keys = Object.keys(dataFallback)
              for (const key of keys) {
                if (Array.isArray(dataFallback[key])) {
                  listFallback = dataFallback[key]
                  console.log(`[Mandatos] ✅ Fallback: Lista encontrada na chave "${key}": ${listFallback.length} itens`)
                  break
                }
              }
            }
            
            console.log(`[Mandatos] 📋 Lista extraída do fallback: ${listFallback.length} condomínios`)
            
            if (Array.isArray(listFallback) && listFallback.length > 0) {
              todosCondominios = listFallback
              console.warn(`[Mandatos] ✅ Fallback retornou ${listFallback.length} condomínios`)
            } else {
              console.warn('[Mandatos] ⚠️ Fallback também não retornou condomínios')
            }
          } catch (fallbackErr) {
            console.warn('[Mandatos] ⚠️ Erro no fallback de condomínios:', fallbackErr)
          }
        }
        
        // Validação: não pode haver mais condomínios do que o esperado (68)
        if (todosCondominios.length > 68) {
          console.warn(`[Mandatos] ⚠️ ATENÇÃO: Encontrados ${todosCondominios.length} condomínios, mas a AB tem apenas 68 cadastrados!`)
        }
        
        // Se não encontrou nenhum condomínio, mostrar erro e parar
        if (todosCondominios.length === 0) {
          console.warn('[Mandatos] ⚠️ Nenhum condomínio encontrado!')
          setErro('Nenhum condomínio encontrado. Verifique se a empresa selecionada possui condomínios cadastrados.')
          setLoading(false)
          loadingRef.current = false
          return
        }
      } catch (err: any) {
        console.error('[Mandatos] Erro ao buscar condomínios:', err)
        if (err?.response?.status === 401) {
          tokenExpiredRef.current = true
          setErro('Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.')
        } else {
          setErro(`Erro ao buscar condomínios: ${err?.message || 'Erro desconhecido'}`)
        }
        setLoading(false)
        loadingRef.current = false
        return
      }
      
      // Passo 2: Buscar síndicos para cada condomínio (com limite e delay para evitar loop)
      const startTimeSindicos = Date.now()
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:477',message:'carregarMandatos - START buscar sindicos',data:{timestamp:startTimeSindicos,totalCondominios:todosCondominios.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'U'})}).catch(()=>{});
      // #endregion
      console.log('[Mandatos] ========== BUSCANDO SÍNDICOS PARA CADA CONDOMÍNIO ==========')
      let todasListas: any[] = []
      let todasListasFiltradas: any[] = [] // Declarar fora do try para evitar erro de escopo
      
      // Limitar a 100 condomínios para evitar loop infinito
      const condominiosParaProcessar = todosCondominios.slice(0, 100)
      console.log(`[Mandatos] Processando ${condominiosParaProcessar.length} de ${todosCondominios.length} condomínios (limite de 100)`)
      
      // Função auxiliar para delay entre requisições
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
      
      try {
        // Buscar síndicos para cada condomínio (com processamento em lotes para melhorar performance)
        // Processar em lotes de 20 condomínios em paralelo para acelerar (aumentado de 10 para 20)
        const batchSize = 20 // Processar 20 condomínios por vez (otimizado para melhor performance)
        let batchNumber = 0
        for (let batchStart = 0; batchStart < condominiosParaProcessar.length; batchStart += batchSize) {
          batchNumber++
          const batchStartTime = Date.now()
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:492',message:'carregarMandatos - START batch',data:{batchNumber,batchStart,batchSize,totalBatches:Math.ceil(condominiosParaProcessar.length/batchSize)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'V'})}).catch(()=>{});
          // #endregion
          const batch = condominiosParaProcessar.slice(batchStart, batchStart + batchSize)
          
          // Processar lote em paralelo (mas com limite)
          await Promise.all(batch.map(async (condominio, batchIndex) => {
            const i = batchStart + batchIndex
            const idCondominio = condominio.id_condominio_cond || condominio.ID_CONDOMINIO_COND || condominio.id
            if (!idCondominio) {
              console.warn(`[Mandatos] ⚠️ Condomínio sem ID:`, condominio)
              return
            }
            
            const nomeCondominio = condominio.st_fantasia_cond || condominio.ST_FANTASIA_COND || condominio.st_nome_cond || condominio.nome || 'Sem nome'
            
            // Verificar se já foi interrompido
            if (tokenExpiredRef.current) {
              console.warn('[Mandatos] ⚠️ Token expirado durante busca, parando...')
              return
            }
            
            // Buscar 'atuais' e 'passado' para este condomínio EM PARALELO (otimização de performance)
            const condominioStartTime = Date.now()
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:549',message:'carregarMandatos - START condominio',data:{idCondominio,nomeCondominio,index:i+1,total:condominiosParaProcessar.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'W'})}).catch(()=>{});
            // #endregion
            // Processar 'atuais' e 'passado' em paralelo em vez de sequencialmente
            const resultadosParalelos = await Promise.all(['atuais', 'passado'].map(async (status) => {
              const statusStartTime = Date.now()
              try {
                const resultados = await fazerRequisicaoCompleta(status, String(idCondominio))
                const statusTime = Date.now() - statusStartTime
                // #region agent log
                fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:555',message:'carregarMandatos - END status',data:{idCondominio,status,resultadosCount:resultados.length,timeMs:statusTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'W'})}).catch(()=>{});
                // #endregion
                if (resultados.length > 0) {
                  console.log(`[Mandatos] [${i + 1}/${condominiosParaProcessar.length}] ${nomeCondominio} (${status}): ${resultados.length} síndicos`)
                }
                return resultados
              } catch (err: any) {
                // Se for erro 401, parar tudo
                if (err?.response?.status === 401) {
                  tokenExpiredRef.current = true
                  throw err
                }
                console.warn(`[Mandatos] ⚠️ Erro ao buscar ${status} do condomínio ${nomeCondominio}:`, err)
                // Retornar array vazio em caso de erro para continuar processamento
                return []
              }
            }))
            // Combinar resultados de 'atuais' e 'passado'
            todasListas = todasListas.concat(resultadosParalelos.flat())
          }))
          
          const batchTime = Date.now() - batchStartTime
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:537',message:'carregarMandatos - END batch',data:{batchNumber,timeMs:batchTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'V'})}).catch(()=>{});
          // #endregion
          // Removido delay entre lotes para maximizar paralelismo e reduzir tempo total
          // O processamento em paralelo já é suficiente para não sobrecarregar a API
        }
        
        // Filtrar apenas síndicos de condomínios ativos (garantir que o condomínio está na lista de ativos)
        const idsCondominiosAtivos = new Set(todosCondominios.map(c => 
          String(c.id_condominio_cond || c.ID_CONDOMINIO_COND || c.id)
        ))
        
        console.log(`[Mandatos] Total de condomínios ativos: ${idsCondominiosAtivos.size}`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:595',message:'Filtro condominios ativos - IDs',data:{totalCondominiosAtivos:idsCondominiosAtivos.size,primeirosIds:Array.from(idsCondominiosAtivos).slice(0,5)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Y'})}).catch(()=>{});
        // #endregion
        
        // Filtrar apenas síndicos de condomínios ativos
        // Verificar campos de ID nos síndicos retornados
        const idsEncontradosNosSindicos = new Set<string>()
        const idsNaoEncontrados: string[] = []
        const todasListasFiltradas = todasListas.filter((m: any) => {
          const idCondominio = String(m.id_condominio_cond || m.ID_CONDOMINIO_COND || m.id_condominio || '')
          idsEncontradosNosSindicos.add(idCondominio)
          const estaAtivo = idsCondominiosAtivos.has(idCondominio)
          if (!estaAtivo && idCondominio) {
            idsNaoEncontrados.push(idCondominio)
          }
          return estaAtivo
        })
        
        console.log(`[Mandatos] Síndicos antes do filtro de condomínios ativos: ${todasListas.length}`)
        console.log(`[Mandatos] Síndicos após filtro (apenas condomínios ativos): ${todasListasFiltradas.length}`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:610',message:'Filtro condominios ativos - Resultado',data:{antesFiltro:todasListas.length,aposFiltro:todasListasFiltradas.length,idsUnicosNosSindicos:idsEncontradosNosSindicos.size,idsNaoEncontrados:idsNaoEncontrados.slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Y'})}).catch(()=>{});
        // #endregion
        
        const timeSindicos = Date.now() - startTimeSindicos
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:560',message:'carregarMandatos - END buscar sindicos',data:{totalSindicosAntesFiltro:todasListas.length,totalSindicosAposFiltro:todasListasFiltradas.length,timeMs:timeSindicos},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'U'})}).catch(()=>{});
        // #endregion
        console.log(`[Mandatos] ✅ Total de síndicos encontrados (apenas condomínios ativos): ${todasListasFiltradas.length}`)
        
        // Validação: não pode haver mais síndicos do que condomínios
        if (todasListasFiltradas.length > todosCondominios.length) {
          console.warn(`[Mandatos] ⚠️ ATENÇÃO: Encontrados ${todasListasFiltradas.length} síndicos, mas apenas ${todosCondominios.length} condomínios!`)
          console.warn(`[Mandatos] ⚠️ Isso pode indicar duplicatas ou cargos inválidos sendo incluídos.`)
        }
      } catch (err: any) {
        console.error('[Mandatos] Erro ao buscar síndicos:', err)
        if (err?.response?.status === 401) {
          tokenExpiredRef.current = true
          setErro('Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.')
        } else {
          setErro(`Erro ao buscar síndicos: ${err?.message || 'Erro desconhecido'}`)
        }
        setLoading(false)
        loadingRef.current = false
        // Garantir que todasListasFiltradas está definida mesmo em caso de erro
        todasListasFiltradas = todasListas.length > 0 ? todasListas : []
        return
      }
      
      // Garantir que todasListasFiltradas está definida antes de usar
      if (!todasListasFiltradas || todasListasFiltradas.length === 0) {
        console.warn('[Mandatos] ⚠️ todasListasFiltradas está vazia, usando todasListas como fallback')
        todasListasFiltradas = todasListas
      }
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:652',message:'RESUMO FINAL - Inicio processamento',data:{todasListas:todasListas.length,todasListasFiltradas:todasListasFiltradas.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Z'})}).catch(()=>{});
      // #endregion
      console.log('[Mandatos] ========== RESUMO FINAL ==========')
      console.log('[Mandatos] Lista total combinada (apenas condomínios ativos):', todasListasFiltradas.length, 'itens')
      if (todasListasFiltradas.length > 0) {
        console.log('[Mandatos] Primeiros itens da lista:', todasListasFiltradas.slice(0, 3))
        console.log('[Mandatos] Últimos itens da lista:', todasListasFiltradas.slice(-3))
        // Log detalhado: mostrar quantos itens únicos temos por condomínio
        const contagemPorCondominio = new Map<string, number>()
        todasListasFiltradas.forEach((item: any) => {
          const cond = item.st_nome_cond || item.ST_NOME_COND || item.condominio || 'Sem nome'
          contagemPorCondominio.set(cond, (contagemPorCondominio.get(cond) || 0) + 1)
        })
        console.log('[Mandatos] Contagem de itens por condomínio:', Array.from(contagemPorCondominio.entries()).slice(0, 10))
        console.log('[Mandatos] Total de condomínios únicos na lista (apenas ativos):', contagemPorCondominio.size)
      } else {
        console.warn('[Mandatos] ⚠️ NENHUM ITEM ENCONTRADO! Verifique:')
        console.warn('[Mandatos]   1. Se a busca de condomínios funcionou')
        console.warn('[Mandatos]   2. Se a busca de responsáveis legais retornou dados')
        console.warn('[Mandatos]   3. Se há erros 422 nas requisições')
      }
      
      // Mapear os dados da API para o formato Mandato
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      
      // Log detalhado dos dados recebidos (após filtro de condomínios ativos)
      console.log('Itens recebidos da API (apenas condomínios ativos):', todasListasFiltradas.length)
      if (todasListasFiltradas.length > 0) {
        todasListasFiltradas.slice(0, 5).forEach((m: any, idx: number) => {
          const cargo = m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || ''
          console.log(`Item ${idx + 1}: cargo="${cargo}", condomínio="${m.st_nome_cond || m.ST_NOME_COND || m.condominio}"`)
        })
        
        // Mostrar todos os cargos únicos encontrados
        const cargosUnicos = new Set(todasListasFiltradas.map((m: any) => m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || 'Sem cargo'))
        console.log('Cargos únicos encontrados:', Array.from(cargosUnicos))
      }
      
      // Filtrar apenas cargos que são variações de "SINDICO" ou "SINDICA"
      // Função para remover acentos
      const removerAcentos = (str: string): string => {
        return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      }
      
      const isCargoSindico = (cargo: string): boolean => {
        if (!cargo || typeof cargo !== 'string') {
          return false
        }
        // Remover espaços extras, converter para maiúsculas e remover acentos
        const cargoNormalizado = removerAcentos(cargo.trim().toUpperCase().replace(/\s+/g, ' '))
        
        // Aceitar APENAS as variações exatas: SINDICO ou SINDICA (sem sufixos)
        // Não aceitar: SINDICO PRO TEMPORE, SINDICA SUBSTITUTA, etc.
        const eSindicoExato = cargoNormalizado === 'SINDICO'
        const eSindicaExata = cargoNormalizado === 'SINDICA'
        
        return eSindicoExato || eSindicaExata
      }
      
      // Log de debug: mostrar alguns cargos antes do filtro
      const cargosAntesFiltro = todasListasFiltradas.slice(0, 20).map((m: any) => {
        const cargo = m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || ''
        const passa = isCargoSindico(cargo)
        const cargoNormalizado = removerAcentos(cargo.trim().toUpperCase().replace(/\s+/g, ' '))
        return { cargo, cargoNormalizado, passa }
      })
      console.log('[Mandatos] Exemplos de cargos antes do filtro (primeiros 20):', cargosAntesFiltro)
      
      // Mostrar cargos que foram REJEITADOS (para debug)
      const cargosRejeitados = todasListasFiltradas
        .filter((m: any) => {
          const cargo = m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || ''
          return !isCargoSindico(cargo)
        })
        .slice(0, 10)
        .map((m: any) => {
          const cargo = m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || ''
          const cargoNormalizado = removerAcentos(cargo.trim().toUpperCase().replace(/\s+/g, ' '))
          return { cargo, cargoNormalizado }
        })
      if (cargosRejeitados.length > 0) {
        console.log('[Mandatos] Exemplos de cargos REJEITADOS (primeiros 10):', cargosRejeitados)
      }
      
      // Filtrar por cargo SINDICO/SINDICA (aplicado após filtro de condomínios ativos)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:728',message:'Filtro cargo - ANTES',data:{totalAntesFiltroCargo:todasListasFiltradas.length,primeirosCargos:todasListasFiltradas.slice(0,10).map((m:any)=>({cargo:m.st_cargo_sin||m.ST_CARGO_SIN||m.cargo||'Sem cargo',condominio:m.st_nome_cond||m.ST_NOME_COND||m.condominio||'Sem nome'}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Z'})}).catch(()=>{});
      // #endregion
      const todasListasFiltradasPorCargo = todasListasFiltradas.filter((m: any) => {
        const cargo = m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || ''
        const passa = isCargoSindico(cargo)
        if (!passa && cargo) {
          // Log alguns cargos que foram rejeitados para debug
          console.log(`[Mandatos] Cargo rejeitado: "${cargo}"`)
        }
        return passa
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:735',message:'Filtro cargo - DEPOIS',data:{totalAposFiltroCargo:todasListasFiltradasPorCargo.length,primeirosCargosAprovados:todasListasFiltradasPorCargo.slice(0,5).map((m:any)=>({cargo:m.st_cargo_sin||m.ST_CARGO_SIN||m.cargo||'Sem cargo'}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Z'})}).catch(()=>{});
      // #endregion
      console.log(`[Mandatos] Filtrando cargos de SINDICO/SINDICA: ${todasListasFiltradas.length} -> ${todasListasFiltradasPorCargo.length} itens`)
      
      // Mostrar cargos únicos após filtro
      const cargosUnicosFiltrados = new Set(todasListasFiltradasPorCargo.map((m: any) => m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || 'Sem cargo'))
      console.log('[Mandatos] Cargos únicos após filtro (SINDICO/SINDICA):', Array.from(cargosUnicosFiltrados))
      
      // Log detalhado: mostrar quantos síndicos temos por condomínio após filtro
      const contagemPorCondominioFiltrado = new Map<string, number>()
      todasListasFiltradasPorCargo.forEach((item: any) => {
        const cond = item.st_nome_cond || item.ST_NOME_COND || item.condominio || 'Sem nome'
        contagemPorCondominioFiltrado.set(cond, (contagemPorCondominioFiltrado.get(cond) || 0) + 1)
      })
      console.log('[Mandatos] Contagem de síndicos por condomínio (após filtro de cargo):', Array.from(contagemPorCondominioFiltrado.entries()).slice(0, 20))
      console.log('[Mandatos] Total de condomínios únicos após filtro de cargo:', contagemPorCondominioFiltrado.size)
      console.log('[Mandatos] Total de síndicos únicos (sem deduplicação):', todasListasFiltradasPorCargo.length)
      
      // Verificar se há cargos que não deveriam passar
      const cargosInvalidos = todasListasFiltradasPorCargo.filter((m: any) => {
        const cargo = m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || ''
        return !isCargoSindico(cargo)
      })
      if (cargosInvalidos.length > 0) {
        console.error('[Mandatos] ⚠️ ERRO: Encontrados cargos inválidos após filtro:', cargosInvalidos.slice(0, 5).map((m: any) => m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo))
      }
      
      // Análise detalhada dos condomínios (após filtro)
      const condominiosUnicosSet = new Set(todasListasFiltradasPorCargo.map((m: any) => m.st_nome_cond || m.ST_NOME_COND || m.condominio || 'Sem nome'))
      const condominiosComContagem = Array.from(condominiosUnicosSet).map(cond => ({
        nome: cond,
        quantidade: todasListasFiltradasPorCargo.filter((m: any) => (m.st_nome_cond || m.ST_NOME_COND || m.condominio || 'Sem nome') === cond).length
      }))
      
      console.log('Condomínios únicos encontrados (após filtro):', condominiosUnicosSet.size)
      console.log('Distribuição por condomínio:', condominiosComContagem)
      
      if (condominiosUnicosSet.size === 1) {
        console.warn('⚠️ ATENÇÃO: Apenas 1 condomínio encontrado! Isso pode indicar:')
        console.warn('  1. A API está retornando apenas dados de um condomínio')
        console.warn('  2. Há um filtro sendo aplicado na API que limita os resultados')
        console.warn('  3. A paginação não está funcionando corretamente')
        console.warn('  4. O parâmetro idCondominio pode estar sendo usado implicitamente')
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:777',message:'Mapeamento - ANTES',data:{totalParaMapear:todasListasFiltradasPorCargo.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Z'})}).catch(()=>{});
      // #endregion
      const mapped: Mandato[] = todasListasFiltradasPorCargo
        .map((m: any) => {
          // Determinar status baseado nas datas
          let status: 'ativo' | 'encerrado' | 'futuro' = 'ativo'
          
          const dataEntrada = m.dt_entrada_sin ? parseDate(m.dt_entrada_sin) : null
          const dataSaida = m.dt_saida_sin ? parseDate(m.dt_saida_sin) : null
          
          if (dataSaida && dataSaida < hoje) {
            status = 'encerrado'
          } else if (dataEntrada && dataEntrada > hoje) {
            status = 'futuro'
          } else if (dataEntrada && dataEntrada <= hoje && (!dataSaida || dataSaida >= hoje)) {
            status = 'ativo'
          }

          // Formatar datas para dd/mm/yyyy ao mapear
          const dataEntradaRaw = m.dt_entrada_sin || m.DT_ENTRADA_SIN || m.data_entrada || ''
          const dataSaidaRaw = m.dt_saida_sin || m.DT_SAIDA_SIN || m.data_saida || null
          
          // Formatar datas para dd/mm/yyyy
          const formatarDataParaDDMMYYYY = (dateString: string | null): string => {
            if (!dateString || dateString.trim() === '') return '-'
            
            // Se já está no formato dd/mm/yyyy, retornar como está
            if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString.trim())) {
              return dateString.trim()
            }
            
            // Tentar parsear e formatar
            const date = parseDate(dateString)
            if (!date) {
              // Se não conseguiu parsear, tentar formatar diretamente se for ISO
              try {
                const dateISO = new Date(dateString)
                if (!isNaN(dateISO.getTime())) {
                  const dia = String(dateISO.getDate()).padStart(2, '0')
                  const mes = String(dateISO.getMonth() + 1).padStart(2, '0')
                  const ano = dateISO.getFullYear()
                  return `${dia}/${mes}/${ano}`
                }
              } catch {
                // Ignorar erro
              }
              return dateString // Retornar original se não conseguir formatar
            }
            
            // Formatar como dd/mm/yyyy
            const dia = String(date.getDate()).padStart(2, '0')
            const mes = String(date.getMonth() + 1).padStart(2, '0')
            const ano = date.getFullYear()
            return `${dia}/${mes}/${ano}`
          }

          return {
            id: String(m.id_sindico_sin || m.ID_SINDICO_SIN || m.id || Math.random()),
            condominio: m.st_nome_cond || m.ST_NOME_COND || m.condominio || 'Não informado',
            nomeFantasia: m.st_fantasia_cond || m.ST_FANTASIA_COND || m.nome_fantasia || m.condominio || 'Não informado',
            nomeResponsavel: m.st_nome_sin || m.ST_NOME_SIN || m.nome || 'Não informado',
            cargo: m.st_cargo_sin || m.ST_CARGO_SIN || m.cargo || 'Não informado',
            dataEntrada: formatarDataParaDDMMYYYY(dataEntradaRaw),
            dataSaida: formatarDataParaDDMMYYYY(dataSaidaRaw),
            email: m.st_email_sin || m.ST_EMAIL_SIN || m.email || '',
            telefone: m.st_telefone_sin || m.ST_TELEFONE_SIN || m.telefone || '',
            celular: m.st_celular_sin || m.ST_CELULAR_SIN || m.celular || '',
            status,
            observacoes: m.st_observacao_sin || m.ST_OBSERVACAO_SIN || m.observacoes || undefined,
          }
        })
        // Ordenar por data de saída em ordem crescente (nulls por último)
        // IMPORTANTE: As datas já estão formatadas como dd/mm/yyyy, então precisamos parsear novamente para ordenar
        .sort((a, b) => {
          const dataSaidaA = a.dataSaida && a.dataSaida !== '-' ? parseDate(a.dataSaida) : null
          const dataSaidaB = b.dataSaida && b.dataSaida !== '-' ? parseDate(b.dataSaida) : null
          
          // Se ambos têm data de saída, ordena crescente (mais antiga primeiro)
          if (dataSaidaA && dataSaidaB) {
            return dataSaidaA.getTime() - dataSaidaB.getTime()
          }
          // Se apenas A tem data, A vem primeiro (antes dos nulls)
          if (dataSaidaA && !dataSaidaB) {
            return -1
          }
          // Se apenas B tem data, B vem primeiro (antes dos nulls)
          if (!dataSaidaA && dataSaidaB) {
            return 1
          }
          // Se nenhum tem data, ordena por data de entrada crescente como fallback
          const dataEntradaA = a.dataEntrada && a.dataEntrada !== '-' ? parseDate(a.dataEntrada) : null
          const dataEntradaB = b.dataEntrada && b.dataEntrada !== '-' ? parseDate(b.dataEntrada) : null
          if (dataEntradaA && dataEntradaB) {
            return dataEntradaA.getTime() - dataEntradaB.getTime()
          }
          return 0
        })
      
      // Verificação final: garantir que todos os cargos mapeados são SINDICO/SINDICA
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:891',message:'Filtro final - ANTES',data:{totalMapped:mapped.length,primeirosCargos:mapped.slice(0,5).map(m=>({cargo:m.cargo,condominio:m.condominio}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Z'})}).catch(()=>{});
      // #endregion
      const mappedFiltrado = mapped.filter(item => {
        const passa = isCargoSindico(item.cargo)
        if (!passa) {
          console.warn(`[Mandatos] ⚠️ Cargo removido no filtro final: "${item.cargo}"`)
        }
        return passa
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:899',message:'Filtro final - DEPOIS',data:{totalMappedFiltrado:mappedFiltrado.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'Z'})}).catch(()=>{});
      // #endregion
      console.log(`[Mandatos] Dados mapeados e ordenados: ${mapped.length} -> ${mappedFiltrado.length} itens (apenas cargos SINDICO/SINDICA, ordenados por data de saída)`)
      
      // Remover duplicatas: manter apenas um síndico por condomínio (o mais recente/ativo)
      // Como há 68 condomínios, não pode haver mais de 68 síndicos
      const condominiosUnicosMap = new Map<string, Mandato>()
      
      // Função para normalizar nome do condomínio
      const normalizarNomeCondominio = (nome: string): string => {
        return removerAcentos(nome.trim().toUpperCase().replace(/\s+/g, ' '))
      }
      
      mappedFiltrado.forEach((mandato) => {
        const nomeCondominioNormalizado = normalizarNomeCondominio(mandato.condominio)
        const mandatoExistente = condominiosUnicosMap.get(nomeCondominioNormalizado)
        
        if (!mandatoExistente) {
          // Primeira ocorrência deste condomínio
          condominiosUnicosMap.set(nomeCondominioNormalizado, mandato)
        } else {
          // Já existe um síndico para este condomínio - decidir qual manter
          // Prioridade: 1. Status ativo, 2. Data de entrada mais recente, 3. Data de fim mais distante
          const dataEntradaAtual = mandato.dataEntrada && mandato.dataEntrada !== '-' ? parseDate(mandato.dataEntrada) : null
          const dataEntradaExistente = mandatoExistente.dataEntrada && mandatoExistente.dataEntrada !== '-' ? parseDate(mandatoExistente.dataEntrada) : null
          const dataFimAtual = mandato.dataSaida && mandato.dataSaida !== '-' ? parseDate(mandato.dataSaida) : null
          const dataFimExistente = mandatoExistente.dataSaida && mandatoExistente.dataSaida !== '-' ? parseDate(mandatoExistente.dataSaida) : null
          
          let deveSubstituir = false
          
          // Priorizar mandatos ativos
          if (mandato.status === 'ativo' && mandatoExistente.status !== 'ativo') {
            deveSubstituir = true
          } else if (mandato.status !== 'ativo' && mandatoExistente.status === 'ativo') {
            deveSubstituir = false
          } else if (dataEntradaAtual && dataEntradaExistente) {
            // Se ambos têm mesmo status, comparar por data de entrada (mais recente = melhor)
            if (dataEntradaAtual.getTime() > dataEntradaExistente.getTime()) {
              deveSubstituir = true
            } else if (dataEntradaAtual.getTime() === dataEntradaExistente.getTime()) {
              // Se datas de entrada são iguais, comparar por data de fim (mais distante = melhor)
              if (dataFimAtual && dataFimExistente) {
                if (dataFimAtual.getTime() > dataFimExistente.getTime()) {
                  deveSubstituir = true
                }
              } else if (dataFimAtual && !dataFimExistente) {
                // Atual tem data de fim, existente não - preferir atual
                deveSubstituir = true
              }
            }
          } else if (dataEntradaAtual && !dataEntradaExistente) {
            // Mandato atual tem data, existente não tem - substituir
            deveSubstituir = true
          }
          
          if (deveSubstituir) {
            condominiosUnicosMap.set(nomeCondominioNormalizado, mandato)
            console.log(`[Mandatos] Substituindo síndico do condomínio "${mandato.condominio}"`)
          }
        }
      })
      
      let mandatosUnicos = Array.from(condominiosUnicosMap.values())
      console.log(`[Mandatos] Removendo duplicatas: ${mappedFiltrado.length} -> ${mandatosUnicos.length} mandatos únicos (um por condomínio)`)
      
      // Reordenar após remover duplicatas (por data de saída crescente)
      mandatosUnicos = mandatosUnicos.sort((a, b) => {
        const dataSaidaA = a.dataSaida && a.dataSaida !== '-' ? parseDate(a.dataSaida) : null
        const dataSaidaB = b.dataSaida && b.dataSaida !== '-' ? parseDate(b.dataSaida) : null
        
        // Se ambos têm data de saída, ordena crescente (mais antiga primeiro)
        if (dataSaidaA && dataSaidaB) {
          return dataSaidaA.getTime() - dataSaidaB.getTime()
        }
        // Se apenas A tem data, A vem primeiro (antes dos nulls)
        if (dataSaidaA && !dataSaidaB) {
          return -1
        }
        // Se apenas B tem data, B vem primeiro (antes dos nulls)
        if (!dataSaidaA && dataSaidaB) {
          return 1
        }
        // Se nenhum tem data, ordena por data de entrada crescente como fallback
        const dataEntradaA = a.dataEntrada && a.dataEntrada !== '-' ? parseDate(a.dataEntrada) : null
        const dataEntradaB = b.dataEntrada && b.dataEntrada !== '-' ? parseDate(b.dataEntrada) : null
        if (dataEntradaA && dataEntradaB) {
          return dataEntradaA.getTime() - dataEntradaB.getTime()
        }
        return 0
      })
      
      if (mandatosUnicos.length > 68) {
        console.warn(`[Mandatos] ⚠️ ATENÇÃO: Ainda há ${mandatosUnicos.length} síndicos únicos, mas deveria haver no máximo 68!`)
        console.warn(`[Mandatos] ⚠️ Isso pode indicar que há condomínios com nomes diferentes mas que são o mesmo condomínio.`)
      }
      
      // Log dos cargos únicos no resultado final
      const cargosFinais = new Set(mappedFiltrado.map(m => m.cargo))
      console.log('[Mandatos] Cargos únicos no resultado final:', Array.from(cargosFinais))
      
      // REMOVIDO: Lógica de deduplicação por condomínio
      // O usuário quer ver TODOS os síndicos, não apenas um por condomínio
      // Se houver múltiplos síndicos para o mesmo condomínio, mostrar todos
      
      console.log(`[Mandatos] Total de mandatos encontrados: ${mappedFiltrado.length}`)
      
      // Log de condomínios
      const nomesCondominios = mappedFiltrado.map(m => m.condominio)
      const condominiosUnicos = new Set(nomesCondominios)
      console.log(`[Mandatos] ✅ Total de mandatos: ${mappedFiltrado.length}`)
      console.log(`[Mandatos] ✅ Condomínios únicos: ${condominiosUnicos.size}`)
      if (nomesCondominios.length > 0 && nomesCondominios.length <= 20) {
        console.log('[Mandatos] Lista de condomínios:', nomesCondominios)
      } else if (nomesCondominios.length > 20) {
        console.log('[Mandatos] Primeiros 10 condomínios:', nomesCondominios.slice(0, 10))
        console.log('[Mandatos] Últimos 10 condomínios:', nomesCondominios.slice(-10))
      }
      
      console.log('[Mandatos] ========== FINALIZANDO CARREGAMENTO ==========')
      console.log('[Mandatos] Total de mandatos encontrados (antes de remover duplicatas):', mappedFiltrado.length)
      console.log('[Mandatos] Total de mandatos únicos (após remover duplicatas):', mandatosUnicos.length)
      
      if (mandatosUnicos.length === 0) {
        console.warn('[Mandatos] ⚠️ NENHUM MANDATO ENCONTRADO!')
        console.warn('[Mandatos] Verificando possíveis causas:')
        console.warn('[Mandatos] - Lista total antes do filtro:', todasListas.length)
        console.warn('[Mandatos] - Lista após filtro de condomínios ativos:', todasListasFiltradas.length)
        console.warn('[Mandatos] - Lista após filtro de cargo:', todasListasFiltradasPorCargo.length)
        console.warn('[Mandatos] - Lista após mapeamento:', mapped.length)
        console.warn('[Mandatos] - Lista após filtro final:', mappedFiltrado.length)
        console.warn('[Mandatos] - Lista após remover duplicatas:', mandatosUnicos.length)
        
        // Se não há dados, definir array vazio mas não mostrar erro
        setData([])
        setErro(null) // Limpar erro se não há dados (pode ser que simplesmente não existam mandatos)
      } else {
        console.log('[Mandatos] ✅ Definindo', mandatosUnicos.length, 'mandatos únicos no estado')
        
        // Validação final: não pode haver mais síndicos do que condomínios (68)
        if (mandatosUnicos.length > 68) {
          console.warn(`[Mandatos] ⚠️ ATENÇÃO: Encontrados ${mandatosUnicos.length} síndicos únicos, mas a AB tem apenas 68 condomínios!`)
          console.warn(`[Mandatos] ⚠️ Verificando se há condomínios com nomes diferentes mas que são o mesmo...`)
          
          // Mostrar cargos únicos para debug
          const cargosUnicos = new Set(mandatosUnicos.map(m => m.cargo))
          console.warn(`[Mandatos] Cargos únicos encontrados:`, Array.from(cargosUnicos))
          
          // Mostrar condomínios únicos
          const condominiosUnicos = new Set(mandatosUnicos.map(m => m.condominio))
          console.warn(`[Mandatos] Condomínios únicos: ${condominiosUnicos.size}`)
        }
        
        setData(mandatosUnicos)
        const timeTotal = Date.now() - startTimeTotal
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Mandatos.tsx:1003',message:'carregarMandatos - COMPLETED',data:{totalMandatos:mandatosUnicos.length,timeMs:timeTotal},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'U'})}).catch(()=>{});
        // #endregion
      }
  } catch (e: any) {
    let errorMessage = e?.message || String(e)
    
    // Melhorar mensagens de erro comuns
    if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
      errorMessage = 'Erro de conexão: Não foi possível conectar ao servidor. Verifique sua conexão ou se o servidor está rodando.'
    } else if (errorMessage.includes('Timeout')) {
      errorMessage = 'Timeout: A requisição demorou muito para responder.\n\n' +
        'Possíveis causas:\n' +
        '• A API está lenta ou sobrecarregada\n' +
        '• Problemas de conexão com o servidor\n' +
        '• A empresa selecionada pode não ter dados ou ter muitos registros\n\n' +
        'Tente:\n' +
        '• Selecionar outra empresa no seletor do topo\n' +
        '• Verificar sua conexão com a internet\n' +
        '• Tentar novamente em alguns instantes'
    } else if (errorMessage.includes('401') || errorMessage.includes('expirado') || errorMessage.includes('expired')) {
      tokenExpiredRef.current = true
      errorMessage = 'Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.'
    } else if (errorMessage.includes('403') || errorMessage.includes('Permissão') || errorMessage.includes('permissão')) {
      errorMessage = 'Acesso negado: Você não tem permissão para acessar este recurso.\n\n' + 
        (errorMessage.includes('abimoveis') ? 'Tente selecionar outra empresa no seletor no topo da página.' : '')
    } else if (errorMessage.includes('404')) {
      errorMessage = 'Recurso não encontrado (404): O endpoint não existe ou foi movido.'
    }
    
    setErro(errorMessage)
    console.error('Erro ao carregar mandatos:', e)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
      loadingRef.current = false
    }
  }, [token, companyId, parseDate]) // parseDate é estável, não causa loop

  // Ref para rastrear se já carregou os dados para este token/companyId
  const lastLoadRef = useRef<{ token: string | null; companyId: string | null; timestamp: number }>({ 
    token: null, 
    companyId: null,
    timestamp: 0
  })
  
  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    
    // Só carregar se houver token
    if (!token) {
      console.log('[Mandatos] Aguardando token...')
      setLoading(false)
      setErro('Token não disponível. Aguarde a autenticação.')
      return
    }
    
    // Verificar se já carregou para este token/companyId (com debounce de 500ms)
    const currentKey = `${token}-${companyId}`
    const lastKey = `${lastLoadRef.current.token}-${lastLoadRef.current.companyId}`
    const timeSinceLastLoad = Date.now() - lastLoadRef.current.timestamp
    
    if (currentKey === lastKey && timeSinceLastLoad < 500) {
      console.log('[Mandatos] Já carregou para este token/companyId recentemente, ignorando...')
      return
    }
    
    // Evitar múltiplas chamadas
    if (loadingRef.current) {
      console.log('[Mandatos] Já está carregando, ignorando...')
      return
    }
    
    if (!tokenExpiredRef.current) {
      // Debounce: aguardar 300ms antes de carregar para evitar múltiplas chamadas rápidas
      timeoutId = setTimeout(() => {
        if (!isMounted) return
        
        // Verificar novamente se já está carregando
        if (loadingRef.current) {
          console.log('[Mandatos] Já está carregando (após debounce), ignorando...')
          return
        }
        
        // Marcar que está carregando para este token/companyId ANTES de chamar
        lastLoadRef.current = { token, companyId, timestamp: Date.now() }
        carregarMandatos()
      }, 300)
    }
    
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId]) // Não incluir carregarMandatos para evitar loops

  // Filtrar e ordenar dados
  // Log para debug (apenas quando há mudanças significativas)
  const dataLengthRef = useRef(0)
  if (data.length !== dataLengthRef.current) {
    dataLengthRef.current = data.length
    console.log('[Mandatos] Dados no estado:', data.length, 'itens')
    if (data.length > 0) {
      const statusCount = data.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      console.log('[Mandatos] Distribuição por status:', statusCount)
    }
  }

  const filteredData = useMemo(() => {
    return data
      .filter(item => {
        // Mostrar TODOS os mandatos (ativos, encerrados e futuros)
        // Removido filtro de status para mostrar todos
        return true
      })
    .filter(item => {
      const matchesSearch = !searchTerm || 
        item.condominio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.nomeResponsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.cargo.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.email.toLowerCase().includes(searchTerm.toLowerCase())
      
      return matchesSearch
    })
    // Ordenar conforme seleção do usuário
    .sort((a, b) => {
      if (ordenacao === 'nome') {
        // Ordenar por nome do condomínio (A-Z)
        return a.condominio.localeCompare(b.condominio, 'pt-BR', { sensitivity: 'base' })
      } else {
        // Ordenar por data de fim (Saída) em ordem crescente
        // Vencidos aparecem primeiro (datas passadas), depois próximos a vencer
        const dataFimA = a.dataSaida ? parseDate(a.dataSaida) : null
        const dataFimB = b.dataSaida ? parseDate(b.dataSaida) : null
        
        // Se ambos têm data de fim, ordena crescente (vencimentos mais próximos primeiro)
        // Datas passadas (vencidas) terão valores menores e aparecerão primeiro
        if (dataFimA && dataFimB) {
          return dataFimA.getTime() - dataFimB.getTime()
        }
        // Se apenas A tem data, A vem primeiro (antes dos sem data)
        if (dataFimA && !dataFimB) {
          return -1
        }
        // Se apenas B tem data, B vem primeiro (antes dos sem data)
        if (!dataFimA && dataFimB) {
          return 1
        }
        // Se nenhum tem data, ordena por data de início como fallback
        const dataInicioA = a.dataEntrada ? parseDate(a.dataEntrada) : null
        const dataInicioB = b.dataEntrada ? parseDate(b.dataEntrada) : null
        if (dataInicioA && dataInicioB) {
          return dataInicioA.getTime() - dataInicioB.getTime()
        }
        return 0
      }
    })
  }, [data, searchTerm, ordenacao, parseDate])

  const getStatusBadge = (status: string) => {
    const styles = {
      ativo: "bg-green-100 text-green-800",
      encerrado: "bg-gray-100 text-gray-800",
      futuro: "bg-blue-100 text-blue-800"
    }
    return (
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    try {
      const date = parseDate(dateString)
      if (!date) return dateString
      
      // Formatar sempre como dd/mm/yyyy
      const dia = String(date.getDate()).padStart(2, '0')
      const mes = String(date.getMonth() + 1).padStart(2, '0')
      const ano = date.getFullYear()
      return `${dia}/${mes}/${ano}`
    } catch {
      return dateString
    }
  }

  // Calcular dias até vencimento do mandato
  const calcularDiasAteVencimento = (dataFim: string | null): number | null => {
    if (!dataFim) return null
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const fim = parseDate(dataFim)
    if (!fim) return null
    fim.setHours(0, 0, 0, 0)
    const diffTime = fim.getTime() - hoje.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  // Determinar estilo da linha baseado no status do mandato
  const getRowStyle = (item: Mandato): string => {
    const diasAteVencimento = calcularDiasAteVencimento(item.dataSaida)
    
    if (diasAteVencimento === null) {
      // Sem data de fim - estilo normal
      return 'border-b border-gray-200 hover:bg-gray-50'
    }
    
    if (diasAteVencimento < 0) {
      // Mandato vencido - fundo vermelho
      return 'border-b border-gray-200 bg-red-100 hover:bg-red-200'
    } else if (diasAteVencimento <= 60) {
      // Até 60 dias para vencer - fundo amarelo
      return 'border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200'
    }
    
    // Mais de 60 dias - estilo normal
    return 'border-b border-gray-200 hover:bg-gray-50'
  }
  
  // Calcular previsão de assembleia (30 dias antes do vencimento)
  const calcularPrevisaoAssembleia = (dataFim: string | null): string => {
    if (!dataFim) return '-'
    const fim = parseDate(dataFim)
    if (!fim) return '-'
    
    // Assembleia 30 dias antes do vencimento
    const previsao = new Date(fim)
    previsao.setDate(previsao.getDate() - 30)
    
    // Formatar diretamente como dd/mm/yyyy
    const dia = String(previsao.getDate()).padStart(2, '0')
    const mes = String(previsao.getMonth() + 1).padStart(2, '0')
    const ano = previsao.getFullYear()
    return `${dia}/${mes}/${ano}`
  }

  // Obter texto da previsão de eleição
  const getPrevisaoEleicao = (item: Mandato): string => {
    const diasAteVencimento = calcularDiasAteVencimento(item.dataSaida)
    
    if (diasAteVencimento === null) {
      return '-'
    }
    
    if (diasAteVencimento < 0) {
      return `Vencido há ${Math.abs(diasAteVencimento)} dia(s)`
    }
    
    if (diasAteVencimento <= 30) {
      return `⚠️ ${diasAteVencimento} dia(s) - ALERTA`
    }
    
    if (diasAteVencimento <= 60) {
      return `${diasAteVencimento} dia(s)`
    }
    
    return `${diasAteVencimento} dia(s)`
  }

  // Carregar dados do banco ao montar componente
  useEffect(() => {
    const assembleias = carregarAssembleias()
    const map = new Map<string, AssembleiaData>()
    assembleias.forEach(a => map.set(a.id, a))
    setAssembleiasDB(map)
  }, [])

  // Mesclar dados do mandato com dados do banco (otimizado - usa Map em memória)
  const dadosComAssembleias = useMemo(() => {
    const novasAssembleias: AssembleiaData[] = []
    const novoMap = new Map(assembleiasDB)
    
    const resultado = filteredData.map(item => {
      const previsaoAssembleia = calcularPrevisaoAssembleia(item.dataSaida)
      const assembleia = mesclarDadosMandatoComAssembleia(
        item.condominio,
        item.nomeResponsavel,
        item.dataEntrada || '-',
        item.dataSaida || '-',
        previsaoAssembleia,
        assembleiasDB // Passar Map em memória ao invés de ler do localStorage
      )
      
      // Adicionar ao Map se não existir
      if (!novoMap.has(assembleia.id)) {
        novoMap.set(assembleia.id, assembleia)
        novasAssembleias.push(assembleia)
      }
      
      return {
        ...item,
        assembleia
      }
    })
    
    // Atualizar estado e salvar em batch de forma assíncrona (não bloqueia renderização)
    if (novasAssembleias.length > 0) {
      // Atualizar estado primeiro (rápido)
      setAssembleiasDB(novoMap)
      
      // Salvar no localStorage em batch depois (não bloqueia - uma única escrita)
      Promise.resolve().then(() => {
        salvarAssembleiasEmBatch(novasAssembleias)
      })
    }
    
    return resultado
  }, [filteredData, assembleiasDB])

  const iniciarEdicao = (id: string, dataRealizada: string) => {
    setEditandoId(id)
    setDataRealizadaEditando(dataRealizada || '')
  }

  const salvarEdicao = (id: string) => {
    if (dataRealizadaEditando && !/^\d{2}\/\d{2}\/\d{4}$/.test(dataRealizadaEditando.trim())) {
      alert('Formato de data inválido. Use dd/mm/yyyy (ex: 15/11/2025)')
      return
    }

    atualizarDataRealizada(id, dataRealizadaEditando.trim())
    
    const assembleias = carregarAssembleias()
    const map = new Map<string, AssembleiaData>()
    assembleias.forEach(a => map.set(a.id, a))
    setAssembleiasDB(map)
    
    setEditandoId(null)
    setDataRealizadaEditando('')
  }

  const cancelarEdicao = () => {
    setEditandoId(null)
    setDataRealizadaEditando('')
  }

      return (
        <div>
          {/* Box com informações do Token JWT */}
          <TokenInfo token={token} />

          {/* Mensagem de erro */}
          {erro && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-semibold mb-2">Erro ao carregar mandatos:</p>
          <p className="text-red-700 text-sm mb-3 whitespace-pre-line">{erro}</p>
          {erro.includes('expirado') || erro.includes('expired') ? (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-xs font-semibold mb-1">Como renovar o token:</p>
              <code className="block text-xs bg-gray-100 p-2 rounded mb-2">./iap auth</code>
              <p className="text-yellow-700 text-xs">Execute este comando no terminal e depois recarregue a página.</p>
            </div>
          ) : (
            <p className="text-red-600 text-xs mb-2">Verifique o console do navegador (F12) para mais detalhes.</p>
          )}
          <button
            onClick={() => {
              tokenExpiredRef.current = false
              carregarMandatos()
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Título - Estilo da imagem */}
      <h1 className="text-xl font-semibold text-gray-800 mb-4">
        Controle de Vencimento de Mandatos
      </h1>

        {/* Barra de Pesquisa - Estilo da imagem */}
        <div className="mb-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Pesquisar..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="mb-4 p-4 text-center">
            <p className="text-gray-600">Carregando mandatos...</p>
          </div>
        )}

        {/* Tabela - Estilo da imagem */}
        {!loading && !erro && dadosComAssembleias.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            Nenhum mandato encontrado.
          </div>
        )}
        
        {!loading && dadosComAssembleias.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs">
                  CONDOMÍNIO
                </th>
                <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs">
                  SÍNDICO
                </th>
                <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs">
                  INÍCIO
                </th>
                <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs">
                  FIM
                </th>
                <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs">
                  PREVISÃO
                </th>
                <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs">
                  REALIZADA
                </th>
                <th className="border-b border-gray-300 px-1 py-1 text-center font-semibold text-gray-700 text-xs w-12">
                  AÇÕES
                </th>
              </tr>
            </thead>
            <tbody>
              {dadosComAssembleias.map((item) => {
                const previsaoAssembleia = calcularPrevisaoAssembleia(item.dataSaida)
                const assembleia = item.assembleia
                const estaEditando = editandoId === assembleia.id
                
                return (
                  <tr key={item.id} className={getRowStyle(item)}>
                    <td className="px-1 py-0.5 text-xs text-gray-900 leading-tight">
                      {item.condominio}
                    </td>
                    <td className="px-1 py-0.5 text-xs text-gray-900 leading-tight">
                      {item.nomeResponsavel}
                    </td>
                    <td className="px-1 py-0.5 text-xs text-gray-900 leading-tight">
                      {item.dataEntrada || '-'}
                    </td>
                    <td className="px-1 py-0.5 text-xs text-gray-900 leading-tight">
                      {item.dataSaida || '-'}
                    </td>
                    <td className="px-1 py-0.5 text-xs text-gray-900 leading-tight">
                      {previsaoAssembleia}
                    </td>
                    <td className="px-1 py-0.5 text-xs text-gray-900 leading-tight">
                      {estaEditando ? (
                        <input
                          type="text"
                          value={dataRealizadaEditando}
                          onChange={(e) => setDataRealizadaEditando(e.target.value)}
                          placeholder="dd/mm/yyyy"
                          className="w-20 px-1 py-0.5 border border-gray-300 rounded text-xs"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              salvarEdicao(assembleia.id)
                            } else if (e.key === 'Escape') {
                              cancelarEdicao()
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <span className={assembleia.realizada ? 'text-green-700 font-medium' : 'text-gray-400'}>
                          {assembleia.realizada || '-'}
                        </span>
                      )}
                    </td>
                    <td className="px-1 py-0.5 text-center">
                      {estaEditando ? (
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => salvarEdicao(assembleia.id)}
                            className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                            title="Salvar"
                          >
                            <Check size={12} />
                          </button>
                          <button
                            onClick={cancelarEdicao}
                            className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                            title="Cancelar"
                          >
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => iniciarEdicao(assembleia.id, assembleia.realizada)}
                          className="p-0.5 text-blue-600 hover:bg-blue-50 rounded"
                          title="Editar data realizada"
                        >
                          <Edit2 size={12} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        )}
        
        {/* Rodapé com Paginação - Estilo da imagem */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Mostrando {dadosComAssembleias.length} resultado(s)
          </div>
          <div className="flex gap-2">
            <button
              disabled
              className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-400 cursor-not-allowed"
            >
              ← Anterior
            </button>
            <button
              disabled={dadosComAssembleias.length === 0}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próximo →
            </button>
          </div>
        </div>
    </div>
  )
}

