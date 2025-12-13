// Seguros.tsx - Controle de Vencimento de Seguros
// Última atualização: 2025-12-10 14:30 - Versão corrigida
// REMOVIDO: Exportar CSV, Seguradoras encontradas
// AJUSTADO: Coluna Informações mostra nome da seguradora
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenInfo } from '../components/TokenInfo'
import { Edit2, Check, X, Mail, Upload, Search, AlertCircle, Calendar, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

export interface Seguro {
  id: string
  condominio: string
  seguradora: string
  vencimento: string // YYYY-MM-DD
  dataInicio?: string // YYYY-MM-DD
  emailSindico?: string
  numeroApolice?: string
  valor?: number
  observacoes?: string
  // Dados adicionais do condomínio
  cep?: string
  endereco?: string
  bairro?: string
  cidade?: string
  estado?: string
  cnpj?: string
  idCondominio?: string
}

const STORAGE_KEY = 'seguros_db'

// Funções para gerenciar dados no localStorage
function carregarSeguros(): Seguro[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data)
  } catch (error) {
    console.error('[SegurosDB] Erro ao carregar:', error)
    return []
  }
}

function salvarSeguros(seguros: Seguro[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seguros))
  } catch (error) {
    console.error('[SegurosDB] Erro ao salvar:', error)
  }
}

function gerarIdSeguro(condominio: string, seguradora: string): string {
  return `${condominio}_${seguradora}`.replace(/[^a-zA-Z0-9_]/g, '_')
}

// Função auxiliar para converter data DD/MM/YYYY para YYYY-MM-DD
function converterDataParaISO(dataStr: string): string {
  if (!dataStr || !dataStr.trim()) return ''
  try {
    // Tentar formato DD/MM/YYYY
    const match = dataStr.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (match) {
      const [, dia, mes, ano] = match
      return `${ano}-${mes}-${dia}`
    }
    // Se já estiver em formato ISO, retornar como está
    if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
      return dataStr
    }
    return ''
  } catch {
    return ''
  }
}

