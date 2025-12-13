import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Upload } from 'lucide-react'

type Manutencao = {
  id: string
  condominio: string
  tipo: string
  fornecedor: string
  descricao: string
  dataVencimento: string
  valor: number
  status: 'pendente' | 'vencido' | 'concluido'
  prioridade: 'baixa' | 'media' | 'alta'
  observacoes?: string
  idCondominio?: string
}

const STORAGE_KEY = 'manutencoes_db'

// Funções para gerenciar dados no localStorage
function carregarManutencoes(): Manutencao[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data)
  } catch (error) {
    console.error('[ManutencoesDB] Erro ao carregar:', error)
    return []
  }
}

function salvarManutencoes(manutencoes: Manutencao[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(manutencoes))
  } catch (error) {
    console.error('[ManutencoesDB] Erro ao salvar:', error)
  }
}

function gerarIdManutencao(condominio: string, tipo: string): string {
  return `${condominio}_${tipo}`.replace(/[^a-zA-Z0-9_]/g, '_')
}

// Função para buscar dados de manutenções da API
async function carregarManutencoesDaAPI(apiInstance: typeof api, companyId: string): Promise<Manutencao[]> {
  try {
    console.log('[Manutencoes] ========== BUSCANDO MANUTENÇÕES DA API ==========')
    console.log('[Manutencoes] Company ID:', companyId)
    
    // Tentar buscar manutenções da API
    // Primeiro, tentar endpoint específico de manutenções se existir
    let manutencoes: Manutencao[] = []
    
    try {
      // Tentar endpoint específico de manutenções
      const responseManutencoes = await apiInstance.get<any>('/api/condominios/superlogica/manutencoes/get')
      const dataManutencoes = responseManutencoes.data
      const listManutencoes = Array.isArray(dataManutencoes) 
        ? dataManutencoes 
        : dataManutencoes?.data || dataManutencoes?.manutencoes || []
      
      if (listManutencoes.length > 0) {
        console.log(`[Manutencoes] ✅ Encontradas ${listManutencoes.length} manutenções no endpoint específico`)
        manutencoes = listManutencoes.map((item: any) => ({
          id: gerarIdManutencao(item.condominio || item.nomeCondominio || '', item.tipo || ''),
          condominio: item.condominio || item.nomeCondominio || item.nomeFantasia || '',
          tipo: item.tipo || item.tipoManutencao || '',
          fornecedor: item.fornecedor || item.nomeFornecedor || '',
          descricao: item.descricao || item.descricaoManutencao || '',
          dataVencimento: item.dataVencimento || item.dataVencimentoManutencao || item.dtVencimento || '',
          valor: item.valor || item.valorManutencao || 0,
          status: item.status || 'pendente',
          prioridade: item.prioridade || 'media',
          observacoes: item.observacoes || '',
          idCondominio: item.idCondominio || item.id_condominio_cond || ''
        }))
        return manutencoes
      }
    } catch (err: any) {
      console.log('[Manutencoes] Endpoint específico de manutenções não disponível, tentando buscar de condomínios...')
    }
    
    // Se não encontrou endpoint específico, buscar dados de condomínios e criar entradas básicas
    let todosCondominios: any[] = []
    let paginaCondominios = 1
    let temMaisCondominios = true
    
    while (temMaisCondominios) {
      try {
        // Buscar TODAS as colunas para ter acesso a dados completos
        const urlCondominios = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${paginaCondominios}`
        console.log(`[Manutencoes] Buscando condomínios página ${paginaCondominios}...`)
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
    
    console.log(`[Manutencoes] ✅ Total de condomínios encontrados: ${todosCondominios.length}`)
    
    // Criar entradas básicas de manutenção para cada condomínio
    if (manutencoes.length === 0) {
      let criados = 0
      todosCondominios.forEach((condominio: any) => {
        const nomeCondominio = condominio.st_nome_cond || condominio.st_fantasia_cond || condominio.nomeFantasia || condominio.nome || condominio.razaoSocial || ''
        if (nomeCondominio && nomeCondominio.trim()) {
          // Criar entradas básicas para diferentes tipos de manutenção
          const tiposManutencao = ['Elevador', 'Portaria', 'Jardim', 'Limpeza', 'Elétrica', 'Hidráulica', 'Pintura']
          tiposManutencao.forEach(tipo => {
            manutencoes.push({
              id: gerarIdManutencao(nomeCondominio, tipo),
              condominio: nomeCondominio,
              tipo: tipo,
              fornecedor: '',
              descricao: `Manutenção de ${tipo.toLowerCase()}`,
              dataVencimento: '',
              valor: 0,
              status: 'pendente',
              prioridade: 'media',
              observacoes: '',
              idCondominio: condominio.id_condominio_cond || condominio.id || ''
            })
          })
          criados++
        }
      })
      console.log(`[Manutencoes] ✅ Criadas ${manutencoes.length} entradas de manutenção`)
    }
    
    console.log(`[Manutencoes] ✅ Total de manutenções processadas: ${manutencoes.length}`)
    return manutencoes
  } catch (error: any) {
    console.error('[Manutencoes] Erro ao carregar da API:', error)
    throw error
  }
}

export function Manutencoes() {
  const { token, companyId } = useAuth()
  const [data, setData] = useState<Manutencao[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const loadingRef = useRef(false)

  // Carregar dados ao montar componente
  useEffect(() => {
    let cancelled = false
    let mounted = true
    
    async function carregarDados() {
      if (loadingRef.current) return
      
      if (!token || !companyId) {
        setLoading(false)
        return
      }
      
      loadingRef.current = true
      setLoading(true)
      setError(null)
      
      try {
        // Buscar dados da API
        const manutencoesDaAPI = await carregarManutencoesDaAPI(api, companyId)
        
        if (cancelled || !mounted) return
        
        // Carregar do localStorage (preserva edições do usuário)
        const manutencoesDoStorage = carregarManutencoes()
        
        // Mesclar dados: API tem prioridade, mas manter dados editados do localStorage
        const manutencoesMap = new Map<string, Manutencao>()
        
        // Adicionar dados da API primeiro
        manutencoesDaAPI.forEach(m => manutencoesMap.set(m.id, m))
        
        // Mesclar com dados do localStorage (preservar edições)
        manutencoesDoStorage.forEach(m => {
          const existente = manutencoesMap.get(m.id)
          if (existente) {
            // Manter dados da API mas preservar campos editados pelo usuário
            manutencoesMap.set(m.id, {
              ...existente,
              fornecedor: m.fornecedor || existente.fornecedor,
              descricao: m.descricao || existente.descricao,
              dataVencimento: m.dataVencimento || existente.dataVencimento,
              valor: m.valor !== undefined && m.valor !== 0 ? m.valor : existente.valor,
              status: m.status || existente.status,
              prioridade: m.prioridade || existente.prioridade,
              observacoes: m.observacoes || existente.observacoes
            })
          } else {
            manutencoesMap.set(m.id, m)
          }
        })
        
        const manutencoesMescladas = Array.from(manutencoesMap.values())
        setData(manutencoesMescladas)
        salvarManutencoes(manutencoesMescladas)
      } catch (error: any) {
        if (cancelled || !mounted) return
        console.error('[Manutencoes] Erro ao carregar:', error)
        if (error?.response?.status === 401) {
          setError('Token de autenticação expirado.')
        } else {
          setError(error.message || 'Erro ao carregar manutenções')
        }
      } finally {
        if (mounted) {
          setLoading(false)
          loadingRef.current = false
        }
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
    setError(null)
    
    try {
      const manutencoesDaAPI = await carregarManutencoesDaAPI(api, companyId)
      
      // Mesclar com dados existentes
      const manutencoesExistentes = carregarManutencoes()
      const manutencoesMap = new Map<string, Manutencao>()
      
      // Adicionar dados da API primeiro
      manutencoesDaAPI.forEach(m => manutencoesMap.set(m.id, m))
      
      // Mesclar com dados existentes (preservar edições)
      manutencoesExistentes.forEach(m => {
        const existente = manutencoesMap.get(m.id)
        if (existente) {
          manutencoesMap.set(m.id, {
            ...existente,
            fornecedor: m.fornecedor || existente.fornecedor,
            descricao: m.descricao || existente.descricao,
            dataVencimento: m.dataVencimento || existente.dataVencimento,
            valor: m.valor !== undefined && m.valor !== 0 ? m.valor : existente.valor,
            status: m.status || existente.status,
            prioridade: m.prioridade || existente.prioridade,
            observacoes: m.observacoes || existente.observacoes
          })
        } else {
          manutencoesMap.set(m.id, m)
        }
      })
      
      const manutencoesMescladas = Array.from(manutencoesMap.values())
      setData(manutencoesMescladas)
      salvarManutencoes(manutencoesMescladas)
    } catch (error: any) {
      console.error('[Manutencoes] Erro ao recarregar:', error)
      if (error?.response?.status === 401) {
        setError('Token de autenticação expirado.')
      } else {
        setError(error.message || 'Erro ao recarregar dados')
      }
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [token, companyId])

  const filteredData = data.filter(item => {
    const matchesSearch = !searchTerm || 
      item.condominio.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.fornecedor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descricao.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = !filterStatus || item.status === filterStatus

    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const styles = {
      vencido: "bg-red-100 text-red-800",
      pendente: "bg-yellow-100 text-yellow-800",
      concluido: "bg-green-100 text-green-800"
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  const getPrioridadeBadge = (prioridade: string) => {
    const styles = {
      alta: "bg-red-100 text-red-800",
      media: "bg-yellow-100 text-yellow-800",
      baixa: "bg-green-100 text-green-800"
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[prioridade as keyof typeof styles] || 'bg-gray-100 text-gray-800'}`}>
        {prioridade.charAt(0).toUpperCase() + prioridade.slice(1)}
      </span>
    )
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR')
  }

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando manutenções...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-medium">Erro ao carregar manutenções</p>
          <p className="text-red-600 text-sm mt-1">{error}</p>
          <button
            onClick={carregarManutencoes}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="bg-white shadow rounded-lg p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Controle de Manutenção de Equipamentos</h1>
        <p className="text-gray-600 mb-6">Gerencie as manutenções dos condomínios e acompanhe os vencimentos</p>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <p className="text-red-800 font-medium">Erro: {error}</p>
            {error.includes('expirado') && (
              <p className="text-red-600 text-sm mt-1">
                Para renovar, execute no terminal: <code className="bg-red-100 px-2 py-1 rounded">./iap auth</code>
                <br />
                Depois, recarregue a página.
              </p>
            )}
          </div>
        )}
        
        {/* Barra de busca e botão recarregar */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por condomínio, tipo, fornecedor..."
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div className="w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os status</option>
              <option value="pendente">Pendente</option>
              <option value="vencido">Vencido</option>
              <option value="concluido">Concluído</option>
            </select>
          </div>
          
          <button
            onClick={handleRecarregar}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <Upload size={16} />
            <span>Recarregar da API</span>
          </button>
        </div>

        <div className="text-sm text-gray-600 mb-4">
          {filteredData.length} manutenção(ões) encontrada(s)
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Condomínio</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Tipo</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Fornecedor</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Descrição</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Vencimento</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Valor</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Status</th>
                <th className="border-b border-gray-300 px-4 py-3 text-left font-semibold text-gray-700">Prioridade</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-500">
                    Nenhuma manutenção encontrada
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="border-b border-gray-200 px-4 py-3 font-medium">{item.condominio}</td>
                    <td className="border-b border-gray-200 px-4 py-3">{item.tipo}</td>
                    <td className="border-b border-gray-200 px-4 py-3">{item.fornecedor}</td>
                    <td className="border-b border-gray-200 px-4 py-3 max-w-xs truncate" title={item.descricao}>
                      {item.descricao}
                    </td>
                    <td className="border-b border-gray-200 px-4 py-3">{formatDate(item.dataVencimento)}</td>
                    <td className="border-b border-gray-200 px-4 py-3 font-medium">{formatCurrency(item.valor)}</td>
                    <td className="border-b border-gray-200 px-4 py-3">{getStatusBadge(item.status)}</td>
                    <td className="border-b border-gray-200 px-4 py-3">{getPrioridadeBadge(item.prioridade)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
