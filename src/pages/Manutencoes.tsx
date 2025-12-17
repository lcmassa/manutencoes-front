import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import * as ManutencoesDB from '../lib/manutencoes-db'
import { 
  Plus, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  Building2,
  Wrench,
  Shield,
  FileText,
  Calendar,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Filter,
  Search,
  Settings,
  List,
  Database,
  Cloud
} from 'lucide-react'

// =====================================================
// TIPOS E CONSTANTES
// =====================================================

// Categorias de itens de manutenção
type CategoriaItem = 'equipamento' | 'estrutura' | 'administrativo'

// Status de manutenção
type StatusManutencao = 'em_dia' | 'proximo_vencimento' | 'vencido' | 'nao_iniciado'

// Prioridade
type Prioridade = 'baixa' | 'media' | 'alta' | 'critica'

// Tipo de item de manutenção
type TipoItemManutencao = {
  id: string
  nome: string
  categoria: CategoriaItem
  periodicidadeMeses: number // Periodicidade padrão em meses
  obrigatorio: boolean
  descricaoPadrao: string
}

// Item de manutenção por condomínio
type ItemManutencao = {
  id: string
  idCondominio: string
  nomeCondominio: string
  tipoItemId: string
  tipoItemNome: string
  categoria: CategoriaItem
  
  // Dados da manutenção
  dataUltimaManutencao: string | null
  dataProximaManutencao: string | null
  dataVencimentoGarantia: string | null
  periodicidadeMeses: number
  
  // Fornecedor/Contrato
  fornecedor: string
  telefoneContato: string
  emailContato: string
  numeroContrato: string
  valorContrato: number
  
  // Documentação
  laudoTecnico: string
  certificado: string
  observacoes: string
  
  // Status
  status: StatusManutencao
  prioridade: Prioridade
  
  // Metadados
  dataCriacao: string
  dataAtualizacao: string
}

// Condomínio
type Condominio = {
  id: string
  nome: string
}

