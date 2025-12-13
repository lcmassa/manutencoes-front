// ReceitasMes.tsx - Relação de despesas geradas e recebidas do mês atual
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { RefreshCw, AlertCircle, Building2, DollarSign, Loader2, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { logger } from '../utils/logger'

interface Condominio {
  idCondominio: string
  nome: string
  nomeFantasia: string
}

interface Receita {
  idRecebimento: string
  documento: string
  unidade: string
  condominio: string
  valor: number
  dataVencimento: string
  dataGeracao: string
  dataLiquidacao?: string
  status: string
  proprietario?: string
}

interface ResumoCondominio {
  idCondominio: string
  nome: string
  receitasGeradas: Receita[]
  receitasRecebidas: Receita[]
  totalGerado: number
  totalRecebido: number
}

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(valor)
}

function formatarData(data: string): string {
  if (!data) return '-'
  try {
    const [dataPart] = data.split(' ')
    const [dia, mes, ano] = dataPart.split('/')
    return `${dia}/${mes}/${ano}`
  } catch {
    return data
  }
}

async function buscarCondominios(apiInstance: typeof api): Promise<Condominio[]> {
  try {
    logger.info('[ReceitasMes] Buscando condomínios...')
    const todosCondominios: Condominio[] = []
    let pagina = 1
    let temMais = true

    while (temMais) {
      const url = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${pagina}`
      logger.info(`[ReceitasMes] Buscando condomínios página ${pagina}...`)
      
      const response = await apiInstance.get<any>(url)
      const data = response.data
      const listCondominios = Array.isArray(data) ? data : data?.data || data?.condominios || []
      
      if (listCondominios.length === 0) {
        temMais = false
        break
      }

      listCondominios.forEach((cond: any) => {
        const nomeFantasia = (cond.st_fantasia_cond || cond.nomeFantasia || '').trim()
        const nome = (cond.st_nome_cond || cond.nome || '').trim()
        const nomeFinal = nomeFantasia || nome || ''
        const idCondominio = cond.id_condominio_cond || cond.id || ''
        
        if (nomeFinal && idCondominio) {
          todosCondominios.push({
            idCondominio: idCondominio,
            nome: nomeFinal,
            nomeFantasia: nomeFantasia || nomeFinal
          })
        }
      })

      if (listCondominios.length < 100) {
        temMais = false
      } else {
        pagina++
      }
    }

    const condominiosOrdenados = todosCondominios.sort((a, b) => {
      const nomeA = (a.nomeFantasia || a.nome || '').toLowerCase().trim()
      const nomeB = (b.nomeFantasia || b.nome || '').toLowerCase().trim()
      return nomeA.localeCompare(nomeB, 'pt-BR', { sensitivity: 'base', numeric: true, ignorePunctuation: true })
    })

    logger.info(`[ReceitasMes] ✅ ${condominiosOrdenados.length} condomínios encontrados e ordenados`)
    return condominiosOrdenados
  } catch (error: any) {
    logger.error('[ReceitasMes] Erro ao buscar condomínios:', error)
    throw error
  }
}

async function buscarReceitasPorPeriodo(
  apiInstance: typeof api,
  token: string,
  idCondominio: string,
  dtInicio: string,
  dtFim: string,
  status: 'validos' | 'liquidadas' | 'pendentes',
  filtrarpor?: 'liquidacao' | 'geracao'
): Promise<Receita[]> {
  const receitas: Receita[] = []
  let pagina = 1
  const itensPorPagina = 50
  let temMais = true

  while (temMais) {
    try {
      const params = new URLSearchParams({
        status: status,
        exibirPgtoComDiferenca: '1',
        comContatosDaUnidade: '1',
        idCondominio: idCondominio,
        dtInicio: dtInicio,
        dtFim: dtFim,
        itensPorPagina: String(itensPorPagina),
        pagina: String(pagina),
        comDadosDasUnidades: '1',
        exibirDadosDoContato: '1'
      })

      // filtrarpor só funciona para liquidadas (filtrarpor=liquidacao)
      // Para receitas geradas, usamos dtInicio/dtFim com status=validos ou pendentes
      if (filtrarpor === 'liquidacao') {
        params.append('filtrarpor', filtrarpor)
      }

      const url = `/api/condominios/superlogica/cobranca/index?${params.toString()}`
      
      logger.info(`[ReceitasMes] Buscando receitas: ${url.substring(0, 150)}...`)
      
      const response = await apiInstance.get<any>(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Cache-Control': 'no-cache'
        }
      })

      const data = response.data
      
      // Log detalhado da resposta
      if (pagina === 1) {
        const chaves = data && typeof data === 'object' ? Object.keys(data) : []
        const isArray = Array.isArray(data)
        logger.info(`[ReceitasMes] 📥 Resposta da API (status=${status}, pagina=${pagina}):`, {
          tipo: typeof data,
          ehArray: isArray,
          tamanhoArray: isArray ? data.length : 0,
          chaves: chaves,
          temData: chaves.includes('data'),
          temItens: chaves.includes('itens'),
          status: data?.status,
          msg: data?.msg,
          estruturaCompleta: JSON.stringify(data).substring(0, 2000)
        })
        
        if (isArray && data.length > 0) {
          logger.info(`[ReceitasMes] 📋 Primeiro item do array:`, {
            chaves: Object.keys(data[0]),
            exemplo: JSON.stringify(data[0]).substring(0, 1000)
          })
        }
      }
      
      let dadosArray: any[] = []

      if (Array.isArray(data)) {
        dadosArray = data
        logger.info(`[ReceitasMes] ✅ Array direto com ${dadosArray.length} itens`)
      } else if (data && typeof data === 'object') {
        if (Array.isArray(data.data)) {
          dadosArray = data.data
          logger.info(`[ReceitasMes] ✅ data.data com ${dadosArray.length} itens`)
        } else if (Array.isArray(data.itens)) {
          dadosArray = data.itens
          logger.info(`[ReceitasMes] ✅ data.itens com ${dadosArray.length} itens`)
        } else {
          // Verificar se tem campos esperados
          const temCamposEsperados = Object.keys(data).some(k => 
            k.includes('recebimento') || k.includes('cobranca') || k.includes('unidade')
          )
          if (temCamposEsperados) {
            dadosArray = [data]
            logger.info(`[ReceitasMes] ✅ Objeto único com campos esperados`)
          } else {
            logger.warn(`[ReceitasMes] ⚠️ Objeto sem campos esperados. Chaves:`, Object.keys(data))
          }
        }
      }

      if (!dadosArray || dadosArray.length === 0) {
        if (pagina === 1) {
          logger.warn(`[ReceitasMes] ⚠️ Nenhum dado encontrado na página ${pagina} (status=${status})`)
        }
        temMais = false
        break
      }
      
      logger.info(`[ReceitasMes] Processando ${dadosArray.length} itens da página ${pagina}`)

      for (const item of dadosArray) {
        // Log do primeiro item para debug
        if (pagina === 1 && receitas.length === 0) {
          logger.info(`[ReceitasMes] 📋 Exemplo de item processado:`, {
            chaves: Object.keys(item),
            idRecebimento: item.id_recebimento_recb || item.idRecebimento,
            valor: item.vl_total_recb || item.vl_emitido_recb,
            dataGeracao: item.dt_geracao_recb,
            dataLiquidacao: item.dt_liquidacao_recb,
            status: item.fl_status_recb
          })
        }
        
        const receita: Receita = {
          idRecebimento: String(item.id_recebimento_recb || item.idRecebimento || ''),
          documento: item.st_documento_recb || item.documento || '',
          unidade: item.st_unidade_uni || item.unidade || '',
          condominio: item.st_nome_cond || item.st_fantasia_cond || item.nomeCondominio || item.nomeFantasia || '',
          valor: parseFloat(String(item.vl_total_recb || item.vl_emitido_recb || item.valorTotal || item.valorEmitido || '0').replace(/\./g, '').replace(',', '.')) || 0,
          dataVencimento: item.dt_vencimento_recb || item.dataVencimento || '',
          dataGeracao: item.dt_geracao_recb || item.dataGeracao || '',
          dataLiquidacao: item.dt_liquidacao_recb || item.dataLiquidacao || '',
          status: String(item.fl_status_recb || item.status || '0'),
          proprietario: item.st_nome_con || item.st_sacado_uni || item.proprietario || ''
        }

        if (receita.idRecebimento && receita.valor > 0) {
          receitas.push(receita)
        } else {
          logger.debug(`[ReceitasMes] Item excluído: idRecebimento=${receita.idRecebimento}, valor=${receita.valor}`)
        }
      }
      
      logger.info(`[ReceitasMes] ✅ Página ${pagina}: ${receitas.length} receitas válidas encontradas`)

      if (dadosArray.length < itensPorPagina) {
        temMais = false
      } else {
        pagina++
      }
    } catch (error: any) {
      logger.error(`[ReceitasMes] Erro ao buscar receitas (página ${pagina}):`, error)
      temMais = false
    }
  }

  return receitas
}

export function ReceitasMes() {
  const { token } = useAuth()
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [condominioSelecionado, setCondominioSelecionado] = useState<string>('')
  const [resumos, setResumos] = useState<ResumoCondominio[]>([])
  const [mesAno, setMesAno] = useState<{ mes: number; ano: number }>(() => {
    const hoje = new Date()
    return { mes: hoje.getMonth() + 1, ano: hoje.getFullYear() }
  })

  // Buscar condomínios
  useEffect(() => {
    if (!token) return
    const carregar = async () => {
      try {
        api.setToken(token)
        logger.info('[ReceitasMes] Buscando lista de condomínios...')
        const conds = await buscarCondominios(api)
        logger.info(`[ReceitasMes] ✅ ${conds.length} condomínios encontrados`)
        setCondominios(conds)
      } catch (err) {
        logger.error('[ReceitasMes] Erro ao carregar condomínios:', err)
      }
    }
    carregar()
  }, [token])

  const carregarReceitas = useCallback(async () => {
    if (!token) {
      setErro('Token de autenticação não disponível.')
      return
    }

    setLoading(true)
    setErro(null)
    api.setToken(token)

    try {
      // Calcular datas do mês atual
      const primeiroDia = `01/${String(mesAno.mes).padStart(2, '0')}/${mesAno.ano}`
      const ultimoDia = new Date(mesAno.ano, mesAno.mes, 0).getDate()
      const ultimoDiaFormatado = `${String(ultimoDia).padStart(2, '0')}/${String(mesAno.mes).padStart(2, '0')}/${mesAno.ano}`

      logger.info(`[ReceitasMes] Buscando receitas de ${primeiroDia} a ${ultimoDiaFormatado}`)

      logger.info(`[ReceitasMes] Total de condomínios disponíveis: ${condominios.length}`)
      
      const condominiosParaProcessar = condominioSelecionado 
        ? condominios.filter(c => c.idCondominio === condominioSelecionado)
        : condominios

      logger.info(`[ReceitasMes] Condomínios para processar: ${condominiosParaProcessar.length}`)
      
      if (condominiosParaProcessar.length === 0) {
        logger.warn(`[ReceitasMes] ⚠️ Nenhum condomínio disponível para processar!`)
        setErro('Nenhum condomínio encontrado. Verifique se você tem acesso a condomínios.')
        return
      }

      const resumosTemp: ResumoCondominio[] = []

      for (const cond of condominiosParaProcessar) {
        try {
          logger.info(`[ReceitasMes] Processando condomínio ${cond.nomeFantasia} (${cond.idCondominio})...`)

          // Buscar receitas geradas (status=pendentes - receitas criadas mas não liquidadas)
          // dtInicio/dtFim pode filtrar por data de vencimento, então vamos buscar todas e filtrar depois
          logger.info(`[ReceitasMes] Buscando receitas geradas para condomínio ${cond.idCondominio}...`)
          logger.info(`[ReceitasMes] Período: ${primeiroDia} a ${ultimoDiaFormatado}`)
          
          // Tentar buscar com status=pendentes primeiro (receitas não liquidadas)
          const receitasGeradasPendentes = await buscarReceitasPorPeriodo(
            api,
            token,
            cond.idCondominio,
            primeiroDia,
            ultimoDiaFormatado,
            'pendentes'
          )
          
          // Também buscar com status=validos para pegar todas as receitas válidas
          const receitasGeradasValidos = await buscarReceitasPorPeriodo(
            api,
            token,
            cond.idCondominio,
            primeiroDia,
            ultimoDiaFormatado,
            'validos'
          )
          
          // Combinar e remover duplicatas
          const todasReceitasGeradas = [...receitasGeradasPendentes]
          const idsExistentes = new Set(receitasGeradasPendentes.map(r => r.idRecebimento))
          receitasGeradasValidos.forEach(r => {
            if (!idsExistentes.has(r.idRecebimento)) {
              todasReceitasGeradas.push(r)
            }
          })
          
          logger.info(`[ReceitasMes] Encontradas ${todasReceitasGeradas.length} receitas geradas (pendentes: ${receitasGeradasPendentes.length}, válidas: ${receitasGeradasValidos.length})`)
          
          // Filtrar apenas as que foram geradas no mês (dt_geracao_recb)
          const receitasGeradasNoMes = todasReceitasGeradas.filter(rec => {
            if (!rec.dataGeracao) {
              logger.debug(`[ReceitasMes] Receita ${rec.idRecebimento} excluída: sem data de geração`)
              return false
            }
            try {
              const [dataPart] = rec.dataGeracao.split(' ')
              const [dia, mes, ano] = dataPart.split('/')
              const mesGeracao = parseInt(mes)
              const anoGeracao = parseInt(ano)
              const match = mesGeracao === mesAno.mes && anoGeracao === mesAno.ano
              if (!match) {
                logger.debug(`[ReceitasMes] Receita ${rec.idRecebimento} excluída: gerada em ${mesGeracao}/${anoGeracao}, esperado ${mesAno.mes}/${mesAno.ano}`)
              }
              return match
            } catch (e) {
              logger.debug(`[ReceitasMes] Receita ${rec.idRecebimento} excluída: erro ao processar data: ${e}`)
              return false
            }
          })
          
          logger.info(`[ReceitasMes] ✅ ${receitasGeradasNoMes.length} receitas geradas no mês ${mesAno.mes}/${mesAno.ano}`)

          // Buscar receitas recebidas (status=liquidadas, filtrarpor=liquidacao)
          logger.info(`[ReceitasMes] Buscando receitas recebidas para condomínio ${cond.idCondominio}...`)
          const receitasRecebidas = await buscarReceitasPorPeriodo(
            api,
            token,
            cond.idCondominio,
            primeiroDia,
            ultimoDiaFormatado,
            'liquidadas',
            'liquidacao'
          )
          
          logger.info(`[ReceitasMes] Encontradas ${receitasRecebidas.length} receitas recebidas`)

          const totalGerado = receitasGeradasNoMes.reduce((sum, r) => sum + r.valor, 0)
          const totalRecebido = receitasRecebidas.reduce((sum, r) => sum + r.valor, 0)

          if (receitasGeradasNoMes.length > 0 || receitasRecebidas.length > 0) {
            resumosTemp.push({
              idCondominio: cond.idCondominio,
              nome: cond.nomeFantasia || cond.nome,
              receitasGeradas: receitasGeradasNoMes,
              receitasRecebidas,
              totalGerado,
              totalRecebido
            })
          }
        } catch (err: any) {
          logger.warn(`[ReceitasMes] Erro ao processar condomínio ${cond.idCondominio}:`, err?.message)
        }
      }

      setResumos(resumosTemp)
      
      const totalCondominiosProcessados = condominiosParaProcessar.length
      const condominiosComDados = resumosTemp.length
      const totalReceitasGeradas = resumosTemp.reduce((sum, r) => sum + r.receitasGeradas.length, 0)
      const totalReceitasRecebidas = resumosTemp.reduce((sum, r) => sum + r.receitasRecebidas.length, 0)
      
      logger.info(`[ReceitasMes] 📊 Resumo final do processamento:`, {
        totalCondominiosProcessados,
        condominiosComDados,
        condominiosSemDados: totalCondominiosProcessados - condominiosComDados,
        totalReceitasGeradas,
        totalReceitasRecebidas,
        mesAno: `${mesAno.mes}/${mesAno.ano}`
      })
      
      if (resumosTemp.length === 0) {
        logger.warn(`[ReceitasMes] ⚠️ Nenhuma receita encontrada para o período ${mesAno.mes}/${mesAno.ano}`)
        logger.warn(`[ReceitasMes] ⚠️ Verifique os logs acima para entender por que não foram encontradas receitas`)
      }
    } catch (error: any) {
      console.error('[ReceitasMes] Erro ao carregar receitas:', error)
      setErro(error?.message || 'Erro ao gerar relatório.')
    } finally {
      setLoading(false)
    }
  }, [token, condominioSelecionado, condominios, mesAno])

  useEffect(() => {
    if (!token) {
      logger.debug('[ReceitasMes] Aguardando token...')
      return
    }
    if (condominios.length === 0) {
      logger.debug('[ReceitasMes] Aguardando condomínios serem carregados...')
      return
    }
    logger.info(`[ReceitasMes] ✅ Condições atendidas: token=${!!token}, condominios=${condominios.length}`)
    carregarReceitas()
  }, [token, condominios.length, carregarReceitas])

  const totalGeralGerado = resumos.reduce((sum, r) => sum + r.totalGerado, 0)
  const totalGeralRecebido = resumos.reduce((sum, r) => sum + r.totalRecebido, 0)
  const diferenca = totalGeralRecebido - totalGeralGerado

  const meses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Receitas do Mês</h1>
          <p className="text-sm text-gray-600">Relação de despesas geradas e recebidas</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <select
              value={mesAno.mes}
              onChange={(e) => setMesAno({ ...mesAno, mes: parseInt(e.target.value) })}
              className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
              disabled={loading}
            >
              {meses.map((mes, idx) => (
                <option key={idx} value={idx + 1}>{mes}</option>
              ))}
            </select>
            <input
              type="number"
              value={mesAno.ano}
              onChange={(e) => setMesAno({ ...mesAno, ano: parseInt(e.target.value) })}
              className="w-20 px-2 py-1 text-sm border border-gray-300 rounded"
              disabled={loading}
              min="2020"
              max="2100"
            />
          </div>
          {condominios.length > 0 && (
            <select
              value={condominioSelecionado}
              onChange={(e) => setCondominioSelecionado(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded bg-white"
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
            onClick={carregarReceitas}
            disabled={loading}
            className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4" />
                Atualizar
              </>
            )}
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3 bg-red-50 border border-red-200 rounded">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-sm text-red-800">{erro}</p>
          </div>
        </div>
      )}

      {loading && resumos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <span className="mt-2 text-sm text-gray-600">Carregando receitas...</span>
        </div>
      )}

      {!loading && resumos.length === 0 && !erro && (
        <div className="bg-white rounded border border-gray-200 p-6 text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600">Nenhuma receita encontrada para o período selecionado.</p>
        </div>
      )}

      {resumos.length > 0 && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-5 h-5 text-green-600" />
                <span className="text-sm text-gray-600">Total Gerado</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatarValor(totalGeralGerado)}</p>
            </div>
            <div className="bg-white rounded border border-gray-200 p-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingDown className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-600">Total Recebido</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatarValor(totalGeralRecebido)}</p>
            </div>
            <div className={`bg-white rounded border p-4 ${diferenca >= 0 ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className={`w-5 h-5 ${diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`} />
                <span className="text-sm text-gray-600">Diferença</span>
              </div>
              <p className={`text-2xl font-bold ${diferenca >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatarValor(Math.abs(diferenca))}
              </p>
            </div>
          </div>

          {/* Tabelas por condomínio */}
          <div className="space-y-4">
            {resumos.map((resumo) => (
              <div key={resumo.idCondominio} className="bg-white rounded border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 border-b border-gray-300 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-blue-600" />
                      <h2 className="text-base font-bold text-gray-900">{resumo.nome}</h2>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <div className="text-right">
                        <span className="text-gray-600">Gerado: </span>
                        <span className="font-semibold text-gray-900">{formatarValor(resumo.totalGerado)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-gray-600">Recebido: </span>
                        <span className="font-semibold text-green-600">{formatarValor(resumo.totalRecebido)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                  {/* Receitas Geradas */}
                  <div className="border-r border-gray-200">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        Receitas Geradas ({resumo.receitasGeradas.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Documento</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Unidade</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Vencimento</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-700">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {resumo.receitasGeradas.map((rec) => (
                            <tr key={rec.idRecebimento} className="hover:bg-gray-50">
                              <td className="px-2 py-2">{rec.documento || '-'}</td>
                              <td className="px-2 py-2">{rec.unidade || '-'}</td>
                              <td className="px-2 py-2">{formatarData(rec.dataVencimento)}</td>
                              <td className="px-2 py-2 text-right font-medium">{formatarValor(rec.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={3} className="px-2 py-2 text-right font-semibold text-gray-700">
                              Subtotal:
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-gray-900">
                              {formatarValor(resumo.totalGerado)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>

                  {/* Receitas Recebidas */}
                  <div>
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <TrendingDown className="w-4 h-4 text-blue-600" />
                        Receitas Recebidas ({resumo.receitasRecebidas.length})
                      </h3>
                    </div>
                    <div className="overflow-x-auto max-h-96 overflow-y-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Documento</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Unidade</th>
                            <th className="px-2 py-2 text-left font-semibold text-gray-700">Recebimento</th>
                            <th className="px-2 py-2 text-right font-semibold text-gray-700">Valor</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {resumo.receitasRecebidas.map((rec) => (
                            <tr key={rec.idRecebimento} className="hover:bg-gray-50">
                              <td className="px-2 py-2">{rec.documento || '-'}</td>
                              <td className="px-2 py-2">{rec.unidade || '-'}</td>
                              <td className="px-2 py-2">{formatarData(rec.dataLiquidacao || rec.dataVencimento)}</td>
                              <td className="px-2 py-2 text-right font-medium text-green-600">{formatarValor(rec.valor)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-50 border-t-2 border-gray-300">
                          <tr>
                            <td colSpan={3} className="px-2 py-2 text-right font-semibold text-gray-700">
                              Subtotal:
                            </td>
                            <td className="px-2 py-2 text-right font-bold text-green-600">
                              {formatarValor(resumo.totalRecebido)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

