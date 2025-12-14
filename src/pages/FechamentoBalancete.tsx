// FechamentoBalancete.tsx
import React, { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { Building2, RefreshCw, Loader2, Calendar } from 'lucide-react'

interface CondominioBalancete {
  idCondominio: string
  nomeFantasia: string
  dataFechamento: string | null
  dataFechamentoFormatada: string
  dataFechamentoDate: Date | null
}

async function buscarCondominios(apiInstance: typeof api): Promise<CondominioBalancete[]> {
  const lista: CondominioBalancete[] = []
  let pagina = 1
  let temMais = true

  while (temMais) {
    try {
      const params = new URLSearchParams({
        id: '-1',
        somenteCondominiosAtivos: '1',
        ignorarCondominioModelo: '1',
        itensPorPagina: '100',
        pagina: String(pagina),
      })
      const url = `/api/condominios/superlogica/condominios/get?${params.toString()}`
      const response = await apiInstance.get<any>(url)
      const data = response.data
      const registros = Array.isArray(data) ? data : data?.data || data?.condominios || []

      registros.forEach((cond: any) => {
        const nomeFantasia = (cond.st_fantasia_cond || cond.nomeFantasia || cond.st_nome_cond || cond.nome || '').trim()
        const id = cond.id_condominio_cond || cond.id || cond.idCondominio || ''
        
        if (nomeFantasia && id) {
          // Extrair data de fechamento do balancete
          const dataFechamento = 
            cond?.dt_fechamento_balanco ||
            cond?.dtFechamentoBalanco ||
            cond?.dt_fechamento_cond ||
            cond?.dtFechamento ||
            cond?.dt_fechamento ||
            cond?.dataFechamento ||
            null

          // Formatar data para exibição
          let dataFechamentoFormatada = '-'
          let dataFechamentoDate: Date | null = null
          
          if (dataFechamento) {
            try {
              // Tentar diferentes formatos de data
              let data: Date | null = null
              let dia: number | null = null
              let mes: number | null = null
              let ano: number | null = null
              
              // Formato DD/MM/YYYY ou MM/DD/YYYY (string com barras)
              if (typeof dataFechamento === 'string' && /^\d{2}\/\d{2}\/\d{4}/.test(dataFechamento)) {
                const partes = dataFechamento.split('/')
                const parte1 = parseInt(partes[0])
                const parte2 = parseInt(partes[1])
                const parte3 = parseInt(partes[2])
                
                // Lógica melhorada para detectar formato
                // Se parte1 > 12, então parte1 não pode ser mês, então é DD/MM/YYYY
                if (parte1 > 12) {
                  dia = parte1
                  mes = parte2
                  ano = parte3
                }
                // Se parte2 > 12, então parte2 não pode ser mês
                // Pode ser MM/DD/YYYY (onde parte2 é o dia) ou DD/MM/YYYY (onde parte2 é mês inválido)
                // Se parte1 <= 12, então parte1 pode ser mês, então é MM/DD/YYYY
                else if (parte2 > 12 && parte1 <= 12) {
                  // É MM/DD/YYYY: parte1 = mês, parte2 = dia
                  dia = parte2
                  mes = parte1
                  ano = parte3
                }
                // Se ambas <= 12, assumir MM/DD/YYYY (formato americano comum) e converter
                else {
                  // Assumir MM/DD/YYYY e converter para DD/MM/YYYY
                  dia = parte2
                  mes = parte1
                  ano = parte3
                }
                
                // Validar se a data é válida
                if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
                  // Criar data usando UTC
                  data = new Date(Date.UTC(ano, mes - 1, dia))
                  if (!isNaN(data.getTime())) {
                    // Garantir formato DD/MM/YYYY
                    dataFechamentoFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
                  }
                }
              }
              // Formato YYYY-MM-DD
              else if (typeof dataFechamento === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dataFechamento)) {
                const [anoStr, mesStr, diaStr] = dataFechamento.split('-')
                ano = parseInt(anoStr)
                mes = parseInt(mesStr)
                dia = parseInt(diaStr)
                data = new Date(Date.UTC(ano, mes - 1, dia))
              }
              // Timestamp (em segundos)
              else if (typeof dataFechamento === 'number') {
                data = new Date(dataFechamento * 1000)
              }
              // Tentar parse direto (pode ser ISO string ou outro formato)
              else {
                data = new Date(dataFechamento)
              }

              if (data && !isNaN(data.getTime())) {
                dataFechamentoDate = data
                // Se ainda não formatamos, extrair componentes da data
                if (!dataFechamentoFormatada || dataFechamentoFormatada === '-') {
                  // Usar getDate(), getMonth(), getFullYear() para evitar problemas de timezone
                  dia = data.getDate()
                  mes = data.getMonth() + 1
                  ano = data.getFullYear()
                  dataFechamentoFormatada = `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`
                }
              }
            } catch (e) {
              console.warn(`[FechamentoBalancete] Erro ao formatar data para ${nomeFantasia}:`, e)
            }
          }

          lista.push({
            idCondominio: id,
            nomeFantasia,
            dataFechamento: dataFechamento || null,
            dataFechamentoFormatada,
            dataFechamentoDate
          })
        }
      })

      if (registros.length < 100) {
        temMais = false
      } else {
        pagina++
        if (pagina > 50) {
          temMais = false
        }
      }
    } catch (err: any) {
      if (err?.response?.status === 401) {
        throw err
      }
      temMais = false
    }
  }

  // Ordenar alfabeticamente por nome fantasia
  lista.sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR', { sensitivity: 'base' }))

  return lista
}

