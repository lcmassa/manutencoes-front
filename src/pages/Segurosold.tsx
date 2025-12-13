import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenInfo } from '../components/TokenInfo'
import { Edit2, Check, X, Mail, Upload, Search } from 'lucide-react'

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
    console.log('[Seguros] Company ID:', companyId)
    
    let seguros: Seguro[] = []
    
    try {
      // Buscar do endpoint correto de seguros condominiais
      console.log('[Seguros] Buscando do endpoint: /api/condominios/superlogica/seguros/condominial')
      const responseSeguros = await apiInstance.get<any>('/api/condominios/superlogica/seguros/condominial')
      const dataSeguros = responseSeguros.data
      
      // A resposta pode vir como: { status: "200", data: [...] } ou diretamente como array
      let listSeguros: any[] = []
      if (Array.isArray(dataSeguros)) {
        listSeguros = dataSeguros
      } else if (dataSeguros?.data && Array.isArray(dataSeguros.data)) {
        listSeguros = dataSeguros.data
      } else if (dataSeguros?.seguros && Array.isArray(dataSeguros.seguros)) {
        listSeguros = dataSeguros.seguros
      }
      
      console.log(`[Seguros] Resposta recebida:`, {
        isArray: Array.isArray(dataSeguros),
        hasData: !!dataSeguros?.data,
        hasSeguros: !!dataSeguros?.seguros,
        listSegurosLength: listSeguros.length
      })
      
      if (listSeguros.length > 0) {
        console.log(`[Seguros] ✅ Encontrados ${listSeguros.length} seguros no endpoint de seguros condominiais`)
        seguros = listSeguros.map((item: any) => {
          const condominioId = item.id_condominio_cond || item.idCondominio || item.idCondominioCond || ''
          const nomeCondominio = item.st_fantasia_cond || item.st_nome_cond || item.nomeFantasia || item.nomeCondominio || ''
          
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
          
          return {
            id: gerarIdSeguro(nomeCondominio, seguradora),
            condominio: nomeCondominio,
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
        console.log(`[Seguros] ✅ Processados ${seguros.length} seguros com dados completos`)
        return seguros
      }
    } catch (err: any) {
      console.log('[Seguros] Endpoint de seguros condominiais não disponível, tentando buscar de condomínios...', err?.message)
    }
    
    // Se não encontrou endpoint específico, buscar dados de condomínios e processar
    // Buscar todos os condomínios primeiro
    let todosCondominios: any[] = []
    let paginaCondominios = 1
    let temMaisCondominios = true
    
    while (temMaisCondominios) {
      try {
        // Buscar TODAS as colunas para ter acesso a CEP, endereço, bairro, cidade, CNPJ, etc
        const urlCondominios = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${paginaCondominios}`
        console.log(`[Seguros] Buscando condomínios página ${paginaCondominios}...`)
        const responseCondominios = await apiInstance.get<any>(urlCondominios)
        
        const dataCondominios = responseCondominios.data
        const listCondominios = Array.isArray(dataCondominios) 
          ? dataCondominios 
          : dataCondominios?.data || dataCondominios?.condominios || []
        
        if (listCondominios.length === 0) {
          temMaisCondominios = false
          break
        }
        
        todosCondominios = todosCondominios.concat(listCondominios)
        
        if (listCondominios.length < 100) {
          temMaisCondominios = false
        } else {
          paginaCondominios++
          if (paginaCondominios > 50) {
            temMaisCondominios = false
          }
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          throw err
        }
        temMaisCondominios = false
      }
    }
    
    console.log(`[Seguros] ✅ Total de condomínios encontrados: ${todosCondominios.length}`)
    
    // Criar entradas com dados completos dos condomínios
    if (seguros.length === 0) {
      // Se não encontrou seguros no endpoint específico, criar entradas com dados completos
      let criados = 0
      let semNome = 0
      todosCondominios.forEach((condominio: any) => {
        // Usar campos corretos da API: st_nome_cond ou st_fantasia_cond
        const nomeCondominio = condominio.st_nome_cond || condominio.st_fantasia_cond || condominio.nomeFantasia || condominio.nome || condominio.razaoSocial || condominio.nomeFantasiaCondominio || condominio.descricao || ''
        if (nomeCondominio && nomeCondominio.trim()) {
          // Formatar CEP (remover formatação se existir)
          const cep = condominio.st_cep_cond || condominio.st_cep_cond1 || condominio.cep || ''
          const cepFormatado = cep ? cep.replace(/[^\d]/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2') : ''
          
          // Formatar CNPJ/CPF
          const cnpj = condominio.st_cpf_cond || condominio.cnpj || condominio.cpf || ''
          const cnpjFormatado = cnpj ? cnpj.replace(/[^\d]/g, '') : ''
          
          seguros.push({
            id: gerarIdSeguro(nomeCondominio, ''),
            condominio: nomeCondominio,
            seguradora: '',
            vencimento: '',
            dataInicio: '',
            emailSindico: condominio.email || condominio.emailSindico || condominio.emailResponsavel || '',
            numeroApolice: '',
            valor: undefined,
            observacoes: '',
            cep: cepFormatado,
            endereco: condominio.st_endereco_cond || condominio.endereco || '',
            bairro: condominio.st_bairro_cond || condominio.bairro || '',
            cidade: condominio.st_cidade_cond || condominio.cidade || '',
            estado: condominio.st_uf_uf || condominio.st_estado_cond || condominio.estado || '',
            cnpj: cnpjFormatado,
            idCondominio: condominio.id_condominio_cond || condominio.id || ''
          })
          criados++
        } else {
          semNome++
        }
      })
      if (semNome > 0) {
        console.warn(`[Seguros] ⚠️ ${semNome} condomínios sem nome válido`)
      }
    } else {
      // Se já tem seguros do endpoint específico, adicionar condomínios que não têm seguro ainda
      let adicionados = 0
      todosCondominios.forEach((condominio: any) => {
        // Usar campos corretos da API: st_nome_cond ou st_fantasia_cond
        const nomeCondominio = condominio.st_nome_cond || condominio.st_fantasia_cond || condominio.nomeFantasia || condominio.nome || condominio.razaoSocial || condominio.nomeFantasiaCondominio || ''
        if (nomeCondominio && nomeCondominio.trim() && !seguros.some(s => s.condominio === nomeCondominio)) {
          const cep = condominio.st_cep_cond || condominio.st_cep_cond1 || condominio.cep || ''
          const cepFormatado = cep ? cep.replace(/[^\d]/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2') : ''
          const cnpj = condominio.st_cpf_cond || condominio.cnpj || condominio.cpf || ''
          const cnpjFormatado = cnpj ? cnpj.replace(/[^\d]/g, '') : ''
          
          seguros.push({
            id: gerarIdSeguro(nomeCondominio, ''),
            condominio: nomeCondominio,
            seguradora: '',
            vencimento: '',
            dataInicio: '',
            emailSindico: condominio.email || condominio.emailSindico || condominio.emailResponsavel || '',
            numeroApolice: '',
            valor: undefined,
            observacoes: '',
            cep: cepFormatado,
            endereco: condominio.st_endereco_cond || condominio.endereco || '',
            bairro: condominio.st_bairro_cond || condominio.bairro || '',
            cidade: condominio.st_cidade_cond || condominio.cidade || '',
            estado: condominio.st_uf_uf || condominio.st_estado_cond || condominio.estado || '',
            cnpj: cnpjFormatado,
            idCondominio: condominio.id_condominio_cond || condominio.id || ''
          })
          adicionados++
        }
      })
      console.log(`[Seguros] ✅ Adicionadas ${adicionados} entradas básicas adicionais`)
    }
    
    console.log(`[Seguros] ✅ Total de seguros processados: ${seguros.length}`)
    return seguros
  } catch (error: any) {
    console.error('[Seguros] Erro ao carregar da API:', error)
    throw error
  }
}

export function Seguros() {
  const { token, companyId } = useAuth()
  const [seguros, setSeguros] = useState<Seguro[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [editandoId, setEditandoId] = useState<string | null>(null)
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
        setLoading(false)
        return
      }
      
      loadingRef.current = true
      setLoading(true)
      setErro(null)
      
      try {
        // Buscar dados da API
        const segurosDaAPI = await carregarSegurosDaAPI(api, companyId)
        
        if (cancelled) return
        
        // Carregar do localStorage (preserva edições do usuário)
        const segurosDoStorage = carregarSeguros()
        
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

  // Filtrar seguros por termo de busca
  const segurosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return seguros
    
    const termo = searchTerm.toLowerCase()
    return seguros.filter(s => 
      s.condominio.toLowerCase().includes(termo) ||
      s.seguradora.toLowerCase().includes(termo) ||
      s.emailSindico?.toLowerCase().includes(termo) ||
      s.numeroApolice?.toLowerCase().includes(termo)
    )
  }, [seguros, searchTerm])

  // Ordenar por vencimento (mais próximo primeiro)
  const segurosOrdenados = useMemo(() => {
    return [...segurosFiltrados].sort((a, b) => {
      // Se não tem vencimento, colocar no final
      if (!a.vencimento || !a.vencimento.trim()) return 1
      if (!b.vencimento || !b.vencimento.trim()) return -1
      
      const dataA = new Date(a.vencimento).getTime()
      const dataB = new Date(b.vencimento).getTime()
      
      // Se alguma data é inválida, colocar no final
      if (isNaN(dataA)) return 1
      if (isNaN(dataB)) return -1
      
      return dataA - dataB
    })
  }, [segurosFiltrados])
  

  // Não bloquear renderização - sempre mostrar layout
  // if (loading) {
  //   return (
  //     <div className="p-6">
  //       <TokenInfo token={token} />
  //       <div className="mt-4 text-center py-8">
  //         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
  //         <p className="text-gray-600">Carregando seguros...</p>
  //       </div>
  //     </div>
  //   )
  // }

  return (
    <div className="p-6">
      <TokenInfo token={token} />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Controle de Vencimento de Seguros
        </h1>
        <p className="text-gray-600">
          Gerencie os seguros condominiais e acompanhe os vencimentos
        </p>
      </div>

      {loading && (
        <div className="mb-4 text-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-gray-600 text-sm">Carregando seguros...</p>
        </div>
      )}

      {erro && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800">Erro: {erro}</p>
        </div>
      )}

      {/* Barra de busca e ações */}
      <div className="mb-4 flex flex-col sm:flex-row gap-4">
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
            onClick={handleRecarregar}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={16} />
            <span>Recarregar da API</span>
          </button>
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
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Início
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Vencimento
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Apólice
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Valor
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Seguradora
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Condomínio
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    CEP
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Endereço
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Bairro
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    Cidade
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    CNPJ
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-left font-semibold text-gray-700 text-xs whitespace-nowrap">
                    E-mail Síndico
                  </th>
                  <th className="border-b border-gray-300 px-1 py-1 text-center font-semibold text-gray-700 text-xs w-20 whitespace-nowrap">
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
                      {/* Coluna: Data de Início */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="date"
                            value={formData.dataInicio || ''}
                            onChange={(e) => setFormData({ ...formData, dataInicio: e.target.value })}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
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
                      <td className="px-1 py-0.5 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="date"
                            value={formData.vencimento}
                            onChange={(e) => setFormData({ ...formData, vencimento: e.target.value })}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
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
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="text"
                            value={formData.numeroApolice || ''}
                            onChange={(e) => setFormData({ ...formData, numeroApolice: e.target.value })}
                            placeholder="Nº Apólice"
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.numeroApolice || '—'
                        )}
                      </td>
                      
                      {/* Coluna: Valor */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="number"
                            step="0.01"
                            value={formData.valor || ''}
                            onChange={(e) => setFormData({ ...formData, valor: e.target.value ? parseFloat(e.target.value) : undefined })}
                            placeholder="0.00"
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.valor ? `R$ ${seguro.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
                        )}
                      </td>
                      
                      {/* Coluna: Seguradora */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="text"
                            value={formData.seguradora}
                            onChange={(e) => setFormData({ ...formData, seguradora: e.target.value })}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.seguradora || '—'
                        )}
                      </td>
                      
                      {/* Coluna: Condomínio */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="text"
                            value={formData.condominio}
                            onChange={(e) => setFormData({ ...formData, condominio: e.target.value })}
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.condominio
                        )}
                      </td>
                      
                      {/* Coluna: CEP */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {seguro.cep || '—'}
                      </td>
                      
                      {/* Coluna: Endereço */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {seguro.endereco || '—'}
                      </td>
                      
                      {/* Coluna: Bairro */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {seguro.bairro || '—'}
                      </td>
                      
                      {/* Coluna: Cidade */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {seguro.cidade || '—'}
                      </td>
                      
                      {/* Coluna: CNPJ */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {seguro.cnpj ? seguro.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : '—'}
                      </td>
                      
                      {/* Coluna: E-mail Síndico */}
                      <td className="px-1 py-0.5 text-gray-900 whitespace-nowrap">
                        {estaEditando ? (
                          <input
                            type="email"
                            value={formData.emailSindico || ''}
                            onChange={(e) => setFormData({ ...formData, emailSindico: e.target.value })}
                            placeholder="sindico@condominio.com"
                            className="w-full px-1 py-0.5 border border-gray-300 rounded text-xs"
                          />
                        ) : (
                          seguro.emailSindico || '—'
                        )}
                      </td>
                      
                      {/* Coluna: Ações */}
                      <td className="px-1 py-0.5 text-center whitespace-nowrap">
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
              {segurosOrdenados.filter(s => getStatusClass(s.vencimento) === 'vencido').length} vencido(s)
            </span>
            {' • '}
            <span className="text-yellow-600">
              {segurosOrdenados.filter(s => getStatusClass(s.vencimento) === 'proximo').length} próximo(s) do vencimento
            </span>
          </>
        )}
      </div>
    </div>
  )
}