// Tipos de itens obrigatórios para condomínios
const TIPOS_ITENS_MANUTENCAO: TipoItemManutencao[] = [
  // EQUIPAMENTOS
  { id: 'elevador', nome: 'Elevadores', categoria: 'equipamento', periodicidadeMeses: 1, obrigatorio: true, descricaoPadrao: 'Manutenção preventiva e corretiva de elevadores' },
  { id: 'bomba_agua', nome: 'Bombas d\'água', categoria: 'equipamento', periodicidadeMeses: 6, obrigatorio: true, descricaoPadrao: 'Verificação e manutenção das bombas de recalque e pressurização' },
  { id: 'gerador', nome: 'Geradores', categoria: 'equipamento', periodicidadeMeses: 3, obrigatorio: true, descricaoPadrao: 'Teste e manutenção do grupo gerador' },
  { id: 'portao_automatico', nome: 'Portões automáticos', categoria: 'equipamento', periodicidadeMeses: 3, obrigatorio: true, descricaoPadrao: 'Manutenção de portões e motores' },
  { id: 'interfone', nome: 'Interfones', categoria: 'equipamento', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Verificação do sistema de interfonia' },
  { id: 'cftv', nome: 'CFTV / Câmeras', categoria: 'equipamento', periodicidadeMeses: 6, obrigatorio: true, descricaoPadrao: 'Manutenção do sistema de câmeras e gravação' },
  { id: 'iluminacao_emergencia', nome: 'Iluminação de emergência', categoria: 'equipamento', periodicidadeMeses: 6, obrigatorio: true, descricaoPadrao: 'Teste e manutenção das luminárias de emergência' },
  { id: 'sistema_incendio', nome: 'Sistemas de incêndio', categoria: 'equipamento', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Recarga de extintores, teste de hidrantes e alarmes' },
  { id: 'pressurizacao_escadas', nome: 'Pressurização de escadas', categoria: 'equipamento', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Teste e manutenção do sistema de pressurização' },
  { id: 'ar_condicionado', nome: 'Ar condicionado central', categoria: 'equipamento', periodicidadeMeses: 3, obrigatorio: false, descricaoPadrao: 'Manutenção preventiva do sistema de climatização' },
  
  // ESTRUTURAS
  { id: 'telhado', nome: 'Telhado', categoria: 'estrutura', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Inspeção e manutenção do telhado e calhas' },
  { id: 'fachada', nome: 'Fachada', categoria: 'estrutura', periodicidadeMeses: 60, obrigatorio: true, descricaoPadrao: 'Inspeção e manutenção da fachada (pintura, rejunte)' },
  { id: 'caixa_agua', nome: 'Caixa d\'água', categoria: 'estrutura', periodicidadeMeses: 6, obrigatorio: true, descricaoPadrao: 'Limpeza e higienização das caixas d\'água' },
  { id: 'para_raios', nome: 'Para-raios (SPDA)', categoria: 'estrutura', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Inspeção e laudo do sistema de proteção contra descargas atmosféricas' },
  { id: 'caldeira', nome: 'Caldeiras', categoria: 'estrutura', periodicidadeMeses: 12, obrigatorio: false, descricaoPadrao: 'Inspeção e manutenção de caldeiras (se houver)' },
  { id: 'piscina', nome: 'Piscina', categoria: 'estrutura', periodicidadeMeses: 1, obrigatorio: false, descricaoPadrao: 'Tratamento químico e manutenção da piscina' },
  { id: 'playground', nome: 'Playground', categoria: 'estrutura', periodicidadeMeses: 6, obrigatorio: false, descricaoPadrao: 'Inspeção de segurança dos brinquedos' },
  
  // ADMINISTRATIVOS
  { id: 'contrato_manutencao', nome: 'Contratos de manutenção', categoria: 'administrativo', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Renovação e gestão de contratos' },
  { id: 'fornecedores', nome: 'Cadastro de fornecedores', categoria: 'administrativo', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Atualização do cadastro de fornecedores' },
  { id: 'garantias', nome: 'Garantias', categoria: 'administrativo', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Controle de garantias de equipamentos e serviços' },
  { id: 'laudo_tecnico', nome: 'Laudos técnicos', categoria: 'administrativo', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Emissão e renovação de laudos obrigatórios' },
  { id: 'certificado_legal', nome: 'Certificados legais', categoria: 'administrativo', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'AVCB, licenças e certificados legais' },
  { id: 'seguro_predial', nome: 'Seguro predial', categoria: 'administrativo', periodicidadeMeses: 12, obrigatorio: true, descricaoPadrao: 'Renovação do seguro do condomínio' },
]

const STORAGE_KEY = 'manutencoes_controle_db'
const STORAGE_KEY_TIPOS = 'manutencoes_tipos_customizados_db'
const STORAGE_KEY_EXCLUIDOS = 'manutencoes_itens_excluidos_db'

// =====================================================
// FUNÇÕES UTILITÁRIAS
// =====================================================

function gerarId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function carregarDados(): ItemManutencao[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data)
  } catch (error) {
    console.error('[Manutencoes] Erro ao carregar dados:', error)
    return []
  }
}

function salvarDados(itens: ItemManutencao[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(itens))
  } catch (error) {
    console.error('[Manutencoes] Erro ao salvar dados:', error)
  }
}

function carregarTiposCustomizados(): TipoItemManutencao[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY_TIPOS)
    if (!data) return []
    return JSON.parse(data)
  } catch (error) {
    console.error('[Manutencoes] Erro ao carregar tipos customizados:', error)
    return []
  }
}

function salvarTiposCustomizados(tipos: TipoItemManutencao[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_TIPOS, JSON.stringify(tipos))
  } catch (error) {
    console.error('[Manutencoes] Erro ao salvar tipos customizados:', error)
  }
}

function carregarItensExcluidos(): Set<string> {
  try {
    const data = localStorage.getItem(STORAGE_KEY_EXCLUIDOS)
    if (!data) return new Set()
    const array = JSON.parse(data)
    return new Set(array)
  } catch (error) {
    console.error('[Manutencoes] Erro ao carregar itens excluídos:', error)
    return new Set()
  }
}

function salvarItensExcluidos(excluidos: Set<string>): void {
  try {
    const array = Array.from(excluidos)
    localStorage.setItem(STORAGE_KEY_EXCLUIDOS, JSON.stringify(array))
  } catch (error) {
    console.error('[Manutencoes] Erro ao salvar itens excluídos:', error)
  }
}

function adicionarItemExcluido(idCondominio: string, tipoItemId: string): void {
  const excluidos = carregarItensExcluidos()
  const chave = `${idCondominio}_${tipoItemId}`
  excluidos.add(chave)
  salvarItensExcluidos(excluidos)
}

function calcularStatus(item: ItemManutencao): StatusManutencao {
  if (!item.dataProximaManutencao) return 'nao_iniciado'
  
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  
  const dataProxima = new Date(item.dataProximaManutencao)
  dataProxima.setHours(0, 0, 0, 0)
  
  const diffDias = Math.floor((dataProxima.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
  
  if (diffDias < 0) return 'vencido'
  if (diffDias <= 30) return 'proximo_vencimento'
  return 'em_dia'
}

function formatarData(data: string | null): string {
  if (!data) return '-'
  try {
    return new Date(data).toLocaleDateString('pt-BR')
  } catch {
    return '-'
  }
}

function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

// =====================================================
// COMPONENTE PRINCIPAL
// =====================================================

export function Manutencoes() {
  const { token, companyId } = useAuth()
  
  // Estados principais
  const [itens, setItens] = useState<ItemManutencao[]>([])
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Estados de filtro
  const [filtroCondominio, setFiltroCondominio] = useState<string>('')
  const [filtroCategoria, setFiltroCategoria] = useState<CategoriaItem | ''>('')
  const [filtroStatus, setFiltroStatus] = useState<StatusManutencao | ''>('')
  const [filtroBusca, setFiltroBusca] = useState<string>('')
  
  // Estados do modal de registro
  const [modalAberto, setModalAberto] = useState(false)
  const [modoEdicao, setModoEdicao] = useState(false)
  const [itemEditando, setItemEditando] = useState<ItemManutencao | null>(null)
  
  // Estados do modal de tipos
  const [modalTiposAberto, setModalTiposAberto] = useState(false)
  const [tipoEditando, setTipoEditando] = useState<TipoItemManutencao | null>(null)
  const [modoEdicaoTipo, setModoEdicaoTipo] = useState(false)
  const [tiposCustomizados, setTiposCustomizados] = useState<TipoItemManutencao[]>([])
  
  // Estados de UI
  const [secaoExpandida, setSecaoExpandida] = useState<CategoriaItem | null>('equipamento')
  
  // Estados de sincronização
  const [sincronizando, setSincronizando] = useState(false)
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date | null>(null)
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(null)
  
  const loadingRef = useRef(false)
  
  // Lista completa de tipos (padrão + customizados)
  const todosTipos = useMemo(() => {
    return [...TIPOS_ITENS_MANUTENCAO, ...tiposCustomizados]
  }, [tiposCustomizados])

  // =====================================================
  // CARREGAR CONDOMÍNIOS DA API
  // =====================================================
  
  const carregarCondominios = useCallback(async () => {
    if (!token || !companyId) return []
    
    try {
      console.log('[Manutencoes] Buscando condomínios...')
      const todosCondominios: Condominio[] = []
      let pagina = 1
      let temMais = true
      
      while (temMais) {
        const url = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${pagina}`
        const response = await api.get<any>(url)
        const data = response.data
        const lista = Array.isArray(data) ? data : data?.data || data?.condominios || []
        
        if (lista.length === 0) {
          temMais = false
          break
        }
        
        lista.forEach((c: any) => {
          const nome = c.st_fantasia_cond || c.st_nome_cond || c.nomeFantasia || c.nome || ''
          const id = c.id_condominio_cond || c.id || ''
          if (nome && id) {
            todosCondominios.push({ id, nome })
          }
        })
        
        if (lista.length < 100) {
          temMais = false
        } else {
          pagina++
          if (pagina > 20) temMais = false
        }
      }
      
      // Ordenar por nome
      todosCondominios.sort((a, b) => a.nome.localeCompare(b.nome))
      
      console.log(`[Manutencoes] ✅ ${todosCondominios.length} condomínios encontrados`)
      return todosCondominios
    } catch (err: any) {
      console.error('[Manutencoes] Erro ao carregar condomínios:', err)
      throw err
    }
  }, [token, companyId])

  // =====================================================
  // INICIALIZAR ITENS PADRÃO PARA CONDOMÍNIOS
  // =====================================================
  
  const inicializarItensPadrao = useCallback((condominiosList: Condominio[], itensExistentes: ItemManutencao[], tiposDisponiveis: TipoItemManutencao[]): ItemManutencao[] => {
    const novosItens: ItemManutencao[] = [...itensExistentes]
    const itensExistentesSet = new Set(itensExistentes.map(i => `${i.idCondominio}_${i.tipoItemId}`))
    const itensExcluidos = carregarItensExcluidos()
    
    // Para cada condomínio, criar itens obrigatórios que não existem E não foram excluídos permanentemente
    condominiosList.forEach(cond => {
      tiposDisponiveis.filter(tipo => tipo.obrigatorio).forEach(tipo => {
        const chave = `${cond.id}_${tipo.id}`
        // Só criar se não existe E não foi excluído permanentemente
        if (!itensExistentesSet.has(chave) && !itensExcluidos.has(chave)) {
          novosItens.push({
            id: gerarId(),
            idCondominio: cond.id,
            nomeCondominio: cond.nome,
            tipoItemId: tipo.id,
            tipoItemNome: tipo.nome,
            categoria: tipo.categoria,
            dataUltimaManutencao: null,
            dataProximaManutencao: null,
            dataVencimentoGarantia: null,
            periodicidadeMeses: tipo.periodicidadeMeses,
            fornecedor: '',
            telefoneContato: '',
            emailContato: '',
            numeroContrato: '',
            valorContrato: 0,
            laudoTecnico: '',
            certificado: '',
            observacoes: tipo.descricaoPadrao,
            status: 'nao_iniciado',
            prioridade: 'media',
            dataCriacao: new Date().toISOString(),
            dataAtualizacao: new Date().toISOString(),
          })
        }
      })
    })
    
    return novosItens
  }, [])

  // =====================================================
  // CARREGAR DADOS INICIAIS
  // =====================================================
  
  useEffect(() => {
    let cancelled = false
    
    async function carregarDadosIniciais() {
      if (loadingRef.current) return
      if (!token || !companyId) {
        setLoading(false)
        return
      }
      
      loadingRef.current = true
      setLoading(true)
      setError(null)
      
      try {
        // Tentar carregar do banco primeiro (silenciosamente)
        let dadosDoBanco: { tipos: any[], itens: any[], excluidos: string[] } | null = null
        try {
          dadosDoBanco = await ManutencoesDB.buscarTodosDados(companyId)
          if (dadosDoBanco && (dadosDoBanco.tipos.length > 0 || dadosDoBanco.itens.length > 0)) {
            console.log('[Manutencoes] Dados encontrados no banco, usando-os')
          } else {
            dadosDoBanco = null
            console.log('[Manutencoes] Nenhum dado no banco, usando localStorage')
          }
        } catch (err: any) {
          // Ignorar erros 422, 404, 501 - endpoints podem não existir ainda
          const status = err?.response?.status
          if (status === 404 || status === 422 || status === 501) {
            console.log('[Manutencoes] Endpoints de banco não disponíveis, usando apenas localStorage')
          } else {
            console.log('[Manutencoes] Erro ao buscar do banco, usando localStorage:', err)
          }
          dadosDoBanco = null
        }
        
        // Carregar tipos customizados (do banco ou localStorage)
        let tiposCustom: TipoItemManutencao[]
        if (dadosDoBanco && dadosDoBanco.tipos.length > 0) {
          tiposCustom = dadosDoBanco.tipos.map(t => ({
            id: t.id,
            nome: t.nome,
            categoria: t.categoria,
            periodicidadeMeses: t.periodicidade_meses,
            obrigatorio: t.obrigatorio,
            descricaoPadrao: t.descricao_padrao,
          }))
        } else {
          tiposCustom = carregarTiposCustomizados()
        }
        setTiposCustomizados(tiposCustom)
        if (dadosDoBanco && dadosDoBanco.tipos.length > 0) {
          salvarTiposCustomizados(tiposCustom)
        }
        
        // Carregar condomínios da API
        const condominiosList = await carregarCondominios()
        if (cancelled) return
        setCondominios(condominiosList)
        
        // Combinar tipos padrão + customizados
        const todosTiposDisponiveis = [...TIPOS_ITENS_MANUTENCAO, ...tiposCustom]
        
        // Carregar itens (do banco ou localStorage)
        let itensLocal: ItemManutencao[]
        if (dadosDoBanco && dadosDoBanco.itens.length > 0) {
          itensLocal = dadosDoBanco.itens.map(i => ({
            id: i.id,
            idCondominio: i.id_condominio,
            nomeCondominio: i.nome_condominio,
            tipoItemId: i.tipo_item_id,
            tipoItemNome: i.tipo_item_nome,
            categoria: i.categoria,
            dataUltimaManutencao: i.data_ultima_manutencao,
            dataProximaManutencao: i.data_proxima_manutencao,
            dataVencimentoGarantia: i.data_vencimento_garantia,
            periodicidadeMeses: i.periodicidade_meses,
            fornecedor: i.fornecedor,
            telefoneContato: i.telefone_contato,
            emailContato: i.email_contato,
            numeroContrato: i.numero_contrato,
            valorContrato: i.valor_contrato,
            laudoTecnico: i.laudo_tecnico,
            certificado: i.certificado,
            observacoes: i.observacoes,
            status: i.status,
            prioridade: i.prioridade,
            dataCriacao: i.data_criacao || new Date().toISOString(),
            dataAtualizacao: i.data_atualizacao || new Date().toISOString(),
          }))
        } else {
          itensLocal = carregarDados()
        }
        
        // Atualizar lista de excluídos (do banco ou localStorage)
        if (dadosDoBanco && dadosDoBanco.excluidos.length > 0) {
          const excluidosSet = new Set(dadosDoBanco.excluidos)
          salvarItensExcluidos(excluidosSet)
        }
        
        // Inicializar itens padrão para novos condomínios
        itensLocal = inicializarItensPadrao(condominiosList, itensLocal, todosTiposDisponiveis)
        
        // Recalcular status de cada item
        itensLocal = itensLocal.map(item => ({
          ...item,
          status: calcularStatus(item)
        }))
        
        setItens(itensLocal)
        salvarDados(itensLocal)
      } catch (err: any) {
        if (cancelled) return
        
        // Ignorar erros 422, 404, 501 - endpoints de banco podem não existir ainda
        const status = err?.response?.status
        if (status === 404 || status === 422 || status === 501) {
          console.log('[Manutencoes] Endpoints de banco não disponíveis, continuando com localStorage')
          // Limpar qualquer erro anterior e não setar novo erro
          setError(null)
          // Continuar com localStorage normalmente
          return
        }
        
        console.error('[Manutencoes] Erro ao carregar:', err)
        // Só setar erro na UI para erros reais (não relacionados ao banco)
        if (err?.response?.status !== 422 && err?.response?.status !== 404 && err?.response?.status !== 501) {
          setError(err?.message || 'Erro ao carregar dados')
        } else {
          // Limpar erro se for relacionado a endpoints não disponíveis
          setError(null)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          loadingRef.current = false
        }
      }
    }
    
    carregarDadosIniciais()
    
    return () => {
      cancelled = true
      loadingRef.current = false
    }
  }, [token, companyId, carregarCondominios, inicializarItensPadrao])

  // =====================================================
  // FILTRAR ITENS
  // =====================================================
  
  const itensFiltrados = useMemo(() => {
    return itens.filter(item => {
      if (filtroCondominio && item.idCondominio !== filtroCondominio) return false
      if (filtroCategoria && item.categoria !== filtroCategoria) return false
      if (filtroStatus && item.status !== filtroStatus) return false
      if (filtroBusca) {
        const busca = filtroBusca.toLowerCase()
        const match = 
          item.nomeCondominio.toLowerCase().includes(busca) ||
          item.tipoItemNome.toLowerCase().includes(busca) ||
          item.fornecedor.toLowerCase().includes(busca) ||
          item.observacoes.toLowerCase().includes(busca)
        if (!match) return false
      }
      return true
    })
  }, [itens, filtroCondominio, filtroCategoria, filtroStatus, filtroBusca])

  // =====================================================
  // AGRUPAR ITENS POR CONDOMÍNIO
  // =====================================================
  
  const itensAgrupadosPorCondominio = useMemo(() => {
    const agrupados = new Map<string, ItemManutencao[]>()
    
    itensFiltrados.forEach(item => {
      const key = item.idCondominio
      if (!agrupados.has(key)) {
        agrupados.set(key, [])
      }
      agrupados.get(key)!.push(item)
    })
    
    // Converter para array e ordenar por nome do condomínio
    return Array.from(agrupados.entries())
      .map(([idCondominio, itens]) => ({
        idCondominio,
        nomeCondominio: itens[0].nomeCondominio,
        itens: itens.sort((a, b) => a.tipoItemNome.localeCompare(b.tipoItemNome))
      }))
      .sort((a, b) => a.nomeCondominio.localeCompare(b.nomeCondominio))
  }, [itensFiltrados])

  // =====================================================
  // ESTATÍSTICAS
  // =====================================================
  
  const estatisticas = useMemo(() => {
    const total = itens.length
    const vencidos = itens.filter(i => i.status === 'vencido').length
    const proximoVencimento = itens.filter(i => i.status === 'proximo_vencimento').length
    const emDia = itens.filter(i => i.status === 'em_dia').length
    const naoIniciados = itens.filter(i => i.status === 'nao_iniciado').length
    
    return { total, vencidos, proximoVencimento, emDia, naoIniciados }
  }, [itens])

  // =====================================================
  // AÇÕES CRUD
  // =====================================================
  
  const abrirModalNovo = () => {
    const primeiroTipo = todosTipos[0] || TIPOS_ITENS_MANUTENCAO[0]
    setItemEditando({
      id: '',
      idCondominio: condominios[0]?.id || '',
      nomeCondominio: condominios[0]?.nome || '',
      tipoItemId: primeiroTipo.id,
      tipoItemNome: primeiroTipo.nome,
      categoria: primeiroTipo.categoria,
      dataUltimaManutencao: null,
      dataProximaManutencao: null,
      dataVencimentoGarantia: null,
      periodicidadeMeses: primeiroTipo.periodicidadeMeses,
      fornecedor: '',
      telefoneContato: '',
      emailContato: '',
      numeroContrato: '',
      valorContrato: 0,
      laudoTecnico: '',
      certificado: '',
      observacoes: primeiroTipo.descricaoPadrao,
      status: 'nao_iniciado',
      prioridade: 'media',
      dataCriacao: new Date().toISOString(),
      dataAtualizacao: new Date().toISOString(),
    })
    setModoEdicao(false)
    setModalAberto(true)
  }
  
  const abrirModalNovoTipo = () => {
    setTipoEditando({
      id: gerarId(),
      nome: '',
      categoria: 'equipamento',
      periodicidadeMeses: 6,
      obrigatorio: false,
      descricaoPadrao: ''
    })
    setModoEdicaoTipo(false)
    setModalTiposAberto(true)
  }
  
  const abrirModalEditarTipo = (tipo: TipoItemManutencao) => {
    setTipoEditando({ ...tipo })
    setModoEdicaoTipo(true)
    setModalTiposAberto(true)
  }
  
  const fecharModalTipos = () => {
    setModalTiposAberto(false)
    setTipoEditando(null)
    setModoEdicaoTipo(false)
  }
  
  const salvarTipo = () => {
    if (!tipoEditando || !tipoEditando.nome.trim()) return
    
    let novosTipos: TipoItemManutencao[]
    
    if (modoEdicaoTipo) {
      // Edição
      novosTipos = tiposCustomizados.map(t => 
        t.id === tipoEditando.id ? tipoEditando : t
      )
    } else {
      // Novo - verificar se já existe
      const existe = todosTipos.some(t => t.id === tipoEditando.id || t.nome.toLowerCase() === tipoEditando.nome.toLowerCase())
      if (existe) {
        alert('Já existe um tipo com este nome ou ID')
        return
      }
      novosTipos = [...tiposCustomizados, tipoEditando]
    }
    
    setTiposCustomizados(novosTipos)
    salvarTiposCustomizados(novosTipos)
    fecharModalTipos()
    
    // Sincronizar com banco (em background, não bloquear UI)
    if (companyId) {
      sincronizarComBanco().catch(err => {
        console.error('[Manutencoes] Erro ao sincronizar após salvar tipo:', err)
      })
    }
  }
  
  const excluirTipo = (id: string) => {
    // Verificar se o tipo está sendo usado
    const emUso = itens.some(i => i.tipoItemId === id)
    if (emUso) {
      alert('Este tipo não pode ser excluído pois está sendo usado em registros de manutenção.')
      return
    }
    
    if (!confirm('Deseja realmente excluir este tipo de item?')) return
    
    const novosTipos = tiposCustomizados.filter(t => t.id !== id)
    setTiposCustomizados(novosTipos)
    salvarTiposCustomizados(novosTipos)
  }
  
  const abrirModalEditar = (item: ItemManutencao) => {
    setItemEditando({ ...item })
    setModoEdicao(true)
    setModalAberto(true)
  }
  
  const fecharModal = () => {
    setModalAberto(false)
    setItemEditando(null)
    setModoEdicao(false)
  }
  
  const salvarItem = () => {
    if (!itemEditando) return
    
    const agora = new Date().toISOString()
    let novosItens: ItemManutencao[]
    
    if (modoEdicao) {
      // Edição
      novosItens = itens.map(i => 
        i.id === itemEditando.id 
          ? { ...itemEditando, dataAtualizacao: agora, status: calcularStatus(itemEditando) }
          : i
      )
    } else {
      // Novo
      const novoItem: ItemManutencao = {
        ...itemEditando,
        id: gerarId(),
        dataCriacao: agora,
        dataAtualizacao: agora,
        status: calcularStatus(itemEditando)
      }
      novosItens = [...itens, novoItem]
    }
    
    setItens(novosItens)
    salvarDados(novosItens)
    fecharModal()
    
    // Sincronizar com banco (em background, não bloquear UI)
    if (companyId) {
      sincronizarComBanco().catch(err => {
        console.error('[Manutencoes] Erro ao sincronizar após salvar:', err)
      })
    }
  }
  
  const excluirItem = (id: string) => {
    if (!confirm('Deseja realmente excluir este item permanentemente?')) return
    
    const item = itens.find(i => i.id === id)
    if (!item) return
    
    // Adicionar à lista de exclusões permanentes
    adicionarItemExcluido(item.idCondominio, item.tipoItemId)
    
    // Remover do estado e salvar
    const novosItens = itens.filter(i => i.id !== id)
    setItens(novosItens)
    salvarDados(novosItens)
    
    // Sincronizar exclusão com banco (em background, não bloquear UI)
    if (companyId) {
      sincronizarExclusaoComBanco(item.idCondominio, item.tipoItemId).catch(err => {
        console.error('[Manutencoes] Erro ao sincronizar exclusão:', err)
      })
    }
  }
  
  // =====================================================
  // FUNÇÕES DE SINCRONIZAÇÃO COM BANCO
  // =====================================================
  
  const sincronizarExclusaoComBanco = async (idCondominio: string, tipoItemId: string) => {
    if (!companyId) return
    try {
      await ManutencoesDB.registrarItemExcluido(idCondominio, tipoItemId, companyId)
    } catch (error) {
      console.error('[Manutencoes] Erro ao registrar exclusão no banco:', error)
    }
  }
  
  const sincronizarComBanco = useCallback(async () => {
    if (!companyId || sincronizando) return
    
    setSincronizando(true)
    setErroSincronizacao(null)
    
    try {
      console.log('[Manutencoes] Iniciando sincronização com banco...')
      
      // Converter tipos para formato do banco
      const tiposDB: ManutencoesDB.TipoItemManutencaoDB[] = tiposCustomizados.map(t => ({
        id: t.id,
        nome: t.nome,
        categoria: t.categoria,
        periodicidade_meses: t.periodicidadeMeses,
        obrigatorio: t.obrigatorio,
        descricao_padrao: t.descricaoPadrao,
      }))
      
      // Converter itens para formato do banco
      const itensDB: ManutencoesDB.ItemManutencaoDB[] = itens.map(i => ({
        id: i.id,
        id_condominio: i.idCondominio,
        nome_condominio: i.nomeCondominio,
        tipo_item_id: i.tipoItemId,
        tipo_item_nome: i.tipoItemNome,
        categoria: i.categoria,
        data_ultima_manutencao: i.dataUltimaManutencao,
        data_proxima_manutencao: i.dataProximaManutencao,
        data_vencimento_garantia: i.dataVencimentoGarantia,
        periodicidade_meses: i.periodicidadeMeses,
        fornecedor: i.fornecedor,
        telefone_contato: i.telefoneContato,
        email_contato: i.emailContato,
        numero_contrato: i.numeroContrato,
        valor_contrato: i.valorContrato,
        laudo_tecnico: i.laudoTecnico,
        certificado: i.certificado,
        observacoes: i.observacoes,
        status: i.status,
        prioridade: i.prioridade,
        id_empresa: companyId,
      }))
      
      // Converter excluídos para formato do banco
      const excluidos = Array.from(carregarItensExcluidos())
      
      // Sincronizar todos os dados
      await ManutencoesDB.sincronizarTodosDados(tiposDB, itensDB, excluidos, companyId)
      
      setUltimaSincronizacao(new Date())
      console.log('[Manutencoes] ✅ Sincronização concluída com sucesso')
    } catch (error: any) {
      console.error('[Manutencoes] ❌ Erro na sincronização:', error)
      setErroSincronizacao(error.message || 'Erro ao sincronizar com banco de dados')
    } finally {
      setSincronizando(false)
    }
  }, [companyId, tiposCustomizados, itens, sincronizando])
  
  const carregarDoBanco = useCallback(async () => {
    if (!companyId || loadingRef.current) return
    
    loadingRef.current = true
    setLoading(true)
    setError(null)
    
    try {
      console.log('[Manutencoes] Carregando dados do banco...')
      
      const dados = await ManutencoesDB.buscarTodosDados(companyId)
      
      // Se houver dados no banco, usar eles
      if (dados.tipos.length > 0 || dados.itens.length > 0) {
        // Converter tipos do banco para formato local
        const tiposLocal: TipoItemManutencao[] = dados.tipos.map(t => ({
          id: t.id,
          nome: t.nome,
          categoria: t.categoria,
          periodicidadeMeses: t.periodicidade_meses,
          obrigatorio: t.obrigatorio,
          descricaoPadrao: t.descricao_padrao,
        }))
        setTiposCustomizados(tiposLocal)
        salvarTiposCustomizados(tiposLocal)
        
        // Converter itens do banco para formato local
        const itensLocal: ItemManutencao[] = dados.itens.map(i => ({
          id: i.id,
          idCondominio: i.id_condominio,
          nomeCondominio: i.nome_condominio,
          tipoItemId: i.tipo_item_id,
          tipoItemNome: i.tipo_item_nome,
          categoria: i.categoria,
          dataUltimaManutencao: i.data_ultima_manutencao,
          dataProximaManutencao: i.data_proxima_manutencao,
          dataVencimentoGarantia: i.data_vencimento_garantia,
          periodicidadeMeses: i.periodicidade_meses,
          fornecedor: i.fornecedor,
          telefoneContato: i.telefone_contato,
          emailContato: i.email_contato,
          numeroContrato: i.numero_contrato,
          valorContrato: i.valor_contrato,
          laudoTecnico: i.laudo_tecnico,
          certificado: i.certificado,
          observacoes: i.observacoes,
          status: i.status,
          prioridade: i.prioridade,
          dataCriacao: i.data_criacao || new Date().toISOString(),
          dataAtualizacao: i.data_atualizacao || new Date().toISOString(),
        }))
        
        // Recalcular status
        const itensComStatus = itensLocal.map(item => ({
          ...item,
          status: calcularStatus(item)
        }))
        
        setItens(itensComStatus)
        salvarDados(itensComStatus)
        
        // Atualizar lista de excluídos
        const excluidosSet = new Set(dados.excluidos)
        salvarItensExcluidos(excluidosSet)
        
        console.log('[Manutencoes] ✅ Dados carregados do banco')
      } else {
        // Se não houver dados no banco, carregar do localStorage normalmente
        console.log('[Manutencoes] Nenhum dado no banco, usando localStorage')
      }
    } catch (error: any) {
      console.error('[Manutencoes] Erro ao carregar do banco:', error)
      // Em caso de erro, continuar com localStorage (fallback)
      console.log('[Manutencoes] Usando localStorage como fallback')
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [companyId])

  // =====================================================
  // RENDERIZAÇÃO DE STATUS
  // =====================================================
  
  const renderStatusBadge = (status: StatusManutencao) => {
    const configs = {
      em_dia: { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Em dia' },
      proximo_vencimento: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Clock, label: 'Próximo' },
      vencido: { bg: 'bg-red-100', text: 'text-red-800', icon: AlertTriangle, label: 'Vencido' },
      nao_iniciado: { bg: 'bg-gray-100', text: 'text-gray-600', icon: Clock, label: 'Não iniciado' }
    }
    const config = configs[status]
    const Icon = config.icon
    
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    )
  }

  // =====================================================
  // LOADING E ERROR
  // =====================================================
  
  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando controle de manutenções...</p>
        </div>
      </div>
    )
  }

  // Não exibir erro se for relacionado a endpoints não disponíveis (422, 404, 501)
  const isErrorFromUnavailableEndpoint = error && (
    error.includes('422') || 
    error.includes('404') || 
    error.includes('501') ||
    error.includes('Unprocessable Entity') ||
    error.includes('Not Found') ||
    error.includes('Not Implemented')
  )
  
  if (error && !isErrorFromUnavailableEndpoint) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Erro ao carregar</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  // =====================================================
  // RENDER PRINCIPAL
  // =====================================================
  
  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Wrench className="w-6 h-6 text-blue-600" />
              Controle de Manutenções
            </h1>
            <p className="text-sm text-gray-600">
              Gestão completa de manutenções e equipamentos dos condomínios
            </p>
            {ultimaSincronizacao && (
              <p className="text-xs text-gray-500 mt-1">
                Última sincronização: {ultimaSincronizacao.toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sincronizarComBanco}
              disabled={sincronizando || !companyId}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                sincronizando
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title={ultimaSincronizacao ? `Última sincronização: ${ultimaSincronizacao.toLocaleString('pt-BR')}` : 'Sincronizar com banco de dados'}
            >
              {sincronizando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                <>
                  <Database className="w-4 h-4" />
                  Sincronizar
                </>
              )}
            </button>
            <button
              onClick={() => {
                setTipoEditando(null)
                setModoEdicaoTipo(false)
                setModalTiposAberto(true)
              }}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
              title="Gerenciar tipos de itens"
            >
              <Settings className="w-4 h-4" />
              Gerenciar Tipos
            </button>
            <button
              onClick={abrirModalNovo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Novo Registro
            </button>
          </div>
        </div>
        
        {/* Mensagem de erro de sincronização */}
        {erroSincronizacao && (
          <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Erro na sincronização: {erroSincronizacao}
              </p>
            </div>
            <button
              onClick={() => setErroSincronizacao(null)}
              className="text-yellow-600 hover:text-yellow-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        
        {/* Cards de Estatísticas */}
        <div className="grid grid-cols-5 gap-3">
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-2xl font-bold text-gray-900">{estatisticas.total}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-xs text-green-600">Em dia</p>
            <p className="text-2xl font-bold text-green-700">{estatisticas.emDia}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
            <p className="text-xs text-yellow-600">Próximo vencimento</p>
            <p className="text-2xl font-bold text-yellow-700">{estatisticas.proximoVencimento}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <p className="text-xs text-red-600">Vencidos</p>
            <p className="text-2xl font-bold text-red-700">{estatisticas.vencidos}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
            <p className="text-xs text-gray-500">Não iniciados</p>
            <p className="text-2xl font-bold text-gray-600">{estatisticas.naoIniciados}</p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filtros</span>
        </div>
        <div className="grid grid-cols-4 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={filtroBusca}
              onChange={e => setFiltroBusca(e.target.value)}
              placeholder="Buscar..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filtroCondominio}
            onChange={e => setFiltroCondominio(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os condomínios</option>
            {condominios.map(c => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
          <select
            value={filtroCategoria}
            onChange={e => setFiltroCategoria(e.target.value as CategoriaItem | '')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todas as categorias</option>
            <option value="equipamento">Equipamentos</option>
            <option value="estrutura">Estruturas</option>
            <option value="administrativo">Administrativo</option>
          </select>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value as StatusManutencao | '')}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Todos os status</option>
            <option value="em_dia">Em dia</option>
            <option value="proximo_vencimento">Próximo vencimento</option>
            <option value="vencido">Vencido</option>
            <option value="nao_iniciado">Não iniciado</option>
          </select>
        </div>
      </div>

      {/* Lista de Itens Agrupados por Condomínio */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          {itensFiltrados.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-500">
              Nenhum item encontrado com os filtros aplicados.
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {itensAgrupadosPorCondominio.map((grupo) => {
                const vencidos = grupo.itens.filter(i => i.status === 'vencido').length
                const proximos = grupo.itens.filter(i => i.status === 'proximo_vencimento').length
                
                return (
                  <div key={grupo.idCondominio} className="divide-y divide-gray-100">
                    {/* Cabeçalho do Condomínio */}
                    <div className={`bg-gradient-to-r from-blue-50 to-blue-100 border-l-4 border-blue-600 px-4 py-3 sticky top-0 z-10 ${
                      vencidos > 0 ? 'from-red-50 to-red-100 border-red-600' : 
                      proximos > 0 ? 'from-yellow-50 to-yellow-100 border-yellow-600' : ''
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Building2 className="w-5 h-5 text-blue-700" />
                          <h3 className="text-base font-bold text-gray-900">{grupo.nomeCondominio}</h3>
                          <span className="text-xs text-gray-600 font-medium">
                            ({grupo.itens.length} {grupo.itens.length === 1 ? 'item' : 'itens'})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {vencidos > 0 && (
                            <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs font-medium">
                              {vencidos} vencido{vencidos > 1 ? 's' : ''}
                            </span>
                          )}
                          {proximos > 0 && (
                            <span className="px-2 py-1 bg-yellow-200 text-yellow-800 rounded-full text-xs font-medium">
                              {proximos} próximo{proximos > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Tabela de Itens do Condomínio */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Item</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Categoria</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Última Manut.</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Próxima</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Garantia</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Fornecedor</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Status</th>
                            <th className="px-3 py-2 text-center font-semibold text-gray-700">Ações</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {grupo.itens.map(item => (
                            <tr key={item.id} className={`hover:bg-gray-50 ${item.status === 'vencido' ? 'bg-red-50' : ''}`}>
                              <td className="px-3 py-2 font-medium text-gray-900">{item.tipoItemNome}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  item.categoria === 'equipamento' ? 'bg-blue-100 text-blue-800' :
                                  item.categoria === 'estrutura' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {item.categoria === 'equipamento' ? 'Equip.' : item.categoria === 'estrutura' ? 'Estrut.' : 'Admin.'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{formatarData(item.dataUltimaManutencao)}</td>
                              <td className="px-3 py-2 text-gray-600">{formatarData(item.dataProximaManutencao)}</td>
                              <td className="px-3 py-2 text-gray-600">{formatarData(item.dataVencimentoGarantia)}</td>
                              <td className="px-3 py-2 text-gray-600 truncate max-w-[120px]" title={item.fornecedor}>
                                {item.fornecedor || '-'}
                              </td>
                              <td className="px-3 py-2">{renderStatusBadge(item.status)}</td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => abrirModalEditar(item)}
                                    className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                    title="Editar"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => excluirItem(item.id)}
                                    className="p-1 text-red-600 hover:bg-red-100 rounded"
                                    title="Excluir"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t border-gray-200 text-sm text-gray-600">
          {itensFiltrados.length} item(ns) encontrado(s) em {itensAgrupadosPorCondominio.length} condomínio(s)
        </div>
      </div>

      {/* Modal de Edição/Criação */}
      {modalAberto && itemEditando && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">
                {modoEdicao ? 'Editar Registro' : 'Novo Registro de Manutenção'}
              </h2>
              <button onClick={fecharModal} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Condomínio e Tipo */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condomínio</label>
                  <select
                    value={itemEditando.idCondominio}
                    onChange={e => {
                      const cond = condominios.find(c => c.id === e.target.value)
                      setItemEditando({
                        ...itemEditando,
                        idCondominio: e.target.value,
                        nomeCondominio: cond?.nome || ''
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {condominios.map(c => (
                      <option key={c.id} value={c.id}>{c.nome}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tipo de Item</label>
                  <select
                    value={itemEditando.tipoItemId}
                    onChange={e => {
                      const tipo = todosTipos.find(t => t.id === e.target.value)
                      if (tipo) {
                        setItemEditando({
                          ...itemEditando,
                          tipoItemId: tipo.id,
                          tipoItemNome: tipo.nome,
                          categoria: tipo.categoria,
                          periodicidadeMeses: tipo.periodicidadeMeses,
                          observacoes: itemEditando.observacoes || tipo.descricaoPadrao
                        })
                      }
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <optgroup label="Equipamentos">
                      {todosTipos.filter(t => t.categoria === 'equipamento').map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Estruturas">
                      {todosTipos.filter(t => t.categoria === 'estrutura').map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </optgroup>
                    <optgroup label="Administrativo">
                      {todosTipos.filter(t => t.categoria === 'administrativo').map(t => (
                        <option key={t.id} value={t.id}>{t.nome}</option>
                      ))}
                    </optgroup>
                  </select>
                </div>
              </div>
              
              {/* Datas */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Última Manutenção</label>
                  <input
                    type="date"
                    value={itemEditando.dataUltimaManutencao || ''}
                    onChange={e => {
                      const dataUltima = e.target.value
                      // Calcular próxima manutenção automaticamente
                      let dataProxima = ''
                      if (dataUltima) {
                        const d = new Date(dataUltima)
                        d.setMonth(d.getMonth() + itemEditando.periodicidadeMeses)
                        dataProxima = d.toISOString().split('T')[0]
                      }
                      setItemEditando({
                        ...itemEditando,
                        dataUltimaManutencao: dataUltima,
                        dataProximaManutencao: dataProxima
                      })
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Próxima Manutenção</label>
                  <input
                    type="date"
                    value={itemEditando.dataProximaManutencao || ''}
                    onChange={e => setItemEditando({...itemEditando, dataProximaManutencao: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vencimento Garantia</label>
                  <input
                    type="date"
                    value={itemEditando.dataVencimentoGarantia || ''}
                    onChange={e => setItemEditando({...itemEditando, dataVencimentoGarantia: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Fornecedor */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fornecedor / Empresa</label>
                  <input
                    type="text"
                    value={itemEditando.fornecedor}
                    onChange={e => setItemEditando({...itemEditando, fornecedor: e.target.value})}
                    placeholder="Nome do fornecedor"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Contato</label>
                  <input
                    type="text"
                    value={itemEditando.telefoneContato}
                    onChange={e => setItemEditando({...itemEditando, telefoneContato: e.target.value})}
                    placeholder="(11) 99999-9999"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Contrato */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número do Contrato</label>
                  <input
                    type="text"
                    value={itemEditando.numeroContrato}
                    onChange={e => setItemEditando({...itemEditando, numeroContrato: e.target.value})}
                    placeholder="Nº do contrato"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor do Contrato</label>
                  <input
                    type="number"
                    value={itemEditando.valorContrato}
                    onChange={e => setItemEditando({...itemEditando, valorContrato: parseFloat(e.target.value) || 0})}
                    placeholder="0,00"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              {/* Observações */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                <textarea
                  value={itemEditando.observacoes}
                  onChange={e => setItemEditando({...itemEditando, observacoes: e.target.value})}
                  rows={3}
                  placeholder="Observações sobre a manutenção..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-200">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={salvarItem}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Gerenciamento de Tipos */}
      {modalTiposAberto && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <List className="w-5 h-5" />
                Gerenciar Tipos de Itens
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={abrirModalNovoTipo}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Novo Item
                </button>
                <button onClick={fecharModalTipos} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>
            
            {tipoEditando ? (
              // Formulário de edição/criação de tipo
              <div className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Item *</label>
                    <input
                      type="text"
                      value={tipoEditando.nome}
                      onChange={e => setTipoEditando({...tipoEditando, nome: e.target.value})}
                      placeholder="Ex: Sistema de Ar Condicionado"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                    <select
                      value={tipoEditando.categoria}
                      onChange={e => setTipoEditando({...tipoEditando, categoria: e.target.value as CategoriaItem})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="equipamento">Equipamento</option>
                      <option value="estrutura">Estrutura</option>
                      <option value="administrativo">Administrativo</option>
                    </select>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Periodicidade (meses)</label>
                    <input
                      type="number"
                      value={tipoEditando.periodicidadeMeses}
                      onChange={e => setTipoEditando({...tipoEditando, periodicidadeMeses: parseInt(e.target.value) || 6})}
                      min="1"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center pt-7">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tipoEditando.obrigatorio}
                        onChange={e => setTipoEditando({...tipoEditando, obrigatorio: e.target.checked})}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">Item obrigatório para condomínios</span>
                    </label>
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descrição Padrão</label>
                  <textarea
                    value={tipoEditando.descricaoPadrao}
                    onChange={e => setTipoEditando({...tipoEditando, descricaoPadrao: e.target.value})}
                    rows={3}
                    placeholder="Descrição padrão que aparecerá ao criar registros deste tipo..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={fecharModalTipos}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={salvarTipo}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    Salvar Tipo
                  </button>
                </div>
              </div>
            ) : (
              // Lista de tipos
              <div className="p-4">
                <div className="mb-4 text-sm text-gray-600">
                  <p className="mb-2"><strong>Tipos Padrão:</strong> Não podem ser editados ou excluídos</p>
                  <p><strong>Tipos Customizados:</strong> Podem ser editados e excluídos (se não estiverem em uso)</p>
                </div>
                
                <div className="space-y-4">
                  {/* Tipos Padrão */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Tipos Padrão ({TIPOS_ITENS_MANUTENCAO.length})</h3>
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Nome</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Categoria</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Periodicidade</th>
                            <th className="px-3 py-2 text-left font-semibold text-gray-700">Obrigatório</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {TIPOS_ITENS_MANUTENCAO.map(tipo => (
                            <tr key={tipo.id} className="hover:bg-gray-50">
                              <td className="px-3 py-2 text-gray-900">{tipo.nome}</td>
                              <td className="px-3 py-2">
                                <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                  tipo.categoria === 'equipamento' ? 'bg-blue-100 text-blue-800' :
                                  tipo.categoria === 'estrutura' ? 'bg-purple-100 text-purple-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {tipo.categoria}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-gray-600">{tipo.periodicidadeMeses} meses</td>
                              <td className="px-3 py-2">
                                {tipo.obrigatorio ? (
                                  <span className="text-green-600 font-medium">Sim</span>
                                ) : (
                                  <span className="text-gray-400">Não</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Tipos Customizados */}
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-2">Tipos Customizados ({tiposCustomizados.length})</h3>
                    {tiposCustomizados.length === 0 ? (
                      <div className="border border-gray-200 rounded-lg p-8 text-center text-gray-500">
                        <p>Nenhum tipo customizado criado ainda.</p>
                        <p className="text-sm mt-1">Clique em "Novo Item" para criar um novo tipo.</p>
                      </div>
                    ) : (
                      <div className="border border-gray-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Nome</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Categoria</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Periodicidade</th>
                              <th className="px-3 py-2 text-left font-semibold text-gray-700">Obrigatório</th>
                              <th className="px-3 py-2 text-center font-semibold text-gray-700">Ações</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {tiposCustomizados.map(tipo => (
                              <tr key={tipo.id} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-gray-900">{tipo.nome}</td>
                                <td className="px-3 py-2">
                                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                    tipo.categoria === 'equipamento' ? 'bg-blue-100 text-blue-800' :
                                    tipo.categoria === 'estrutura' ? 'bg-purple-100 text-purple-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {tipo.categoria}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-gray-600">{tipo.periodicidadeMeses} meses</td>
                                <td className="px-3 py-2">
                                  {tipo.obrigatorio ? (
                                    <span className="text-green-600 font-medium">Sim</span>
                                  ) : (
                                    <span className="text-gray-400">Não</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => abrirModalEditarTipo(tipo)}
                                      className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                                      title="Editar"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => excluirTipo(tipo.id)}
                                      className="p-1 text-red-600 hover:bg-red-100 rounded"
                                      title="Excluir"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
