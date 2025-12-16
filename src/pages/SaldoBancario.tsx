import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Building2, AlertCircle } from 'lucide-react'
import api from '../lib/api'

type LinhaSaldo = {
  condominio: string
  idCondominio?: string
  banco?: string
  agencia?: string
  conta?: string
  descricao?: string
  data?: string
  saldo: number
  idConta?: string
}

type Condominio = {
  id_condominio_cond: string
  st_nome_cond: string
  st_fantasia_cond?: string
}

type ContaBancaria = {
  id_contabanco_cb: string
  st_descricao_cb: string
  st_conta_cb: string
  st_numero_agb?: string
  st_nome_banc?: string
  id_banco_banc?: string
  vl_saldo_cb?: string
  id_condominio_cond: string
  st_nome_cond?: string
}

function normalizarNumeroBR(valor: string): number {
  if (!valor) return 0
  
  // Limpar espaços
  let s = valor.trim().replace(/\s/g, '')
  
  // Detectar formato do número
  const temVirgula = s.includes(',')
  const temPonto = s.includes('.')
  
  if (temVirgula && temPonto) {
    // Formato brasileiro: 1.234,56 ou formato americano invertido: 1,234.56
    const ultimaVirgula = s.lastIndexOf(',')
    const ultimoPonto = s.lastIndexOf('.')
    
    if (ultimaVirgula > ultimoPonto) {
      // Formato brasileiro: 1.234,56 -> vírgula é decimal
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      // Formato americano: 1,234.56 -> ponto é decimal
      s = s.replace(/,/g, '')
    }
  } else if (temVirgula) {
    // Apenas vírgula: 1234,56 -> vírgula é decimal
    s = s.replace(',', '.')
  }
  // Se só tem ponto, mantém como está (formato americano)
  
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

// Função para processar em lotes paralelos
async function processarEmLotes<T, R>(
  items: T[],
  processador: (item: T) => Promise<R>,
  tamanhoBatch: number = 10
): Promise<R[]> {
  const resultados: R[] = []
  
  for (let i = 0; i < items.length; i += tamanhoBatch) {
    const batch = items.slice(i, i + tamanhoBatch)
    const resultadosBatch = await Promise.all(batch.map(processador))
    resultados.push(...resultadosBatch)
  }
  
  return resultados
}

export function SaldoBancario() {
  const [linhas, setLinhas] = useState<LinhaSaldo[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [filtroCondominio, setFiltroCondominio] = useState<string>('')
  const [search, setSearch] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [loadingInicial, setLoadingInicial] = useState(true)
  const [condominiosDisponiveis, setCondominiosDisponiveis] = useState<Condominio[]>([])
  const [statusAPI, setStatusAPI] = useState<string>('')
  const [progresso, setProgresso] = useState({ atual: 0, total: 0 })

  // Carregar lista de condomínios disponíveis (com paginação)
  const carregarCondominios = useCallback(async () => {
    setStatusAPI('Carregando condomínios...')
    console.log('[SaldoBancario] Iniciando carregamento de condomínios...')
    
    try {
      const todosCondominios: Condominio[] = []
      let pagina = 1
      let temMais = true
      const itensPorPagina = 100

      while (temMais) {
        setStatusAPI(`Carregando condomínios (página ${pagina})...`)
        
        const url = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&apenasColunasPrincipais=1&itensPorPagina=${itensPorPagina}&pagina=${pagina}`
        const response = await api.get<any>(url)
        
        const data = response?.data
        const list = Array.isArray(data) ? data : data?.data || []
        
        if (list.length === 0) {
          temMais = false
        } else {
          todosCondominios.push(...list)
          if (list.length < itensPorPagina) {
            temMais = false
          } else {
            pagina++
          }
        }
        
        if (pagina > 20) {
          temMais = false
        }
      }
      
      console.log('[SaldoBancario] Total de condomínios:', todosCondominios.length)
      setCondominiosDisponiveis(todosCondominios)
      setStatusAPI(`${todosCondominios.length} condomínio(s) encontrado(s)`)
      
      return todosCondominios
    } catch (e: any) {
      console.error('[SaldoBancario] Erro ao carregar condomínios:', e)
      setStatusAPI(`Erro: ${e?.message || 'Falha ao carregar condomínios'}`)
      setErro(`Erro ao carregar condomínios: ${e?.message || String(e)}`)
      return []
    }
  }, [])

  // Buscar saldo atualizado de uma conta
  const buscarSaldoConta = useCallback(async (idConta: string, idCondominio: string): Promise<number> => {
    try {
      // Formato da data: MM/DD/YYYY
      const hoje = new Date()
      const dataHoje = `${String(hoje.getMonth() + 1).padStart(2, '0')}/${String(hoje.getDate()).padStart(2, '0')}/${hoje.getFullYear()}`
      
      const urlSaldo = `/api/condominios/superlogica/caixa/saldo?idConta=${idConta}&idEmpresa=${idCondominio}&dtInicio=${dataHoje}&ateAData=1`
      const resSaldo = await api.get<any>(urlSaldo)
      const dataSaldo = resSaldo?.data
      
      // O saldo pode vir em diferentes formatos
      if (dataSaldo) {
        // Tentar diferentes campos possíveis
        const valorBruto = dataSaldo?.vl_saldo || dataSaldo?.saldo || dataSaldo?.data?.[0]?.vl_saldo || dataSaldo?.data?.[0]?.saldo || dataSaldo?.[0]?.vl_saldo || '0'
        return normalizarNumeroBR(String(valorBruto))
      }
      return 0
    } catch (e) {
      console.warn(`[SaldoBancario] Erro ao buscar saldo da conta ${idConta}:`, e)
      return 0
    }
  }, [])

  // Buscar contas de um condomínio específico
  const buscarContasCondominio = useCallback(async (cond: Condominio): Promise<LinhaSaldo[]> => {
    try {
      const urlContas = `/api/condominios/superlogica/contabancos/index?idCondominio=${cond.id_condominio_cond}&exibirDadosAgencia=1&exibirDadosBanco=1&exibirContasAtivas=1`
      const resContas = await api.get<any>(urlContas)
      const dataContas = resContas?.data
      const contas: ContaBancaria[] = Array.isArray(dataContas) ? dataContas : dataContas?.data || []

      // Buscar saldo atualizado de cada conta em paralelo
      const contasComSaldo = await Promise.all(
        contas.map(async (conta) => {
          // Buscar saldo atualizado
          const saldoAtualizado = await buscarSaldoConta(conta.id_contabanco_cb, cond.id_condominio_cond)
          
          // Debug
          console.log(`[SaldoBancario] ${cond.st_nome_cond} - ${conta.st_descricao_cb}: saldo = ${saldoAtualizado}`)
          
          return {
            condominio: cond.st_fantasia_cond || cond.st_nome_cond,
            idCondominio: cond.id_condominio_cond,
            banco: conta.st_nome_banc || `Banco ${conta.id_banco_banc || ''}`,
            agencia: conta.st_numero_agb || '',
            conta: conta.st_conta_cb || '',
            descricao: conta.st_descricao_cb || '',
            data: new Date().toLocaleDateString('pt-BR'),
            saldo: saldoAtualizado,
            idConta: conta.id_contabanco_cb,
          }
        })
      )

      // Filtrar contas com saldo menor que R$ 1,00
      return contasComSaldo.filter(conta => Math.abs(conta.saldo) >= 1)
    } catch (e) {
      console.warn(`[SaldoBancario] Erro ao buscar contas do condomínio ${cond.st_nome_cond}:`, e)
      return []
    }
  }, [buscarSaldoConta])

  // Buscar saldos bancários da API (em paralelo)
  const buscarSaldosAPI = useCallback(async (condominiosLista?: Condominio[]) => {
    setLoading(true)
    setErro(null)
    setStatusAPI('Buscando saldos bancários...')
    
    try {
      const condominiosParaBuscar = condominiosLista || condominiosDisponiveis
      console.log('[SaldoBancario] Condomínios para buscar:', condominiosParaBuscar.length)

      if (condominiosParaBuscar.length === 0) {
        setErro('Nenhum condomínio disponível. Verifique se o token está válido.')
        setStatusAPI('Nenhum condomínio disponível')
        setLoading(false)
        return
      }

      setProgresso({ atual: 0, total: condominiosParaBuscar.length })
      
      // Processar em lotes de 10 condomínios em paralelo
      const BATCH_SIZE = 10
      const todasLinhas: LinhaSaldo[] = []
      
      for (let i = 0; i < condominiosParaBuscar.length; i += BATCH_SIZE) {
        const batch = condominiosParaBuscar.slice(i, i + BATCH_SIZE)
        const batchNum = Math.floor(i / BATCH_SIZE) + 1
        const totalBatches = Math.ceil(condominiosParaBuscar.length / BATCH_SIZE)
        
        setStatusAPI(`Buscando lote ${batchNum}/${totalBatches} (${Math.min(i + BATCH_SIZE, condominiosParaBuscar.length)}/${condominiosParaBuscar.length})...`)
        setProgresso({ atual: i, total: condominiosParaBuscar.length })
        
        // Buscar todos os condomínios do batch em paralelo
        const resultados = await Promise.all(
          batch.map(cond => buscarContasCondominio(cond))
        )
        
        // Adicionar resultados
        resultados.forEach(linhas => todasLinhas.push(...linhas))
        
        // Atualizar parcialmente para mostrar progresso
        setLinhas([...todasLinhas])
      }

      console.log('[SaldoBancario] Total de contas:', todasLinhas.length)
      setLinhas(todasLinhas)
      setProgresso({ atual: condominiosParaBuscar.length, total: condominiosParaBuscar.length })
      setStatusAPI(`✓ ${todasLinhas.length} conta(s) de ${condominiosParaBuscar.length} condomínio(s)`)
      
      if (todasLinhas.length === 0) {
        setErro('Nenhuma conta bancária encontrada para os condomínios.')
      }
    } catch (e: any) {
      console.error('[SaldoBancario] Erro geral:', e)
      setErro(`Falha ao buscar saldos: ${e?.message || String(e)}`)
      setStatusAPI(`Erro: ${e?.message}`)
    } finally {
      setLoading(false)
    }
  }, [condominiosDisponiveis, buscarContasCondominio])

  // Carregar automaticamente ao montar o componente
  useEffect(() => {
    const inicializar = async () => {
      setLoadingInicial(true)
      console.log('[SaldoBancario] Iniciando...')
      
      const condominios = await carregarCondominios()
      
      if (condominios.length > 0) {
        await buscarSaldosAPI(condominios)
      }
      
      setLoadingInicial(false)
    }
    
    inicializar()
  }, [])

  const condominios = useMemo(() => {
    return Array.from(new Set(linhas.map(l => l.condominio).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
    )
  }, [linhas])

  const filtradas = useMemo(() => {
    return linhas
      .filter(l => {
        const okCondo = !filtroCondominio || l.condominio === filtroCondominio
        const s = search.trim().toLowerCase()
        const okSearch = !s || [
          l.condominio, l.banco, l.agencia, l.conta, l.descricao, l.data
        ].some(v => (v || '').toLowerCase().includes(s))
        return okCondo && okSearch
      })
      // Ordenar por condomínio
      .sort((a, b) => (a.condominio || '').localeCompare(b.condominio || '', 'pt-BR', { sensitivity: 'base' }))
  }, [linhas, filtroCondominio, search])

  // Agrupar por condomínio com totais
  const dadosAgrupados = useMemo(() => {
    const grupos = new Map<string, { linhas: LinhaSaldo[]; total: number }>()
    
    filtradas.forEach(l => {
      const key = l.condominio || '—'
      if (!grupos.has(key)) {
        grupos.set(key, { linhas: [], total: 0 })
      }
      const grupo = grupos.get(key)!
      grupo.linhas.push(l)
      grupo.total += l.saldo
    })
    
    // Converter para array e ordenar por nome do condomínio
    return Array.from(grupos.entries())
      .sort((a, b) => a[0].localeCompare(b[0], 'pt-BR', { sensitivity: 'base' }))
  }, [filtradas])

  const totais = useMemo(() => {
    const total = filtradas.reduce((sum, l) => sum + l.saldo, 0)
    const porBanco = new Map<string, number>()
    filtradas.forEach(l => {
      const key = l.banco || '—'
      porBanco.set(key, (porBanco.get(key) || 0) + l.saldo)
    })
    const grupos = Array.from(porBanco.entries())
      .sort((a, b) => b[1] - a[1])
    return { total, grupos }
  }, [filtradas])

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const atualizarDados = useCallback(async () => {
    const condominios = await carregarCondominios()
    if (condominios.length > 0) {
      await buscarSaldosAPI(condominios)
    }
  }, [carregarCondominios, buscarSaldosAPI])

  // Calcular porcentagem do progresso
  const porcentagem = progresso.total > 0 ? Math.round((progresso.atual / progresso.total) * 100) : 0

  return (
    <div className="p-3 space-y-3">
      <div className="bg-white shadow rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Saldo Bancário</h1>
            <p className="text-xs text-gray-600">
              Dados obtidos da API Superlógica em tempo real
            </p>
          </div>
          <div className="text-xs text-gray-500 text-right">
            {statusAPI}
          </div>
        </div>

        {/* Barra de progresso */}
        {(loading || loadingInicial) && progresso.total > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Carregando condomínios...</span>
              <span>{porcentagem}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${porcentagem}%` }}
              />
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <button
            onClick={atualizarDados}
            disabled={loading || loadingInicial}
            className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 disabled:opacity-50"
          >
            {(loading || loadingInicial) ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <RefreshCw size={14} />
            )}
            {loadingInicial ? 'Carregando...' : loading ? 'Atualizando...' : 'Atualizar'}
          </button>

          <div className="w-56">
            <select
              value={filtroCondominio}
              onChange={(e) => setFiltroCondominio(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os condomínios ({condominios.length})</option>
              {condominios.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="min-w-[240px] flex-1">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por texto (banco, conta, descrição)"
              className="w-full border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {condominiosDisponiveis.length > 0 && linhas.length === 0 && !loading && !loadingInicial && (
          <div className="bg-blue-50 border border-blue-200 rounded p-2 mb-2">
            <div className="flex items-start gap-2">
              <Building2 size={16} className="text-blue-600 mt-0.5" />
              <div>
                <p className="text-blue-800 text-xs font-medium">
                  {condominiosDisponiveis.length} condomínio(s) disponível(is) na API
                </p>
                <p className="text-blue-600 text-xs">
                  Clique em "Atualizar" para buscar os saldos bancários.
                </p>
              </div>
            </div>
          </div>
        )}

        {erro && (
          <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
            <div className="flex items-start gap-2">
              <AlertCircle size={16} className="text-red-600 mt-0.5" />
              <div>
                <p className="text-red-800 text-xs">{erro}</p>
                <p className="text-red-600 text-xs mt-1">
                  Verifique se o token está válido. Execute: <code className="bg-red-100 px-1 rounded">./iap auth</code>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className="bg-blue-50 border border-blue-200 rounded p-2">
            <div className="text-xs text-blue-600 font-medium">Total exibido</div>
            <div className="text-sm font-bold text-blue-900">{formatCurrency(totais.total)}</div>
            <div className="text-xs text-blue-600">{filtradas.length} conta(s)</div>
          </div>
          <div className="bg-gray-50 border border-gray-200 rounded p-2">
            <div className="text-xs text-gray-600 font-medium mb-1">Top bancos</div>
            <div className="text-xs text-gray-800 space-y-0.5 max-h-24 overflow-auto">
              {totais.grupos.slice(0, 6).map(([banco, valor]) => (
                <div key={banco} className="flex justify-between gap-2">
                  <span className="truncate">{banco}</span>
                  <span className="font-semibold">{formatCurrency(valor)}</span>
                </div>
              ))}
              {totais.grupos.length === 0 && <div className="text-gray-500">—</div>}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Condomínio</th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Banco</th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Agência</th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Conta</th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700">Descrição</th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-right font-semibold text-gray-700">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {dadosAgrupados.length === 0 && !loading && !loadingInicial ? (
                <tr>
                  <td colSpan={6} className="text-center py-6 text-gray-500">
                    {linhas.length === 0 
                      ? 'Nenhum dado carregado. Verifique a conexão com a API.'
                      : 'Nenhum resultado encontrado com os filtros atuais'}
                  </td>
                </tr>
              ) : (
                dadosAgrupados.map(([nomeCondominio, grupo]) => (
                  <React.Fragment key={nomeCondominio}>
                    {/* Linha de cabeçalho do condomínio */}
                    <tr className="bg-blue-50 border-t-2 border-blue-200">
                      <td colSpan={5} className="px-2 py-2 font-bold text-blue-900">
                        {nomeCondominio} ({grupo.linhas.length} conta{grupo.linhas.length > 1 ? 's' : ''})
                      </td>
                      <td className={`px-2 py-2 text-right font-bold ${grupo.total < 0 ? 'text-red-600' : 'text-blue-900'}`}>
                        {formatCurrency(grupo.total)}
                      </td>
                    </tr>
                    {/* Linhas das contas do condomínio */}
                    {grupo.linhas.map((l, i) => (
                      <tr key={`${nomeCondominio}-${i}`} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="px-2 py-1.5 pl-4 text-gray-500">↳</td>
                        <td className="px-2 py-1.5">{l.banco || '—'}</td>
                        <td className="px-2 py-1.5">{l.agencia || '—'}</td>
                        <td className="px-2 py-1.5">{l.conta || '—'}</td>
                        <td className="px-2 py-1.5 max-w-[24ch] truncate" title={l.descricao}>{l.descricao || '—'}</td>
                        <td className={`px-2 py-1.5 text-right font-semibold ${l.saldo < 0 ? 'text-red-600' : ''}`}>
                          {formatCurrency(l.saldo)}
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              )}
              {/* Total geral */}
              {dadosAgrupados.length > 0 && (
                <tr className="bg-green-100 border-t-2 border-green-300">
                  <td colSpan={5} className="px-2 py-2 font-bold text-green-900">
                    TOTAL GERAL ({dadosAgrupados.length} condomínio{dadosAgrupados.length > 1 ? 's' : ''}, {filtradas.length} conta{filtradas.length > 1 ? 's' : ''})
                  </td>
                  <td className={`px-2 py-2 text-right font-bold text-lg ${totais.total < 0 ? 'text-red-600' : 'text-green-900'}`}>
                    {formatCurrency(totais.total)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