// Função para buscar dados de seguros da API
async function carregarSegurosDaAPI(apiInstance: typeof api, companyId: string): Promise<Seguro[]> {
  try {
    console.log('[Seguros] ========== BUSCANDO SEGUROS DA API ==========')
    console.log('[Seguros] Company ID recebido:', companyId)
    // Verificar também o localStorage
    const companyIdFromStorage = localStorage.getItem('x-company-id')
    console.log('[Seguros] Company ID do localStorage:', companyIdFromStorage)
    console.log('[Seguros] Company IDs coincidem?', companyId === companyIdFromStorage)
    
    let seguros: Seguro[] = []
    
    try {
      // Buscar do endpoint correto de seguros condominiais
      // Tentar primeiro com parâmetros de paginação (como em Mandatos e CertificadoDigital)
      let urlSeguros = '/api/condominios/superlogica/seguros/condominial?itensPorPagina=50&pagina=1'
      console.log('[Seguros] Buscando do endpoint:', urlSeguros)
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:88',message:'carregarSegurosDaAPI - START request',data:{url:urlSeguros,companyId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
      // #endregion
      
      // Garantir que o companyId está disponível
      // Garantir formato correto: abimoveis-003 (minúsculas com hífen)
      let rawCompanyId = companyId || localStorage.getItem('x-company-id') || 'abimoveis-003'
      rawCompanyId = rawCompanyId.trim().toLowerCase().replace(/=/g, '-').replace(/\s+/g, '')
      if (rawCompanyId.includes('abimoveis') && rawCompanyId.includes('003')) {
        rawCompanyId = 'abimoveis-003'
      }
      const companyIdParaHeader = rawCompanyId || 'abimoveis-003'
      console.log('[Seguros] Company ID para header:', companyIdParaHeader)
      
      // Preparar headers com x-company-id explícito (como em Inadimplencia)
      const headers: Record<string, string> = {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
      
      // Adicionar x-company-id explicitamente (obrigatório para este endpoint)
      if (companyIdParaHeader) {
        headers['x-company-id'] = companyIdParaHeader
        headers['company-id'] = companyIdParaHeader
        console.log('[Seguros] ✅ Headers configurados com x-company-id:', companyIdParaHeader)
      } else {
        console.error('[Seguros] ❌ Company ID não encontrado!')
      }
      
      // Fazer a requisição com parâmetros de paginação (como em Mandatos e CertificadoDigital)
      let responseSeguros
      try {
        responseSeguros = await apiInstance.get<any>(urlSeguros, { headers })
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:95',message:'carregarSegurosDaAPI - Response success',data:{status:responseSeguros.status,url:urlSeguros},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
      } catch (err: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:97',message:'carregarSegurosDaAPI - Response error',data:{status:err?.response?.status,url:urlSeguros,message:err?.message},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        if (err?.response?.status === 422) {
          // Tentar sem parâmetros se 422, mas mantendo os headers
          console.log('[Seguros] Erro 422, tentando sem parâmetros mas com headers...')
          urlSeguros = '/api/condominios/superlogica/seguros/condominial'
          responseSeguros = await apiInstance.get<any>(urlSeguros, { headers })
        } else {
          throw err
        }
      }
      const dataSeguros = responseSeguros.data
      
      // A resposta pode vir como: { status: "200", data: [...] } ou diretamente como array
      let listSeguros: any[] = []
      
      // Verificar se a resposta contém um erro (status 409 ou outro código de erro)
      // Mas primeiro tentar extrair dados, pois algumas APIs retornam dados mesmo com status de erro
      if (dataSeguros?.status && dataSeguros.status !== '200' && dataSeguros.status !== 200) {
        const statusCode = String(dataSeguros.status)
        console.warn(`[Seguros] ⚠️ API retornou status ${statusCode} no JSON:`, {
          status: statusCode,
          msg: dataSeguros.msg,
          session: dataSeguros.session,
          executiontime: dataSeguros.executiontime,
          todasChaves: Object.keys(dataSeguros)
        })
        
        // Se for 409, pode ser que não há dados disponíveis ou o endpoint não está disponível
        // Mas vamos verificar se há dados mesmo assim (algumas APIs retornam 409 com dados)
        if (statusCode === '409' || statusCode === '409') {
          console.warn('[Seguros] ⚠️ Status 409 (Conflict) - Verificando se há dados mesmo assim...')
          
          // Verificar se há algum array na resposta mesmo com status 409
          const keys = Object.keys(dataSeguros)
          for (const key of keys) {
            if (Array.isArray(dataSeguros[key])) {
              listSeguros = dataSeguros[key]
              if (listSeguros.length > 0) {
                console.log(`[Seguros] ✅ Encontrado array na chave "${key}" mesmo com status 409, usando os dados`)
                break
              }
            }
          }
          
          // Se não encontrou dados, retornar vazio (pode ser que realmente não há seguros)
          if (listSeguros.length === 0) {
            console.warn('[Seguros] ⚠️ Nenhum dado encontrado com status 409 - pode ser que não há seguros cadastrados para esta company')
            console.warn('[Seguros] 💡 Isso é normal se não há seguros cadastrados no sistema')
            return []
          }
        } else {
          // Para outros status de erro, tentar extrair dados antes de retornar vazio
          const keys = Object.keys(dataSeguros)
          for (const key of keys) {
            if (Array.isArray(dataSeguros[key])) {
              listSeguros = dataSeguros[key]
              if (listSeguros.length > 0) {
                console.log(`[Seguros] ✅ Encontrado array na chave "${key}" mesmo com status ${statusCode}, usando os dados`)
                break
              }
            }
          }
          
          // Se não encontrou dados, retornar vazio
          if (listSeguros.length === 0) {
            return []
          }
        }
      }
      if (Array.isArray(dataSeguros)) {
        listSeguros = dataSeguros
      } else if (dataSeguros?.data && Array.isArray(dataSeguros.data)) {
        listSeguros = dataSeguros.data
      } else if (dataSeguros?.seguros && Array.isArray(dataSeguros.seguros)) {
        listSeguros = dataSeguros.seguros
      } else if (dataSeguros?.result && Array.isArray(dataSeguros.result)) {
        listSeguros = dataSeguros.result
      } else if (typeof dataSeguros === 'object' && dataSeguros !== null) {
        // Tentar encontrar qualquer array na resposta
        const keys = Object.keys(dataSeguros)
        console.log(`[Seguros] Procurando array nas chaves:`, keys)
        for (const key of keys) {
          if (Array.isArray(dataSeguros[key])) {
            listSeguros = dataSeguros[key]
            console.log(`[Seguros] ✅ Lista encontrada na chave "${key}" com ${listSeguros.length} itens`)
            break
          } else {
            console.log(`[Seguros] Chave "${key}" não é array:`, typeof dataSeguros[key])
          }
        }
        if (listSeguros.length === 0) {
          console.warn(`[Seguros] ⚠️ Nenhum array encontrado na resposta. Estrutura completa:`, JSON.stringify(dataSeguros, null, 2).substring(0, 1000))
        }
      }
      
      console.log(`[Seguros] Resposta recebida:`, {
        isArray: Array.isArray(dataSeguros),
        hasData: !!dataSeguros?.data,
        hasSeguros: !!dataSeguros?.seguros,
        listSegurosLength: listSeguros.length,
        dataSegurosType: typeof dataSeguros,
        dataSegurosKeys: typeof dataSeguros === 'object' && dataSeguros !== null ? Object.keys(dataSeguros) : [],
        dataSegurosPreview: typeof dataSeguros === 'object' ? JSON.stringify(dataSeguros).substring(0, 500) : String(dataSeguros).substring(0, 500)
      })
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:118',message:'carregarSegurosDaAPI - Resposta',data:{isArray:Array.isArray(dataSeguros),hasData:!!dataSeguros?.data,hasSeguros:!!dataSeguros?.seguros,listSegurosLength:listSeguros.length,dataSegurosKeys:typeof dataSeguros==='object'&&dataSeguros!==null?Object.keys(dataSeguros):[],dataSegurosPreview:typeof dataSeguros==='object'?JSON.stringify(dataSeguros).substring(0,300):String(dataSeguros).substring(0,300)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
      // #endregion
      
      console.log(`[Seguros] 📊 Resumo da extração:`, {
        totalEncontrado: listSeguros.length,
        primeiroItem: listSeguros.length > 0 ? listSeguros[0] : null,
        todasChaves: listSeguros.length > 0 ? Object.keys(listSeguros[0] || {}) : []
      })
      
      if (listSeguros.length > 0) {
        console.log(`[Seguros] ✅ Encontrados ${listSeguros.length} seguros no endpoint de seguros condominiais`)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:125',message:'carregarSegurosDaAPI - Lista encontrada',data:{listSegurosLength:listSeguros.length,primeirosItens:listSeguros.slice(0,3).map((item:any)=>({idCondominio:item.id_condominio_cond||item.idCondominio||'N/A',nomeCondominio:item.st_fantasia_cond||'N/A'}))},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        seguros = listSeguros
          .map((item: any) => {
            const condominioId = item.id_condominio_cond || item.idCondominio || item.idCondominioCond || ''
            // Tentar múltiplos campos para nome do condomínio
            const nomeCondominio = item.st_fantasia_cond || item.st_nome_cond || item.nomeCondominio || item.nome || item.condominio || ''
            
            // Mapear data de vencimento (priorizar melhor_vencimento, depois dt_fimvigencia_seg)
            const vencimentoRaw = item.melhor_vencimento || item.dt_fimvigencia_seg || item.dtFimVigencia || ''
            const vencimento = converterDataParaISO(vencimentoRaw)
            
            // Mapear data de início
            const dataInicioRaw = item.dt_iniciovigencia_seg || item.dtInicioVigencia || ''
            const dataInicio = converterDataParaISO(dataInicioRaw)
            
            // Mapear nome da seguradora
            const seguradora = item.st_nome_con || item.nomeSeguradora || item.seguradora || ''
            
            // Formatar CEP
            const cep = item.st_cep_cond || item.st_cep_cond1 || item.cep || ''
            const cepFormatado = cep ? cep.replace(/[^\d]/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2') : ''
            
            // Formatar CNPJ/CPF
            const cnpj = item.st_cpf_cond || item.cnpj || item.cpf || ''
            const cnpjFormatado = cnpj ? cnpj.replace(/[^\d]/g, '') : ''
            
            // Mapear valor do prêmio
            const valorRaw = item.vl_premiobruto_seg || item.vlPremioBruto || item.valor || item.premio || ''
            const valor = valorRaw ? parseFloat(String(valorRaw).replace(',', '.')) : undefined
            
            // Se não encontrou nome do condomínio, usar ID como fallback
            const nomeFinal = nomeCondominio || `Condomínio ${condominioId}` || 'Sem nome'
            
            return {
              id: gerarIdSeguro(nomeFinal, seguradora),
              condominio: nomeFinal,
              seguradora: seguradora,
              vencimento: vencimento,
              dataInicio: dataInicio,
              emailSindico: item.email || item.emailSindico || item.emailResponsavel || '',
              numeroApolice: item.st_numeroapolice_seg || item.numeroApolice || item.apolice || item.policyNumber || '',
              valor: Number.isFinite(valor) ? valor : undefined,
              observacoes: item.observacoes || item.descricao || '',
              cep: cepFormatado,
              endereco: item.st_endereco_cond || item.endereco || item.address || '',
              bairro: item.st_bairro_cond || item.bairro || item.neighborhood || '',
              cidade: item.st_cidade_cond || item.cidade || item.city || '',
              estado: item.st_uf_uf || item.st_estado_cond || item.estado || item.state || '',
              cnpj: cnpjFormatado,
              idCondominio: condominioId
            }
          })
          .filter((seguro) => {
            // Excluir condomínios que começam com "associação" ou "condominio" (case insensitive)
            // Mas só se o nome não estiver vazio (se estiver vazio, manter para não perder dados)
            const nome = seguro.condominio ? seguro.condominio.trim().toLowerCase() : ''
            if (!nome) {
              // Se não tem nome, manter (pode ser que o nome venha de outro campo depois)
              return true
            }
            return !nome.startsWith('associação') && !nome.startsWith('associacao') && !nome.startsWith('condominio') && !nome.startsWith('condomínio')
          })
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:179',message:'carregarSegurosDaAPI - Apos filtro',data:{totalAposFiltro:seguros.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        console.log(`[Seguros] ✅ Processados ${seguros.length} seguros com dados completos (excluídos os que começam com "associação" ou "condominio")`)
        return seguros
      }
    } catch (err: any) {
      console.error('[Seguros] Erro ao buscar do endpoint de seguros:', err)
      const status = err?.response?.status
      const statusText = err?.response?.statusText
      const errorData = err?.response?.data
      
      // Verificar se o erro está no JSON da resposta (status 409, etc)
      if (errorData?.status && (errorData.status === '409' || errorData.status === 409)) {
        console.error('[Seguros] ❌ Erro 409 detectado no JSON da resposta:', {
          status: errorData.status,
          msg: errorData.msg,
          session: errorData.session
        })
        // Retornar array vazio em vez de lançar erro
        return []
      }
      
      if (status === 422) {
        console.error('[Seguros] Erro 422 - Dados inválidos:', {
          url: '/api/condominios/superlogica/seguros/condominial',
          errorData,
          message: typeof errorData === 'string' ? errorData : JSON.stringify(errorData),
        })
        throw new Error(
          `Erro 422: Dados inválidos na requisição.\n` +
          `Endpoint: /api/condominios/superlogica/seguros/condominial\n` +
          `Resposta: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`
        )
      }
      throw err
    }
    
    console.log(`[Seguros] ✅ Total de seguros processados: ${seguros.length}`)
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:209',message:'carregarSegurosDaAPI - FINAL',data:{totalSeguros:seguros.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
    // #endregion
    return seguros
      } catch (error: any) {
        console.error('[Seguros] Erro ao carregar da API:', error)
        const status = error?.response?.status
        const statusText = error?.response?.statusText
        const errorData = error?.response?.data
        
        if (status === 422) {
          const errorMessage = typeof errorData === 'string' 
            ? errorData 
            : errorData?.message || errorData?.error || JSON.stringify(errorData)
          
          console.error('[Seguros] Erro 422 detalhado:', {
            status,
            statusText,
            errorData,
            errorMessage,
          })
          
          throw new Error(
            `Erro 422: Dados inválidos na requisição.\n` +
            `Endpoint: /api/condominios/superlogica/seguros/condominial\n` +
            `Detalhes: ${errorMessage}\n` +
            `Verifique o console do navegador (F12) para mais informações.`
          )
        }
        
        throw error
      }
}

export function Seguros() {
  // Versão: 2025-12-10 14:30 - Sem Exportar CSV, Sem Seguradoras encontradas, Informações mostra seguradora
  console.log('[Seguros] Componente carregado - Versão 2025-12-10 14:30')
  
  const { token, companyId } = useAuth()
  const [seguros, setSeguros] = useState<Seguro[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [ordenacao, setOrdenacao] = useState<'vencimento' | 'alfabetica'>('vencimento')
  const [apenasComVencimento, setApenasComVencimento] = useState<boolean>(false)
  const loadingRef = useRef(false)
  const [formData, setFormData] = useState<Seguro>({
    id: '',
    condominio: '',
    seguradora: '',
    vencimento: '',
    dataInicio: '',
    emailSindico: '',
    numeroApolice: '',
    valor: undefined,
    observacoes: ''
  })

  // Carregar dados ao montar componente
  useEffect(() => {
    let cancelled = false
    let mounted = true
    
    async function carregarDados() {
      // Evitar múltiplas execuções simultâneas
      if (loadingRef.current) return
      
      if (!token || !companyId) {
        console.warn('[Seguros] ⚠️ Token ou CompanyId ausente:', { hasToken: !!token, hasCompanyId: !!companyId })
        setLoading(false)
        return
      }
      
      // Verificar se o companyId está correto
      const companyIdFromStorage = localStorage.getItem('x-company-id')
      if (companyIdFromStorage && companyIdFromStorage !== companyId) {
        console.warn('[Seguros] ⚠️ CompanyId do contexto diferente do localStorage:', { 
          contextCompanyId: companyId, 
          storageCompanyId: companyIdFromStorage 
        })
      }
      console.log('[Seguros] ✅ Iniciando carregamento com:', { 
        companyId, 
        companyIdFromStorage,
        hasToken: !!token 
      })
      
      loadingRef.current = true
      setLoading(true)
      setErro(null)
      
      try {
        // Buscar dados da API
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:279',message:'carregarDados - START',data:{hasToken:!!token,hasCompanyId:!!companyId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        const segurosDaAPI = await carregarSegurosDaAPI(api, companyId)
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:281',message:'carregarDados - Apos API',data:{segurosDaAPICount:segurosDaAPI.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        
        if (cancelled) return
        
        // Carregar do localStorage (preserva edições do usuário)
        const segurosDoStorage = carregarSeguros()
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:287',message:'carregarDados - Apos localStorage',data:{segurosDoStorageCount:segurosDoStorage.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        
        // Mesclar dados: API tem prioridade, mas manter dados editados do localStorage
        const segurosMap = new Map<string, Seguro>()
        
        // Adicionar dados da API primeiro (base)
        segurosDaAPI.forEach(seguro => {
          segurosMap.set(seguro.id, seguro)
        })
        
        // Adicionar/atualizar com dados do localStorage (preserva edições)
        segurosDoStorage.forEach(seguro => {
          // Só atualizar se o seguro do storage foi editado (tem dados preenchidos)
          const seguroExistente = segurosMap.get(seguro.id)
          if (seguroExistente) {
            // Mesclar: manter dados da API mas preservar edições do usuário
            segurosMap.set(seguro.id, {
              ...seguroExistente,
              seguradora: seguro.seguradora || seguroExistente.seguradora,
              vencimento: seguro.vencimento || seguroExistente.vencimento,
              emailSindico: seguro.emailSindico || seguroExistente.emailSindico,
              numeroApolice: seguro.numeroApolice || seguroExistente.numeroApolice,
              valor: seguro.valor !== undefined ? seguro.valor : seguroExistente.valor,
              observacoes: seguro.observacoes || seguroExistente.observacoes
            })
          } else {
            // Adicionar seguro que existe apenas no storage
            segurosMap.set(seguro.id, seguro)
          }
        })
        
        if (cancelled) return
        
        const segurosMesclados = Array.from(segurosMap.values())
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Seguros.tsx:310',message:'carregarDados - Apos mesclar',data:{segurosMescladosCount:segurosMesclados.length},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'BB'})}).catch(()=>{});
        // #endregion
        
        // Verificar se foi cancelado ANTES de atualizar estado
        if (cancelled || !mounted) {
          loadingRef.current = false
          return
        }
        
        // Atualizar estado
        setSeguros(segurosMesclados)
        
        // Salvar dados mesclados de volta no localStorage
        if (segurosMesclados.length > 0) {
          salvarSeguros(segurosMesclados)
        }
        
        // Finalizar loading DEPOIS de atualizar estado
        if (!cancelled && mounted) {
          setLoading(false)
          loadingRef.current = false
        }
      } catch (error: any) {
        if (cancelled || !mounted) return
        
        console.error('[Seguros] Erro ao carregar:', error)
        if (error?.response?.status === 401) {
          setErro('Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.')
        } else {
          setErro(error.message || 'Erro ao carregar dados da API')
        }
        // Garantir que loading seja finalizado mesmo em caso de erro
        setLoading(false)
        loadingRef.current = false
      }
    }
    
    carregarDados()
    
    return () => {
      cancelled = true
      mounted = false
      loadingRef.current = false
    }
  }, [token, companyId])


  // Função para recarregar dados da API
  const handleRecarregar = useCallback(async () => {
    if (loadingRef.current) return
    if (!token || !companyId) return
    
    loadingRef.current = true
    setLoading(true)
    setErro(null)
    
    try {
      const segurosDaAPI = await carregarSegurosDaAPI(api, companyId)
      const segurosDoStorage = carregarSeguros()
      
      const segurosMap = new Map<string, Seguro>()
      segurosDaAPI.forEach(seguro => segurosMap.set(seguro.id, seguro))
      segurosDoStorage.forEach(seguro => {
        const existente = segurosMap.get(seguro.id)
        if (existente) {
          segurosMap.set(seguro.id, {
            ...existente,
            seguradora: seguro.seguradora || existente.seguradora,
            vencimento: seguro.vencimento || existente.vencimento,
            emailSindico: seguro.emailSindico || existente.emailSindico,
            numeroApolice: seguro.numeroApolice || existente.numeroApolice,
            valor: seguro.valor !== undefined ? seguro.valor : existente.valor,
            observacoes: seguro.observacoes || existente.observacoes
          })
        } else {
          segurosMap.set(seguro.id, seguro)
        }
      })
      
      const segurosMesclados = Array.from(segurosMap.values())
      setSeguros(segurosMesclados)
      salvarSeguros(segurosMesclados)
    } catch (error: any) {
      console.error('[Seguros] Erro ao recarregar:', error)
      if (error?.response?.status === 401) {
        setErro('Token de autenticação expirado.')
      } else {
        setErro(error.message || 'Erro ao recarregar dados')
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [token, companyId])

  const handleEdit = useCallback((seguro: Seguro) => {
    setEditandoId(seguro.id)
    setFormData({ ...seguro })
  }, [])

  const handleCancel = useCallback(() => {
    setEditandoId(null)
    setFormData({
      id: '',
      condominio: '',
      seguradora: '',
      vencimento: '',
      dataInicio: '',
      emailSindico: '',
      numeroApolice: '',
      valor: undefined,
      observacoes: ''
    })
  }, [])

  const handleSave = useCallback(() => {
    if (!formData.condominio || !formData.seguradora || !formData.vencimento) {
      alert('Preencha todos os campos obrigatórios (Condomínio, Seguradora, Vencimento)')
      return
    }

    // Validar formato de data
    if (!/^\d{4}-\d{2}-\d{2}$/.test(formData.vencimento)) {
      alert('Data de vencimento deve estar no formato YYYY-MM-DD')
      return
    }

    // Validar email se fornecido
    if (formData.emailSindico && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.emailSindico)) {
      alert('E-mail inválido')
      return
    }

    // Atualizar lista
    const segurosAtualizados = seguros.map(s => 
      s.id === formData.id ? formData : s
    )
    
    setSeguros(segurosAtualizados)
    salvarSeguros(segurosAtualizados)
    setEditandoId(null)
  }, [formData, seguros])

  const handleSendEmail = useCallback(async (seguro: Seguro) => {
    if (!seguro.emailSindico) {
      alert('E-mail do síndico não informado!')
      return
    }

    // TODO: Implementar envio de e-mail via API
    alert(`Funcionalidade de envio de e-mail será implementada.\nE-mail: ${seguro.emailSindico}`)
  }, [])

  const getStatusClass = useCallback((vencimento: string): 'vencido' | 'proximo' | 'ativo' => {
    if (!vencimento || !vencimento.trim()) return 'ativo'
    
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const dataVenc = new Date(vencimento)
      dataVenc.setHours(0, 0, 0, 0)
      
      if (isNaN(dataVenc.getTime())) return 'ativo'
      
      const diffDays = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays < 0) return 'vencido'
      if (diffDays <= 15) return 'proximo'
      return 'ativo'
    } catch {
      return 'ativo'
    }
  }, [])

  const getStatusLabel = useCallback((vencimento: string): string => {
    if (!vencimento || !vencimento.trim()) return 'Não informado'
    
    try {
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      const dataVenc = new Date(vencimento)
      dataVenc.setHours(0, 0, 0, 0)
      
      if (isNaN(dataVenc.getTime())) return 'Data inválida'
      
      const diffDays = Math.ceil((dataVenc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
      
      if (diffDays < 0) return `Vencido há ${Math.abs(diffDays)} dia(s)`
      if (diffDays === 0) return 'Vence hoje'
      if (diffDays <= 15) return `Vence em ${diffDays} dia(s)`
      return `Vence em ${diffDays} dia(s)`
    } catch {
      return 'Data inválida'
    }
  }, [])

  // Filtrar seguros por termo de busca e por vencimento
  const segurosFiltrados = useMemo(() => {
    let filtrados = seguros
    
    // Filtrar apenas os que têm vencimento, se a opção estiver ativa
    if (apenasComVencimento) {
      filtrados = filtrados.filter(s => s.vencimento && s.vencimento.trim() && !isNaN(new Date(s.vencimento).getTime()))
    }
    
    // Filtrar por termo de busca
    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase()
      filtrados = filtrados.filter(s => 
        s.condominio.toLowerCase().includes(termo) ||
        s.seguradora.toLowerCase().includes(termo) ||
        s.emailSindico?.toLowerCase().includes(termo) ||
        s.numeroApolice?.toLowerCase().includes(termo)
      )
    }
    
    return filtrados
  }, [seguros, searchTerm, apenasComVencimento])

  // Ordenar por vencimento ou alfabética
  const segurosOrdenados = useMemo(() => {
    return [...segurosFiltrados].sort((a, b) => {
      if (ordenacao === 'alfabetica') {
        // Ordenação alfabética por nome do condomínio
        const nomeA = (a.condominio || '').toLowerCase().trim()
        const nomeB = (b.condominio || '').toLowerCase().trim()
        return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base' })
      } else {
        // Ordenação por vencimento (mais próximo primeiro)
        // Se não tem vencimento, colocar no final
        if (!a.vencimento || !a.vencimento.trim()) return 1
        if (!b.vencimento || !b.vencimento.trim()) return -1
        
        const dataA = new Date(a.vencimento).getTime()
        const dataB = new Date(b.vencimento).getTime()
        
        // Se alguma data é inválida, colocar no final
        if (isNaN(dataA)) return 1
        if (isNaN(dataB)) return -1
        
        return dataA - dataB
      }
    })
  }, [segurosFiltrados, ordenacao])

  // Estatísticas
  const estatisticas = useMemo(() => {
    const total = segurosOrdenados.length
    const vencidos = segurosOrdenados.filter(s => getStatusClass(s.vencimento) === 'vencido').length
    const proximos = segurosOrdenados.filter(s => getStatusClass(s.vencimento) === 'proximo').length
    const semSeguro = segurosOrdenados.filter(s => !s.seguradora || !s.seguradora.trim()).length
    
    return { total, vencidos, proximos, semSeguro }
  }, [segurosOrdenados, getStatusClass])

  return (
    <div className="p-6">
      <TokenInfo token={token} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Controle de Vencimento de Seguros
        </h1>
        <p className="text-gray-600">
          Acompanhe os vencimentos das apólices por Condomínio, Seguradora e Data de Vencimento.
        </p>
        <p className="text-xs text-gray-400 mt-1">
          Versão atualizada: 2025-12-10 14:35 - Sem Exportar CSV, Sem Seguradoras encontradas
        </p>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
          <div className="text-sm text-gray-600 mb-1">Total</div>
          <div className="text-2xl font-bold text-gray-900">{estatisticas.total}</div>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-200 p-4 shadow-sm">
          <div className="text-sm text-red-600 mb-1">Vencidos</div>
          <div className="text-2xl font-bold text-red-700">{estatisticas.vencidos}</div>
        </div>
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4 shadow-sm">
          <div className="text-sm text-yellow-600 mb-1">Próximos (≤15d)</div>
          <div className="text-2xl font-bold text-yellow-700">{estatisticas.proximos}</div>
        </div>
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-4 shadow-sm">
          <div className="text-sm text-blue-600 mb-1">Sem seguro</div>
          <div className="text-2xl font-bold text-blue-700">{estatisticas.semSeguro}</div>
        </div>
      </div>

      {loading && (
        <div className="mb-4 text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Carregando seguros...</p>
        </div>
      )}

      {erro && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <p className="text-red-800 font-medium">Erro ao carregar dados</p>
              <p className="text-red-700 text-sm mt-1 whitespace-pre-line">{erro}</p>
            </div>
          </div>
        </div>
      )}

      {/* Barra de busca e ações */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Pesquisar por condomínio, seguradora, e-mail ou apólice..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
          <button
            onClick={() => setOrdenacao(ordenacao === 'alfabetica' ? 'vencimento' : 'alfabetica')}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 border border-gray-300 flex items-center gap-2"
            title={ordenacao === 'alfabetica' ? 'Ordenar por vencimento' : 'Ordenar alfabeticamente'}
          >
            {ordenacao === 'alfabetica' ? (
              <>
                <ArrowUpDown size={16} />
                <span>Ordenar por vencimento</span>
              </>
            ) : (
              <>
                <ArrowUpDown size={16} />
                <span>Ordenar alfabeticamente</span>
              </>
            )}
          </button>
          <button
            onClick={handleRecarregar}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={16} />
            <span>Recarregar da API</span>
          </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={apenasComVencimento}
              onChange={(e) => setApenasComVencimento(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span>Mostrar apenas seguros com data de vencimento</span>
          </label>
        </div>
      </div>

      {/* Tabela */}
      {segurosOrdenados.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-500">
            {searchTerm ? 'Nenhum seguro encontrado para a busca.' : 'Nenhum seguro cadastrado.'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead className="bg-gray-50">
                <tr>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Condomínio
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Início
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Vencimento
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Apólice
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Valor
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Informações
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    E-mail Síndico
                  </th>
                  <th className="border-b border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 text-xs w-20 whitespace-nowrap">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody>
                {segurosOrdenados.map((seguro) => {
                  const statusClass = getStatusClass(seguro.vencimento)
                  const statusLabel = getStatusLabel(seguro.vencimento)
                  const estaEditando = editandoId === seguro.id
                  
                  return (
                    <tr 
                      key={seguro.id} 
                      className={`hover:bg-gray-50 ${
                        statusClass === 'vencido' ? 'bg-red-50' : 
                        statusClass === 'proximo' ? 'bg-yellow-50' : ''
                      }`}
                    >
                      {/* Coluna: Condomínio */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="text"
                            value={formData.condominio}
                            onChange={(e) => setFormData({ ...formData, condominio: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.condominio
                        )}
                      </td>
                      
                      {/* Coluna: Data de Início */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="date"
                            value={formData.dataInicio || ''}
                            onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.dataInicio && seguro.dataInicio.trim() ? (() => {
                            try {
                              const data = new Date(seguro.dataInicio)
                              if (isNaN(data.getTime())) return '—'
                              return data.toLocaleDateString('pt-BR')
                            } catch {
                              return '—'
                            }
                          })() : '—'
                        )}
                      </td>
                      
                      {/* Coluna: Vencimento */}
                      <td className="px-3 py-2 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="date"
                            value={formData.vencimento}
                            onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          <div>
                            <div className={`text-xs ${
                              statusClass === 'vencido' ? 'text-red-600 font-medium' :
                              statusClass === 'proximo' ? 'text-yellow-600 font-medium' :
                              'text-gray-900'
                            }`}>
                              {seguro.vencimento && seguro.vencimento.trim() ? (() => {
                                try {
                                  const data = new Date(seguro.vencimento)
                                  if (isNaN(data.getTime())) return '—'
                                  return data.toLocaleDateString('pt-BR')
                                } catch {
                                  return '—'
                                }
                              })() : '—'}
                            </div>
                            {seguro.vencimento && seguro.vencimento.trim() && (
                              <div className={`text-xs ${
                                statusClass === 'vencido' ? 'text-red-600' :
                                statusClass === 'proximo' ? 'text-yellow-600' :
                                'text-gray-500'
                              }`}>
                                {statusLabel}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      
                      {/* Coluna: Apólice */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="text"
                            value={formData.numeroApolice || ''}
                            onChange={(e) => setFormData({ ...formData, numeroApolice: e.target.value })}
                            placeholder="Nº Apólice"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.numeroApolice || '—'
                        )}
                      </td>
                      
                      {/* Coluna: Valor */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="number"
                            step="0.01"
                            value={formData.valor || ''}
                            onChange={(e) => setFormData({ ...formData, valor: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.valor ? `R$ ${seguro.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
                        )}
                      </td>
                      
                      {/* Coluna: Informações (Seguradora) */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="text"
                            value={formData.seguradora}
                            onChange={(e) => setFormData({ ...formData, seguradora: e.target.value })}
                            placeholder="Nome da seguradora"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.seguradora || '—'
                        )}
                      </td>
                      
                      {/* Coluna: E-mail Síndico */}
                      <td className="px-3 py-2 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="email"
                            value={formData.emailSindico || ''}
                            onChange={(e) => setFormData({ ...formData, emailSindico: e.target.value })}
                            placeholder="sindico@condominio.com"
                            className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.emailSindico || '—'
                        )}
                      </td>
                      
                      {/* Coluna: Ações */}
                      <td className="px-3 py-2 text-center whitespace-nowrap">
                        {estaEditando ? (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={handleSave}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                              title="Salvar"
                            >
                              <Check size={14} />
                            </button>
                            <button
                              onClick={handleCancel}
                              className="p-1 text-red-600 hover:bg-red-50 rounded"
                              title="Cancelar"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => handleEdit(seguro)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                              title="Editar"
                            >
                              <Edit2 size={14} />
                            </button>
                            {seguro.emailSindico && (
                              <button
                                onClick={() => handleSendEmail(seguro)}
                                className="p-1 text-purple-600 hover:bg-purple-50 rounded"
                                title="Enviar e-mail"
                              >
                                <Mail size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Rodapé com estatísticas */}
      <div className="mt-4 text-sm text-gray-600">
        Mostrando {segurosOrdenados.length} de {seguros.length} seguro(s)
        {segurosOrdenados.length > 0 && (
          <>
            {' • '}
            <span className="text-red-600">
              {estatisticas.vencidos} vencido(s)
            </span>
            {' • '}
            <span className="text-yellow-600">
              {estatisticas.proximos} próximo(s) do vencimento
            </span>
          </>
        )}
      </div>
    </div>
  )
}

