import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenInfo } from '../components/TokenInfo'
import { Upload, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react'

interface Condominio {
  id: string
  nome: string
  idCondominio: string
}

interface Despesa {
  id: string
  idDespesa?: string
  idParcela?: string
  descricao: string
  fornecedor: string
  valor: number
  dataVencimento: string
  dataLiquidacao?: string
  status: 'pendente' | 'liquidada' | 'vencida'
  categoria?: string
  contaCompleta?: string // Ex: "2.1.6"
  contaMae?: number // Ex: 2 (primeiro número da conta)
  tipo: 'prevista' | 'realizada'
}


// Função para formatar data sempre como DD/MM/YYYY
function formatarData(data: string): string {
  if (!data || !data.trim()) return ''
  try {
    let date: Date
    
    // Se já está no formato DD/MM/YYYY, validar e retornar
    if (data.includes('/')) {
      const partes = data.split('/').map(p => p.trim())
      if (partes.length === 3) {
        const p1 = parseInt(partes[0])
        const p2 = parseInt(partes[1])
        const p3 = parseInt(partes[2])
        
        // Se primeiro número > 12, provavelmente é DD/MM/YYYY
        if (p1 > 12 && p1 <= 31 && p2 <= 12) {
          date = new Date(p3, p2 - 1, p1)
          if (!isNaN(date.getTime())) {
            return `${String(p1).padStart(2, '0')}/${String(p2).padStart(2, '0')}/${p3}`
          }
        }
        // Se segundo número > 12, provavelmente é MM/DD/YYYY (formato da API)
        else if (p1 <= 12 && p2 > 12 && p2 <= 31) {
          date = new Date(p3, p1 - 1, p2)
          if (!isNaN(date.getTime())) {
            // Converter MM/DD/YYYY para DD/MM/YYYY
            return `${String(p2).padStart(2, '0')}/${String(p1).padStart(2, '0')}/${p3}`
          }
        }
        // Ambos <= 12, tentar como MM/DD/YYYY primeiro (formato comum da API)
        else if (p1 <= 12 && p2 <= 12) {
          date = new Date(p3, p1 - 1, p2) // MM/DD/YYYY
          if (!isNaN(date.getTime()) && date.getDate() === p2 && date.getMonth() + 1 === p1) {
            // Converter MM/DD/YYYY para DD/MM/YYYY
            return `${String(p2).padStart(2, '0')}/${String(p1).padStart(2, '0')}/${p3}`
          }
          // Tentar como DD/MM/YYYY
          date = new Date(p3, p2 - 1, p1)
          if (!isNaN(date.getTime())) {
            return `${String(p1).padStart(2, '0')}/${String(p2).padStart(2, '0')}/${p3}`
          }
        }
      }
    }
    
    // Tentar parsear como Date padrão (YYYY-MM-DD ou outros formatos)
    date = new Date(data)
    if (!isNaN(date.getTime())) {
      // Sempre retornar DD/MM/YYYY
      const dia = String(date.getDate()).padStart(2, '0')
      const mes = String(date.getMonth() + 1).padStart(2, '0')
      const ano = date.getFullYear()
      return `${dia}/${mes}/${ano}`
    }
    
    return data
  } catch {
    return data
  }
}

// Função para converter data para formato da API (MM/DD/YYYY conforme exemplo do Postman)
function formatarDataParaAPI(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  const ano = data.getFullYear()
  // Formato MM/DD/YYYY conforme exemplo: dtInicio=01/01/2018&dtFim=12/31/2018
  return `${mes}/${dia}/${ano}`
}

// Função para obter primeiro e último dia do mês atual
function obterPeriodoMesAtual(): { inicio: string; fim: string } {
  const agora = new Date()
  const primeiroDia = new Date(agora.getFullYear(), agora.getMonth(), 1)
  const ultimoDia = new Date(agora.getFullYear(), agora.getMonth() + 1, 0)
  
  return {
    inicio: formatarDataParaAPI(primeiroDia),
    fim: formatarDataParaAPI(ultimoDia)
  }
}

// Função para buscar condomínios
async function buscarCondominios(apiInstance: typeof api): Promise<Condominio[]> {
  try {
    console.log('[FluxoCaixa] Buscando condomínios...')
    const todosCondominios: Condominio[] = []
    let pagina = 1
    let temMais = true
    
    // Buscar TODOS os condomínios disponíveis
    while (temMais) {
      try {
        const url = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${pagina}`
        const response = await apiInstance.get<any>(url)
        
        const data = response.data
        const listCondominios = Array.isArray(data) 
          ? data 
          : data?.data || data?.condominios || []
        
        if (listCondominios.length === 0) {
          temMais = false
          break
        }
        
        listCondominios.forEach((cond: any) => {
          // SEMPRE usar nome fantasia primeiro, depois nome
          const nomeFantasia = (cond.st_fantasia_cond || cond.nomeFantasia || '').trim()
          const nome = (cond.st_nome_cond || cond.nome || '').trim()
          const nomeFinal = nomeFantasia || nome || ''
          const idCondominio = cond.id_condominio_cond || cond.id || ''
          
          if (nomeFinal && idCondominio) {
            todosCondominios.push({
              id: idCondominio,
              nome: nomeFinal,
              idCondominio: idCondominio
            })
          }
        })
        
        if (listCondominios.length < 100) {
          temMais = false
        } else {
          pagina++
        }
      } catch (err: any) {
        if (err?.response?.status === 401) {
          throw err
        }
        temMais = false
      }
    }
    
    // Ordenar TODOS os condomínios alfabeticamente por nome fantasia
    const condominiosOrdenados = todosCondominios.sort((a, b) => {
      const nomeA = (a.nome || '').toLowerCase().trim()
      const nomeB = (b.nome || '').toLowerCase().trim()
      return nomeA.localeCompare(nomeB, 'pt-BR', { 
        sensitivity: 'base', 
        numeric: true,
        ignorePunctuation: true
      })
    })
    
    console.log(`[FluxoCaixa] ✅ ${condominiosOrdenados.length} condomínios encontrados e ordenados`)
    console.log('[FluxoCaixa] Primeiros 5 ordenados:', condominiosOrdenados.slice(0, 5).map(c => c.nome))
    
    return condominiosOrdenados
  } catch (error: any) {
    console.error('[FluxoCaixa] Erro ao buscar condomínios:', error)
    throw error
  }
}

// Função para buscar despesas do mês
async function buscarDespesas(
  apiInstance: typeof api,
  idCondominio: string,
  dtInicio: string,
  dtFim: string
): Promise<Despesa[]> {
  try {
    console.log(`[FluxoCaixa] Buscando despesas para condomínio ${idCondominio}...`)
    
    const despesas: Despesa[] = []
    
    // Buscar despesas pendentes (previstas)
    try {
      const urlPendentes = `/api/condominios/superlogica/despesas/index?comStatus=pendentes&dtInicio=${dtInicio}&dtFim=${dtFim}&idCondominio=${idCondominio}&itensPorPagina=100&pagina=1`
      const responsePendentes = await apiInstance.get<any>(urlPendentes)
      
      const dataPendentes = responsePendentes.data
      const listPendentes = Array.isArray(dataPendentes) 
        ? dataPendentes 
        : dataPendentes?.data || dataPendentes?.despesas || []
      
      listPendentes.forEach((item: any) => {
        const valor = parseFloat(item.vl_valor_pdes || item.valor || item.vlValorPdes || '0') || 0
        const dataVencimento = item.dt_vencimento_pdes || item.dataVencimento || item.dtVencimentoPdes || ''
        const contaCompleta = (item.st_conta_cont || item.categoria || item.stContaCont || '').trim()
        
        // Extrair conta mãe (primeiro número antes do primeiro ponto)
        let contaMae: number | undefined
        if (contaCompleta) {
          const primeiraParte = contaCompleta.split('.')[0]
          const numero = parseInt(primeiraParte)
          if (!isNaN(numero)) {
            contaMae = numero
          }
        }
        
        // Evitar duplicação: se descrição já contém o nome do fornecedor, não mostrar fornecedor separadamente
        const fornecedorNome = (item.st_nome_con || item.nomeFornecedor || item.stNomeCon || '').trim()
        const descricaoOriginal = (item.st_descricao_apro || item.descricao || item.stDescricaoApro || '').trim()
        const descricao = descricaoOriginal || fornecedorNome || 'Despesa'
        const fornecedor = descricaoOriginal && descricaoOriginal !== fornecedorNome ? fornecedorNome : ''
        
        if (valor > 0 && dataVencimento) {
          despesas.push({
            id: `${item.id_despesa_des || item.idDespesaDes || ''}_${item.id_parcela_pdes || item.idParcelaPdes || ''}`,
            idDespesa: item.id_despesa_des || item.idDespesaDes || '',
            idParcela: item.id_parcela_pdes || item.idParcelaPdes || '',
            descricao: descricao,
            fornecedor: fornecedor,
            valor: valor,
            dataVencimento: dataVencimento,
            status: 'pendente',
            categoria: contaCompleta || '',
            contaCompleta: contaCompleta || undefined,
            contaMae: contaMae,
            tipo: 'prevista'
          })
        }
      })
      
      console.log(`[FluxoCaixa] ✅ ${listPendentes.length} despesas pendentes encontradas`)
    } catch (err: any) {
      console.warn('[FluxoCaixa] Erro ao buscar despesas pendentes:', err)
    }
    
    // Buscar despesas liquidadas (realizadas)
    try {
      const urlLiquidadas = `/api/condominios/superlogica/despesas/index?comStatus=liquidadas&dtInicio=${dtInicio}&dtFim=${dtFim}&idCondominio=${idCondominio}&itensPorPagina=100&pagina=1`
      const responseLiquidadas = await apiInstance.get<any>(urlLiquidadas)
      
      const dataLiquidadas = responseLiquidadas.data
      const listLiquidadas = Array.isArray(dataLiquidadas) 
        ? dataLiquidadas 
        : dataLiquidadas?.data || dataLiquidadas?.despesas || []
      
      listLiquidadas.forEach((item: any) => {
        const valor = parseFloat(item.vl_valor_pdes || item.valor || item.vlValorPdes || item.vl_pago || item.valorPago || '0') || 0
        const dataVencimento = item.dt_vencimento_pdes || item.dataVencimento || item.dtVencimentoPdes || ''
        const dataLiquidacao = item.dt_liquidacao_pdes || item.dataLiquidacao || item.dtLiquidacaoPdes || ''
        const contaCompleta = (item.st_conta_cont || item.categoria || item.stContaCont || '').trim()
        
        // Extrair conta mãe (primeiro número antes do primeiro ponto)
        let contaMae: number | undefined
        if (contaCompleta) {
          const primeiraParte = contaCompleta.split('.')[0]
          const numero = parseInt(primeiraParte)
          if (!isNaN(numero)) {
            contaMae = numero
          }
        }
        
        // Evitar duplicação: se descrição já contém o nome do fornecedor, não mostrar fornecedor separadamente
        const fornecedorNome = (item.st_nome_con || item.nomeFornecedor || item.stNomeCon || '').trim()
        const descricaoOriginal = (item.st_descricao_apro || item.descricao || item.stDescricaoApro || '').trim()
        const descricao = descricaoOriginal || fornecedorNome || 'Despesa'
        const fornecedor = descricaoOriginal && descricaoOriginal !== fornecedorNome ? fornecedorNome : ''
        
        if (valor > 0 && dataLiquidacao) {
          despesas.push({
            id: `${item.id_despesa_des || item.idDespesaDes || ''}_${item.id_parcela_pdes || item.idParcelaPdes || ''}`,
            idDespesa: item.id_despesa_des || item.idDespesaDes || '',
            idParcela: item.id_parcela_pdes || item.idParcelaPdes || '',
            descricao: descricao,
            fornecedor: fornecedor,
            valor: valor,
            dataVencimento: dataVencimento,
            dataLiquidacao: dataLiquidacao,
            status: 'liquidada',
            categoria: contaCompleta || '',
            contaCompleta: contaCompleta || undefined,
            contaMae: contaMae,
            tipo: 'realizada'
          })
        }
      })
      
      console.log(`[FluxoCaixa] ✅ ${listLiquidadas.length} despesas liquidadas encontradas`)
    } catch (err: any) {
      console.warn('[FluxoCaixa] Erro ao buscar despesas liquidadas:', err)
    }
    
    console.log(`[FluxoCaixa] ✅ Total de ${despesas.length} despesas processadas`)
    return despesas
  } catch (error: any) {
    console.error('[FluxoCaixa] Erro ao buscar despesas:', error)
    throw error
  }
}

export function FluxoCaixa() {
  const { token, companyId } = useAuth()
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [condominioSelecionado, setCondominioSelecionado] = useState<Condominio | null>(null)
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingDespesas, setLoadingDespesas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)
  const loadingRef = useRef(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Obter período do mês atual
  const periodoMesAtual = useMemo(() => obterPeriodoMesAtual(), [])

  // Carregar condomínios ao montar
  useEffect(() => {
    let cancelled = false
    let mounted = true
    
    async function carregarCondominios() {
      if (loadingRef.current) return
      if (!token || !companyId) {
        setLoading(false)
        return
      }
      
      loadingRef.current = true
      setLoading(true)
      setError(null)
      
      try {
        const condominiosEncontrados = await buscarCondominios(api)
        
        if (cancelled || !mounted) return
        
        // Condomínios já vêm ordenados alfabeticamente da função buscarCondominios
        setCondominios(condominiosEncontrados)
        
        // Selecionar sempre o primeiro condomínio em ordem alfabética (não por ID)
        if (condominiosEncontrados.length > 0) {
          // Sempre selecionar o primeiro da lista ordenada (primeiro alfabeticamente)
          const primeiroAlfabetico = condominiosEncontrados[0]
          console.log('[FluxoCaixa] Selecionando primeiro condomínio alfabeticamente:', primeiroAlfabetico.nome)
          setCondominioSelecionado(primeiroAlfabetico)
        }
      } catch (error: any) {
        if (cancelled || !mounted) return
        console.error('[FluxoCaixa] Erro ao carregar condomínios:', error)
        if (error?.response?.status === 401) {
          setError('Token de autenticação expirado.')
        } else {
          setError(error.message || 'Erro ao carregar condomínios')
        }
      } finally {
        if (mounted) {
          setLoading(false)
          loadingRef.current = false
        }
      }
    }
    
    carregarCondominios()
    
    return () => {
      cancelled = true
      mounted = false
      loadingRef.current = false
    }
  }, [token, companyId])

  // Carregar despesas quando condomínio for selecionado
  useEffect(() => {
    if (!condominioSelecionado || !token || !companyId) return
    
    let cancelled = false
    let mounted = true
    
    async function carregarDespesas() {
      if (loadingRef.current) return
      
      loadingRef.current = true
      setLoadingDespesas(true)
      setError(null)
      
      try {
        const despesasEncontradas = await buscarDespesas(
          api,
          condominioSelecionado.idCondominio,
          periodoMesAtual.inicio,
          periodoMesAtual.fim
        )
        
        if (cancelled || !mounted) return
        
        setDespesas(despesasEncontradas)
      } catch (error: any) {
        if (cancelled || !mounted) return
        console.error('[FluxoCaixa] Erro ao carregar despesas:', error)
        if (error?.response?.status === 401) {
          setError('Token de autenticação expirado.')
        } else {
          setError(error.message || 'Erro ao carregar despesas')
        }
      } finally {
        if (mounted) {
          setLoadingDespesas(false)
          loadingRef.current = false
        }
      }
    }
    
    carregarDespesas()
    
    return () => {
      cancelled = true
      mounted = false
      loadingRef.current = false
    }
  }, [condominioSelecionado, token, companyId, periodoMesAtual])

  // Fechar menu ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuAberto(false)
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Separar despesas em realizadas/a realizar e projetadas
  const despesasRealizadasARealizar = useMemo(() => {
    // Despesas realizadas (já pagas) e pendentes (a realizar)
    return despesas.filter(d => d.tipo === 'realizada' || (d.tipo === 'prevista' && d.status === 'pendente'))
      .sort((a, b) => {
        const dataA = a.tipo === 'realizada' && a.dataLiquidacao ? a.dataLiquidacao : a.dataVencimento
        const dataB = b.tipo === 'realizada' && b.dataLiquidacao ? b.dataLiquidacao : b.dataVencimento
        if (!dataA || !dataB) return 0
        
        // Converter para Date para ordenar
        const partesA = formatarData(dataA).split('/')
        const partesB = formatarData(dataB).split('/')
        if (partesA.length === 3 && partesB.length === 3) {
          const dateA = new Date(parseInt(partesA[2]), parseInt(partesA[1]) - 1, parseInt(partesA[0]))
          const dateB = new Date(parseInt(partesB[2]), parseInt(partesB[1]) - 1, parseInt(partesB[0]))
          return dateA.getTime() - dateB.getTime()
        }
        return dataA.localeCompare(dataB)
      })
  }, [despesas])

  const despesasProjetadas = useMemo(() => {
    // Despesas projetadas (previstas que ainda não venceu ou são recorrentes)
    return despesas.filter(d => d.tipo === 'prevista' && d.status !== 'pendente')
      .sort((a, b) => {
        const dataA = a.dataVencimento || ''
        const dataB = b.dataVencimento || ''
        if (!dataA || !dataB) return 0
        
        const partesA = formatarData(dataA).split('/')
        const partesB = formatarData(dataB).split('/')
        if (partesA.length === 3 && partesB.length === 3) {
          const dateA = new Date(parseInt(partesA[2]), parseInt(partesA[1]) - 1, parseInt(partesA[0]))
          const dateB = new Date(parseInt(partesB[2]), parseInt(partesB[1]) - 1, parseInt(partesB[0]))
          return dateA.getTime() - dateB.getTime()
        }
        return dataA.localeCompare(dataB)
      })
  }, [despesas])

  // Agrupar despesas realizadas/a realizar por conta/categoria (ordenado por conta mãe)
  const despesasRealizadasAgrupadas = useMemo(() => {
    const agrupadas = new Map<string, { conta: string; contaMae: number; despesas: Despesa[]; total: number }>()
    
    despesasRealizadasARealizar.forEach(despesa => {
      const conta = despesa.contaCompleta || despesa.categoria || 'Sem categoria'
      const contaMae = despesa.contaMae ?? 9999 // Sem conta mãe vai para o final
      
      if (!agrupadas.has(conta)) {
        agrupadas.set(conta, {
          conta: conta,
          contaMae: contaMae,
          despesas: [],
          total: 0
        })
      }
      
      const grupo = agrupadas.get(conta)!
      grupo.despesas.push(despesa)
      grupo.total += despesa.valor
    })
    
    // Ordenar por conta mãe (ordem numérica), depois por conta completa
    return Array.from(agrupadas.values()).sort((a, b) => {
      // Primeiro ordenar por conta mãe
      if (a.contaMae !== b.contaMae) {
        return a.contaMae - b.contaMae
      }
      // Se mesma conta mãe, ordenar por conta completa (ex: 2.1.1 antes de 2.1.2)
      return a.conta.localeCompare(b.conta, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [despesasRealizadasARealizar])

  // Agrupar despesas projetadas por conta/categoria (ordenado por conta mãe)
  const despesasProjetadasAgrupadas = useMemo(() => {
    const agrupadas = new Map<string, { conta: string; contaMae: number; despesas: Despesa[]; total: number }>()
    
    despesasProjetadas.forEach(despesa => {
      const conta = despesa.contaCompleta || despesa.categoria || 'Sem categoria'
      const contaMae = despesa.contaMae ?? 9999 // Sem conta mãe vai para o final
      
      if (!agrupadas.has(conta)) {
        agrupadas.set(conta, {
          conta: conta,
          contaMae: contaMae,
          despesas: [],
          total: 0
        })
      }
      
      const grupo = agrupadas.get(conta)!
      grupo.despesas.push(despesa)
      grupo.total += despesa.valor
    })
    
    // Ordenar por conta mãe (ordem numérica), depois por conta completa
    return Array.from(agrupadas.values()).sort((a, b) => {
      // Primeiro ordenar por conta mãe
      if (a.contaMae !== b.contaMae) {
        return a.contaMae - b.contaMae
      }
      // Se mesma conta mãe, ordenar por conta completa (ex: 2.1.1 antes de 2.1.2)
      return a.conta.localeCompare(b.conta, undefined, { numeric: true, sensitivity: 'base' })
    })
  }, [despesasProjetadas])

  // Calcular totais
  const totais = useMemo(() => {
    const realizadasARealizar = despesasRealizadasARealizar.reduce((sum, d) => sum + d.valor, 0)
    const projetadas = despesasProjetadas.reduce((sum, d) => sum + d.valor, 0)
    
    return {
      totalRealizadasARealizar: realizadasARealizar,
      totalProjetadas: projetadas,
      quantidadeRealizadasARealizar: despesasRealizadasARealizar.length,
      quantidadeProjetadas: despesasProjetadas.length
    }
  }, [despesasRealizadasARealizar, despesasProjetadas])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando condomínios...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 space-y-3">
      <div className="bg-white shadow rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Fluxo de Caixa</h1>
            <p className="text-xs text-gray-600">Despesas previstas e realizadas do mês em curso</p>
          </div>
          <TokenInfo />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
            <p className="text-red-800 text-xs font-medium">Erro: {error}</p>
            {error.includes('expirado') && (
              <p className="text-red-600 text-xs mt-1">
                Renovar: <code className="bg-red-100 px-1 py-0.5 rounded text-xs">./iap auth</code>
              </p>
            )}
          </div>
        )}

        {/* Seletor de Condomínios */}
        <div className="mb-1 flex items-center gap-2">
          <div className="relative flex-shrink-0" style={{ width: '50ch' }} ref={menuRef}>
            <label className="block text-xs font-medium text-gray-700 mb-0.5">Condomínio:</label>
            <button
              onClick={() => setMenuAberto(!menuAberto)}
              className="w-full bg-white border border-gray-300 rounded px-2 py-0.5 text-left flex items-center justify-between hover:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 text-xs h-7"
            >
              <span className={condominioSelecionado ? 'text-gray-900 truncate' : 'text-gray-500'}>
                {condominioSelecionado ? condominioSelecionado.nome : 'Selecione'}
              </span>
              {menuAberto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            
            {menuAberto && (
              <div className="absolute z-50 w-full mt-0.5 bg-white border border-gray-300 rounded shadow-lg max-h-80 overflow-y-auto">
                {condominios.length === 0 ? (
                  <div className="px-2 py-0.5 text-gray-500 text-xs">Nenhum condomínio encontrado</div>
                ) : (
                  <>
                    <div className="px-2 py-1 bg-gray-100 border-b border-gray-200 text-xs font-semibold text-gray-700 sticky top-0">
                      {condominios.length} condomínio(s) disponível(is)
                    </div>
                    {condominios.map((cond) => (
                      <button
                        key={cond.id}
                        onClick={() => {
                          setCondominioSelecionado(cond)
                          setMenuAberto(false)
                        }}
                        className={`w-full text-left px-2 py-1 hover:bg-blue-50 transition-colors text-xs ${
                          condominioSelecionado?.id === cond.id ? 'bg-blue-100 font-medium' : ''
                        }`}
                      >
                        {cond.nome}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex-1 text-xs text-gray-500 pt-5">
            Período: {formatarData(periodoMesAtual.inicio)} até {formatarData(periodoMesAtual.fim)}
          </div>
        </div>

        {/* Totais Compactos */}
        {condominioSelecionado && (
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div className="bg-green-50 border border-green-200 rounded p-2">
              <div className="text-xs text-green-600 font-medium">Realizadas/A Realizar</div>
              <div className="text-sm font-bold text-green-900">{formatCurrency(totais.totalRealizadasARealizar)}</div>
              <div className="text-xs text-green-600">{totais.quantidadeRealizadasARealizar} despesa(s)</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <div className="text-xs text-blue-600 font-medium">Projetadas</div>
              <div className="text-sm font-bold text-blue-900">{formatCurrency(totais.totalProjetadas)}</div>
              <div className="text-xs text-blue-600">{totais.quantidadeProjetadas} despesa(s)</div>
            </div>
          </div>
        )}

        {/* Lista de Despesas em 2 Colunas */}
        {loadingDespesas ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-1"></div>
            <p className="text-gray-600 text-xs">Carregando...</p>
          </div>
        ) : condominioSelecionado && (despesasRealizadasAgrupadas.length > 0 || despesasProjetadasAgrupadas.length > 0) ? (
          <div className="grid grid-cols-2 gap-2">
            {/* Coluna 1: Realizadas/A Realizar */}
            <div className="space-y-1">
              <div className="bg-green-100 border border-green-300 rounded px-2 py-1 mb-1">
                <div className="text-xs font-bold text-green-900">Realizadas/A Realizar</div>
                <div className="text-xs text-green-700">
                  Total: {formatCurrency(totais.totalRealizadasARealizar)} ({totais.quantidadeRealizadasARealizar})
                </div>
              </div>
              {despesasRealizadasAgrupadas.length > 0 ? (
                despesasRealizadasAgrupadas.map((grupo, index) => (
                  <div key={index} className="border border-gray-200 rounded overflow-hidden">
                    <div className="bg-gray-50 px-2 py-0.5 border-b border-gray-200">
                      <div className="font-semibold text-gray-900 text-xs">Conta: {grupo.conta}</div>
                      <div className="text-xs text-gray-600">Total: {formatCurrency(grupo.total)} ({grupo.despesas.length} despesa(s))</div>
                    </div>
                    {grupo.despesas.map((despesa) => (
                      <div 
                        key={despesa.id} 
                        className={`px-2 py-0.5 border-b border-gray-100 last:border-0 ${
                          despesa.tipo === 'realizada' ? 'bg-blue-50/30 hover:bg-blue-50/50' : 'bg-yellow-50/30 hover:bg-yellow-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{despesa.descricao}</div>
                            {despesa.fornecedor && (
                              <div className="text-xs text-gray-600 truncate">{despesa.fornecedor}</div>
                            )}
                            <div className={`text-xs ${
                              despesa.tipo === 'realizada' ? 'text-blue-600' : 'text-gray-500'
                            }`}>
                              {despesa.tipo === 'realizada' 
                                ? `Pago: ${formatarData(despesa.dataLiquidacao || '')}`
                                : `Venc: ${formatarData(despesa.dataVencimento)}`
                              }
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className={`text-xs font-semibold ${
                              despesa.tipo === 'realizada' ? 'text-blue-900' : 'text-yellow-900'
                            }`}>
                              {formatCurrency(despesa.valor)}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-gray-500 text-xs border border-gray-200 rounded">
                  Nenhuma despesa realizada/a realizar
                </div>
              )}
            </div>

            {/* Coluna 2: Projetadas */}
            <div className="space-y-1">
              <div className="bg-blue-100 border border-blue-300 rounded px-2 py-1 mb-1">
                <div className="text-xs font-bold text-blue-900">Projetadas</div>
                <div className="text-xs text-blue-700">
                  Total: {formatCurrency(totais.totalProjetadas)} ({totais.quantidadeProjetadas})
                </div>
              </div>
              {despesasProjetadasAgrupadas.length > 0 ? (
                despesasProjetadasAgrupadas.map((grupo, index) => (
                  <div key={index} className="border border-gray-200 rounded overflow-hidden">
                    <div className="bg-gray-50 px-2 py-0.5 border-b border-gray-200">
                      <div className="font-semibold text-gray-900 text-xs">Conta: {grupo.conta}</div>
                      <div className="text-xs text-gray-600">Total: {formatCurrency(grupo.total)} ({grupo.despesas.length} despesa(s))</div>
                    </div>
                    {grupo.despesas.map((despesa) => (
                      <div 
                        key={despesa.id} 
                        className="px-2 py-0.5 bg-blue-50/30 hover:bg-blue-50/50 border-b border-blue-100/30 last:border-0"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 truncate">{despesa.descricao}</div>
                            <div className="text-xs text-gray-600 truncate">{despesa.fornecedor}</div>
                            <div className="text-xs text-blue-600">Venc: {formatarData(despesa.dataVencimento)}</div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-xs font-semibold text-blue-900">{formatCurrency(despesa.valor)}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              ) : (
                <div className="text-center py-2 text-gray-500 text-xs border border-gray-200 rounded">
                  Nenhuma despesa projetada
                </div>
              )}
            </div>
          </div>
        ) : condominioSelecionado ? (
          <div className="text-center py-4 text-gray-500 text-xs">
            Nenhuma despesa encontrada para o período selecionado.
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 text-xs">
            Selecione um condomínio para visualizar as despesas.
          </div>
        )}
      </div>
    </div>
  )
}