export function FechamentoBalancete() {
  const { token, companyId } = useAuth()
  const [condominios, setCondominios] = useState<CondominioBalancete[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const carregarDados = useCallback(async () => {
    if (!token) {
      setErro('Token de autenticação não disponível. Recarregue a página.')
      setLoading(false)
      return
    }

    api.setToken(token)
    setLoading(true)
    setErro(null)

    try {
      console.log('[FechamentoBalancete] Carregando condomínios e datas de fechamento...')
      const lista = await buscarCondominios(api)
      console.log(`[FechamentoBalancete] ✅ ${lista.length} condomínios carregados`)
      setCondominios(lista)
    } catch (error: any) {
      console.error('[FechamentoBalancete] Erro ao carregar dados:', error)
      
      let mensagemErro = error?.message || 'Erro ao carregar dados.'
      
      if (error?.response?.status === 401) {
        mensagemErro = 'Erro de autenticação. Token expirado ou inválido. Execute ./iap auth para renovar.'
      } else if (error?.response?.status === 503) {
        mensagemErro = 'Serviço temporariamente indisponível (503).\n\nO servidor pode estar sobrecarregado ou em manutenção.\n\nAções sugeridas:\n• Aguarde alguns instantes e tente novamente\n• Verifique se há manutenção programada\n• Se o problema persistir, entre em contato com o suporte'
      } else if (error?.response?.status === 500) {
        mensagemErro = 'Erro interno do servidor (500).\n\nO servidor encontrou um erro ao processar a requisição.\n\nAções sugeridas:\n• Aguarde alguns instantes e tente novamente\n• Se o problema persistir, entre em contato com o suporte'
      } else if (error?.response?.status === 502 || error?.response?.status === 504) {
        mensagemErro = 'Erro de gateway (502/504).\n\nO servidor pode estar temporariamente indisponível ou demorando para responder.\n\nAções sugeridas:\n• Aguarde alguns instantes e tente novamente\n• Verifique sua conexão com a internet\n• Se o problema persistir, entre em contato com o suporte'
      } else if (error?.response?.status) {
        mensagemErro = `Erro HTTP ${error.response.status}: ${mensagemErro}`
      }
      
      setErro(mensagemErro)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  const totalCondominios = condominios.length
  
  // Função para verificar se o fechamento está atrasado (>= 60 dias em relação à data atual)
  const isFechamentoAtrasado = (dataFechamentoDate: Date | null): boolean => {
    if (!dataFechamentoDate) return false
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const dataFechamento = new Date(dataFechamentoDate)
    dataFechamento.setHours(0, 0, 0, 0)
    const diffTime = hoje.getTime() - dataFechamento.getTime()
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    // Atrasado se a diferença for >= 60 dias (fechamento foi há 60 dias ou mais)
    return diffDays >= 60
  }

  // Contar condomínios por categoria
  // Com Fechamento: tem data e está em dia (< 60 dias em relação à data atual)
  const comFechamento = condominios.filter(c => {
    if (!c.dataFechamento || !c.dataFechamentoDate) return false
    return !isFechamentoAtrasado(c.dataFechamentoDate)
  }).length
  
  // Fechamentos Atrasados: tem data mas está atrasado (>= 60 dias em relação à data atual)
  const fechamentosAtrasados = condominios.filter(c => {
    if (!c.dataFechamento || !c.dataFechamentoDate) return false
    return isFechamentoAtrasado(c.dataFechamentoDate)
  }).length

  return (
    <div className="p-6 space-y-4">
      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Fechamento Balancete</h1>
          <p className="text-sm text-gray-600 mt-1">
            Acompanhamento da data do último balancete fechado por condomínio
          </p>
        </div>
        <button
          onClick={carregarDados}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Carregando...
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              Recarregar
            </>
          )}
        </button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-gray-600">Total de Condomínios</span>
          </div>
          <p className="text-2xl font-bold text-gray-900">{totalCondominios}</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-green-600" />
            <span className="text-sm text-gray-600">Com Fechamento</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{comFechamento}</p>
        </div>
        <div className="bg-white rounded border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-yellow-600" />
            <span className="text-sm text-gray-600">Fechamentos Atrasados</span>
          </div>
          <p className="text-2xl font-bold text-yellow-600">{fechamentosAtrasados}</p>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 font-semibold mb-1">Erro ao carregar dados</p>
          <p className="text-red-700 text-sm whitespace-pre-line">{erro}</p>
          <button
            onClick={carregarDados}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Tentar Novamente
          </button>
        </div>
      )}

      {/* Grid de 6 colunas */}
      {!loading && !erro && (
        <div className="bg-white rounded border border-gray-200 p-1.5">
          {condominios.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              Nenhum condomínio encontrado.
            </div>
          ) : (
            <div className="grid grid-cols-6 gap-1.5">
              {condominios
                .filter(condominio => condominio.dataFechamento !== null)
                .map((condominio) => {
                  const fechamentoAtrasado = condominio.dataFechamentoDate ? isFechamentoAtrasado(condominio.dataFechamentoDate) : false
                  return (
                    <div
                      key={condominio.idCondominio}
                      className={`rounded border transition-colors ${
                        fechamentoAtrasado
                          ? 'bg-yellow-200 border-yellow-300 hover:bg-yellow-300'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <div className="px-1.5 py-1">
                        <div className="flex items-center gap-1 mb-0.5">
                          <Building2 className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 text-[11px] truncate leading-tight">{condominio.nomeFantasia}</span>
                        </div>
                        <div className="text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                            fechamentoAtrasado
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : 'bg-green-50 text-green-700 border-green-200'
                          }`}>
                            <Calendar className="w-3 h-3" />
                            <span className="font-bold text-base">{condominio.dataFechamentoFormatada}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded border border-gray-200 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando dados...</p>
        </div>
      )}
    </div>
  )
}



