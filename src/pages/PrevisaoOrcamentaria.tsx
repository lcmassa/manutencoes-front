import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, Loader2, RefreshCw, AlertCircle, ChevronRight, ChevronDown, PieChart } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenExpiryToast } from '../components/TokenExpiryToast'
import { gerarRelatorioPorCodigo } from '../utils/relatorios'
import Chart from 'chart.js/auto'

const CONDOMINIOS_URL: string =
  (import.meta as any).env?.VITE_CONDOMINIOS_URL ||
  '/api/condominios/superlogica/condominios/get'

const DESPESAS_URL: string =
  (import.meta as any).env?.VITE_DESPESAS_URL ||
  '/api/condominios/superlogica/despesas/index'

const PLANOCONTAS_URL: string =
  (import.meta as any).env?.VITE_PLANOCONTAS_URL ||
  '/api/condominios/superlogica/planocontas/index'

const UNIDADES_URL: string =
  (import.meta as any).env?.VITE_UNIDADES_URL || '/api/condominios/superlogica/unidades/index'

const buildUrl = (base: string, params: URLSearchParams) =>
  base.includes('?') ? `${base}&${params.toString()}` : `${base}?${params.toString()}`

type Condominio = { id: string; nome: string; dataFechamento?: string }

type CategoriaResumo = {
  conta: string
  total: number
  quantidade: number
}

type ResultadoMes = {
  label: string
  inicio: string
  fim: string
  total: number
  quantidade: number
  categorias: CategoriaResumo[]
}

type PlanoConta = {
  codigo: string
  descricao: string
}

type UnidadeRateio = {
  id: string
  nome: string
  proprietario?: string
  fracao: number
}

const ITENS_POR_PAGINA = 100
const MESES_NOMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const ROOT_KEY = '__ROOT_KEY__'
const CODIGO_REGEX = /^(\d+(?:\.\d+)*)(?:\s*[-–—]?\s*)?(.*)$/
const CODIGO_ONLY_REGEX = /^\d+(?:\.\d+)*$/
const MEDIA_RATEIO_DIVISOR = 12

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

function parseNumber(value: any): number {
  if (value == null) return 0
  if (typeof value === 'number' && Number.isFinite(value)) return value
  const raw = String(value)
  if (!raw.trim()) return 0
  const isPercent = raw.includes('%')
  const strippedHtml = raw.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ')
  const match = strippedHtml.match(/-?\d[\d.,-]*/)
  if (!match) return 0
  const candidate = match[0] || ''
  const cleaned = candidate.replace(/[R$\s]/g, '')
  if (!cleaned) return 0

  const hasDot = cleaned.includes('.')
  const hasComma = cleaned.includes(',')
  let normalized: string

  if (hasDot && hasComma) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(/,/g, '.')
  } else if (hasDot && !hasComma) {
    const lastSegment = cleaned.split('.').pop() || ''
    if (lastSegment.length === 3 && cleaned.length > 4) {
      normalized = cleaned.replace(/\./g, '')
    } else {
      normalized = cleaned
    }
  } else {
    normalized = cleaned
  }

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed)) return 0
  return isPercent ? parsed / 100 : parsed
}

function formatarDataParaAPI(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  const ano = data.getFullYear()
  // API espera formato MM/DD/YYYY (conforme documentação em MODELOS_DE_DADOS.md)
  return `${mes}/${dia}/${ano}`
}

function formatarDataLegivel(apiDate: string) {
  const [mes, dia, ano] = apiDate.split('/')
  if (!mes || !dia || !ano) return apiDate
  return `${dia.padStart(2, '0')}/${mes.padStart(2, '0')}/${ano}`
}

function extrairRotuloConta(item: any) {
  const candidatos = [
    item?.st_conta_cont,
    item?.stContaCont,
    item?.categoria,
    item?.conta,
    item?.nomeConta,
    item?.contaCompleta,
    item?.descricaoConta,
    item?.st_categoria_cont,
    item?.ds_conta_cont,
  ]
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim()) {
      return candidato.trim()
    }
  }
  return 'Sem categoria'
}

function extrairDataFechamentoCondominio(cond: any): string | undefined {
  const candidatos = [
    cond?.dt_fechamento_cond,
    cond?.dtFechamento,
    cond?.dt_fechamento,
    cond?.dataFechamento,
    cond?.dt_fechamento_balanco,
    cond?.dt_balanco,
    cond?.dtFechamentoBalanco,
    cond?.dataBalanco,
  ]
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim()) {
      return candidato.trim()
    }
  }
  return undefined
}

function tentarConstruirData(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null
  if (valor instanceof Date) {
    return Number.isNaN(valor.getTime()) ? null : valor
  }
  const texto = String(valor).trim()
  if (!texto) return null
  const somenteData = texto.split(' ')[0]
  const isoMatch = somenteData.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/)
  if (isoMatch) {
    const ano = Number(isoMatch[1])
    const mes = Number(isoMatch[2])
    const dia = Number(isoMatch[3])
    if (ano && mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return new Date(ano, mes - 1, dia)
    }
  }

  const barrasMatch = somenteData.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/)
  if (barrasMatch) {
    const parte1 = Number(barrasMatch[1])
    const parte2 = Number(barrasMatch[2])
    const ano = Number(barrasMatch[3].length === 2 ? `20${barrasMatch[3]}` : barrasMatch[3])
    if (!Number.isFinite(parte1) || !Number.isFinite(parte2) || !Number.isFinite(ano)) return null
    let mes = parte1
    let dia = parte2
    if (parte1 > 12 && parte2 <= 12) {
      dia = parte1
      mes = parte2
    } else if (parte2 > 12 && parte1 <= 12) {
      mes = parte1
      dia = parte2
    }
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
      return new Date(ano, mes - 1, dia)
    }
  }
  return null
}

function dataParaMesInput(valor: string | Date | null | undefined): string {
  const data = tentarConstruirData(valor)
  if (!data) return ''
  const ano = data.getFullYear()
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${ano}-${mes}`
}

const CODIGO_SEM_IDENTIFICACAO = '__SEM_CODIGO__'

function obterContaMaeCodigo(codigoOuLabel: string | undefined) {
  if (!codigoOuLabel) return CODIGO_SEM_IDENTIFICACAO
  const codigoLimpo = codigoOuLabel.trim()
  if (!codigoLimpo) return CODIGO_SEM_IDENTIFICACAO
  const partes = codigoLimpo.split('.').filter(Boolean)
  if (partes.length >= 2) {
    return `${partes[0]}.${partes[1]}`
  }
  return partes[0] || CODIGO_SEM_IDENTIFICACAO
}

function parseMesAnoLabel(label: string) {
  if (!label) return null
  const base = label.split('(')[0]?.trim() || label
  const [mesStr, anoStr] = base.split('/').map((parte) => parte.trim())
  if (!mesStr || !anoStr) return null
  const monthIndex = MESES_NOMES.findIndex((mes) => mes.toLowerCase() === mesStr.toLowerCase())
  const ano = Number(anoStr)
  if (monthIndex < 0 || !Number.isFinite(ano)) return null
  return { monthIndex, year: ano }
}

function formatMesAnoLabel(monthIndex: number, year: number) {
  const nomeMes = MESES_NOMES[monthIndex] || MESES_NOMES[0]
  return `${nomeMes}/${year}`
}

function parseContaInfo(conta: string) {
  const texto = conta?.trim() || ''
  const match = texto.match(CODIGO_REGEX)
  if (!match) {
    return {
      codigo: '',
      descricao: texto,
      label: texto,
    }
  }
  const codigo = match[1]
  const descricao = match[2]?.trim() || ''
  return {
    codigo,
    descricao,
    label: descricao ? `${codigo} - ${descricao}` : codigo,
  }
}

function stripCodigoFromLabel(label: string) {
  return label.replace(/^\d+(?:\.\d+)*\s*[-–—]?\s*/, '').trim() || label.trim()
}

function compareCodigoStrings(a: string, b: string) {
  const isNumericA = CODIGO_ONLY_REGEX.test(a)
  const isNumericB = CODIGO_ONLY_REGEX.test(b)
  if (isNumericA && isNumericB) {
    const aParts = a.split('.').map((n) => Number(n))
    const bParts = b.split('.').map((n) => Number(n))
    const maxLen = Math.max(aParts.length, bParts.length)
    for (let i = 0; i < maxLen; i++) {
      const aVal = Number.isFinite(aParts[i]) ? aParts[i]! : -1
      const bVal = Number.isFinite(bParts[i]) ? bParts[i]! : -1
      if (aVal !== bVal) {
        return aVal - bVal
      }
    }
    return 0
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
}

async function buscarCondominios(apiInstance: typeof api): Promise<Condominio[]> {
  const lista: Condominio[] = []
  let pagina = 1
  let temMais = true

  while (temMais) {
    const params = new URLSearchParams({
      id: '-1',
      somenteCondominiosAtivos: '1',
      ignorarCondominioModelo: '1',
      itensPorPagina: '100',
      pagina: String(pagina),
    })
    const url = buildUrl(CONDOMINIOS_URL, params)
    const response = await apiInstance.get<any>(url)
    const data = response.data
    const registros = Array.isArray(data) ? data : data?.data || data?.condominios || []

    registros.forEach((cond: any) => {
      const nome = (cond.st_fantasia_cond || cond.nomeFantasia || cond.st_nome_cond || cond.nome || '').trim()
      const id = cond.id_condominio_cond || cond.id || cond.idCondominio || ''
      if (nome && id) {
        lista.push({ id, nome, dataFechamento: extrairDataFechamentoCondominio(cond) })
      }
    })

    if (registros.length < 100) {
      temMais = false
    } else {
      pagina++
    }
  }

  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }))
}

async function buscarPlanoContas(apiInstance: typeof api, idCondominio: string): Promise<PlanoConta[]> {
  if (!idCondominio) return []
  const params = new URLSearchParams({
    ID_CONDOMINIO_COND: idCondominio,
  })
  const url = buildUrl(PLANOCONTAS_URL, params)
  const response = await apiInstance.get<any>(url)
  const dados = response.data
  const registros = Array.isArray(dados) ? dados : dados?.data || dados?.planocontas || []
  return registros
    .map((item: any) => ({
      codigo: (item.st_conta_cont || item.codigo || '').trim(),
      descricao: (item.st_descricao_cont || item.descricao || '').trim(),
    }))
    .filter((item: PlanoConta) => !!item.codigo)
}

async function buscarUnidades(apiInstance: typeof api, idCondominio: string): Promise<UnidadeRateio[]> {
  if (!idCondominio) return []
  const lista: UnidadeRateio[] = []
  let pagina = 1
  const itensPagina = 200
  let temMais = true

  while (temMais) {
    const params = new URLSearchParams({
      idCondominio,
      itensPorPagina: String(itensPagina),
      pagina: String(pagina),
      comCondominos: '1',
    })
    const url = buildUrl(UNIDADES_URL, params)
    const response = await apiInstance.get<any>(url)
    const data = response.data
    const registros = Array.isArray(data) ? data : data?.data || data?.unidades || []

    registros.forEach((item: any) => {
      const id =
        item.id_unidade_uni ||
        item.id_unidade ||
        item.id_unidade_cun ||
        item.id ||
        item.idUnidade ||
        item.id_unidade ||
        ''
      const nome =
        item.st_unidade_uni ||
        item.unidade ||
        item.nomeUnidade ||
        item.st_nome_unidade ||
        item.descricao ||
        ''
      if (!id || !nome) return

      const proprietario =
        item.st_nome_condomino ||
        item.nomeCondomino ||
        item.proprietario ||
        item.st_nome_cdn ||
        item.condomino ||
        ''

      const fracaoCandidatos = [
        item.vl_fracaoideal_uni,
        item.vl_fracao_ideal_uni,
        item.fracaoIdeal,
        item.fracao,
        item.vl_fracao,
        item.vl_fracao_uni,
        item.nm_fracao_uni,
        item.nm_fracao_real_uni,
        item.perc_participacao,
        item.percentualParticipacao,
      ]
      let fracao = 0
      for (const candidato of fracaoCandidatos) {
        const valor = parseNumber(candidato)
        if (valor > 0) {
          fracao = valor
          break
        }
      }

      lista.push({
        id: String(id),
        nome: String(nome).trim(),
        proprietario: String(proprietario || '').trim() || undefined,
        fracao,
      })
    })

    if (registros.length < itensPagina) {
      temMais = false
    } else {
      pagina++
    }
  }

  return lista.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))
}

const IS_DEV = typeof import.meta !== 'undefined' && !!(import.meta as any).env?.DEV

async function buscarResumoMensal(
  apiInstance: typeof api,
  idCondominio: string,
  dtInicio: string,
  dtFim: string,
): Promise<{ total: number; quantidade: number; categorias: CategoriaResumo[] }> {
  const categorias = new Map<string, { total: number; quantidade: number }>()
  const semCategoriaDebug: Array<{
    valor: number
    keys: string[]
    rawConta?: any
  }> = []
  let pagina = 1
  let temMais = true
  let total = 0
  let quantidade = 0

  while (temMais) {
    const params = new URLSearchParams({
      comStatus: 'liquidadas',
      dtInicio,
      dtFim,
      idCondominio,
      itensPorPagina: String(ITENS_POR_PAGINA),
      pagina: String(pagina),
    })
    const url = buildUrl(DESPESAS_URL, params)
    try {
      const response = await apiInstance.get<any>(url)
      const dados = response.data
      const registros = Array.isArray(dados) ? dados : dados?.data || dados?.despesas || []

    registros.forEach((item: any) => {
      const valorDespesa = parseNumber(
        item.vl_pago ??
          item.vl_valor_pdes ??
          item.valor ??
          item.vl_total_pdes ??
          item.valorPago ??
          item.vlPago,
      )
      if (valorDespesa <= 0) return

      const apropriacoes = Array.isArray(item?.apropriacao) && item.apropriacao.length > 0 ? item.apropriacao : [null]
      const fallbackValor = apropriacoes.length > 0 ? valorDespesa / apropriacoes.length : valorDespesa
      apropriacoes.forEach((apro: any) => {
        const valorApropriado = parseNumber(apro?.vl_valor_apro)
        let valor: number
        if (valorApropriado > 0 && valorApropriado <= 1 && valorDespesa > 0) {
          valor = valorDespesa * valorApropriado
        } else if (valorApropriado > 1) {
          valor = valorApropriado
        } else {
          valor = fallbackValor
        }
        if (valor <= 0) return

        total += valor
        quantidade += 1

        const codigoConta = apro?.st_conta_cont?.trim()
        const descricaoConta = apro?.st_descricao_cont?.trim()
        const conta =
          codigoConta && codigoConta.length > 0
            ? descricaoConta
              ? `${codigoConta} - ${descricaoConta}`
              : codigoConta
            : extrairRotuloConta(item)

        if (!categorias.has(conta)) {
          categorias.set(conta, { total: 0, quantidade: 0 })
        }
        const resumo = categorias.get(conta)!
        resumo.total += valor
        resumo.quantidade += 1

        if (conta === 'Sem categoria' && semCategoriaDebug.length < 20) {
          semCategoriaDebug.push({
            valor,
            keys: Object.keys(item || {}),
            rawConta: {
              st_conta_cont: item?.st_conta_cont,
              stContaCont: item?.stContaCont,
              categoria: item?.categoria,
              conta: item?.conta,
              nomeConta: item?.nomeConta,
              contaCompleta: item?.contaCompleta,
              descricaoConta: item?.descricaoConta,
              contaMae: item?.contaMae,
              aproStConta: apro?.st_conta_cont,
              aproDescricao: apro?.st_descricao_cont,
            },
          })
        }
      })
    })

    if (registros.length < ITENS_POR_PAGINA) {
      temMais = false
    } else {
      pagina++
    }
    } catch (error: any) {
      const status = error?.response?.status
      const statusText = error?.response?.statusText
      const errorData = error?.response?.data
      
      if (status === 422) {
        console.error('[PrevisaoOrcamentaria] Erro 422 - Dados inválidos:', {
          url,
          params: {
            comStatus: 'liquidadas',
            dtInicio,
            dtFim,
            idCondominio,
            itensPorPagina: String(ITENS_POR_PAGINA),
            pagina: String(pagina),
          },
          errorData,
        })
        throw new Error(
          `Erro 422: Dados inválidos na requisição.\n` +
          `URL: ${url}\n` +
          `Parâmetros: dtInicio=${dtInicio}, dtFim=${dtFim}, idCondominio=${idCondominio}\n` +
          `Resposta: ${typeof errorData === 'string' ? errorData : JSON.stringify(errorData)}`
        )
      }
      throw error
    }
  }

  const lista = Array.from(categorias.entries())
    .map(([conta, info]) => ({ conta, total: info.total, quantidade: info.quantidade }))
    .sort((a, b) => b.total - a.total)

  if (IS_DEV && semCategoriaDebug.length) {
    console.warn('[PrevisaoOrcamentaria] Registros sem categoria (top 20):', semCategoriaDebug)
  }

  return { total, quantidade, categorias: lista }
}

function gerarIntervalos(fecha: Date) {
  const intervalos: { label: string; inicio: string; fim: string }[] = []
  const referencia = new Date(fecha.getFullYear(), fecha.getMonth(), 1)

  for (let i = 11; i >= 0; i--) {
    const inicio = new Date(referencia.getFullYear(), referencia.getMonth() - i, 1)
    const fim = new Date(referencia.getFullYear(), referencia.getMonth() - i + 1, 0)
    const label = `${MESES_NOMES[inicio.getMonth()]}/${inicio.getFullYear()}`
    intervalos.push({
      label,
      inicio: formatarDataParaAPI(inicio),
      fim: formatarDataParaAPI(fim),
    })
  }

  return intervalos
}

export function PrevisaoOrcamentaria() {
  const { token, companyId } = useAuth()
  const [condominios, setCondominios] = useState<Condominio[]>([])
  const [condominioSelecionado, setCondominioSelecionado] = useState<string>('')
  const [mesFechamento, setMesFechamento] = useState(() => {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`
  })
  const [loadingCondominios, setLoadingCondominios] = useState(false)
  const [planoContasMap, setPlanoContasMap] = useState<Record<string, string>>({})
  const [indicesReajuste, setIndicesReajuste] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultados, setResultados] = useState<ResultadoMes[]>([])
  const [mostrarModalIndices, setMostrarModalIndices] = useState(false)
  const [mostrarModalRateio, setMostrarModalRateio] = useState(false)
  const [previsaoCalculada, setPrevisaoCalculada] = useState(false)
  const [fallbackRelatorioLoading, setFallbackRelatorioLoading] = useState(false)
  const [fallbackRelatorioInfo, setFallbackRelatorioInfo] = useState<{ id?: string; url?: string } | null>(null)
  const [mostrarComparacaoRef, setMostrarComparacaoRef] = useState(false)
  const [editandoTabela, setEditandoTabela] = useState(false)
  const [valoresEditados, setValoresEditados] = useState<Record<string, Record<string, number>>>({})
  const [unidades, setUnidades] = useState<UnidadeRateio[]>([])
  const [loadingUnidades, setLoadingUnidades] = useState(false)
  const [erroUnidades, setErroUnidades] = useState<string | null>(null)
  const planilhaRef = useRef<HTMLDivElement | null>(null)
  // UX da janela de índices
  const [buscaIndice, setBuscaIndice] = useState<string>('')
  const [ordenarPor, setOrdenarPor] = useState<'codigo' | 'descricao'>('codigo')
  const [visaoCompacta, setVisaoCompacta] = useState(true)

  // gráfico de pizza dos índices
  const [mostrarModalGrafico, setMostrarModalGrafico] = useState(false)
  const graficoCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const graficoInstanceRef = useRef<Chart | null>(null)

  useEffect(() => {
    if (!token || !companyId) return
    let cancelado = false
    async function carregar() {
      try {
        setLoadingCondominios(true)
        const lista = await buscarCondominios(api)
        if (cancelado) return
        setCondominios(lista)
        if (lista.length > 0) setCondominioSelecionado(lista[0].id)
      } catch (error: any) {
        if (!cancelado) setErro(error?.message || 'Não foi possível carregar os condomínios.')
      } finally {
        if (!cancelado) setLoadingCondominios(false)
      }
    }
    carregar()
    return () => {
      cancelado = true
    }
  }, [token, companyId])

  useEffect(() => {
    if (!token || !condominioSelecionado) return
    let cancelado = false
    async function carregarPlano() {
      try {
        const plano = await buscarPlanoContas(api, condominioSelecionado)
        if (cancelado) return
        const mapa = plano.reduce((acc, conta) => {
          acc[conta.codigo] = conta.descricao
          return acc
        }, {} as Record<string, string>)
        setPlanoContasMap(mapa)
      } catch (erro) {
        console.warn('[PrevisaoOrcamentaria] Falha ao carregar plano de contas:', erro)
        if (!cancelado) setPlanoContasMap({})
      }
    }
    carregarPlano()
    return () => {
      cancelado = true
    }
  }, [token, condominioSelecionado])

  useEffect(() => {
    if (!token || !condominioSelecionado) {
      setUnidades([])
      return
    }
    let cancelado = false
    async function carregarUnidades() {
      try {
        setLoadingUnidades(true)
        setErroUnidades(null)
        const lista = await buscarUnidades(api, condominioSelecionado)
        if (cancelado) return
        setUnidades(lista)
      } catch (error: any) {
        if (!cancelado) {
          setUnidades([])
          setErroUnidades(error?.message || 'Não foi possível carregar as unidades.')
        }
      } finally {
        if (!cancelado) setLoadingUnidades(false)
      }
    }
    carregarUnidades()
    return () => {
      cancelado = true
    }
  }, [token, condominioSelecionado])

  useEffect(() => {
    if (!condominioSelecionado || !condominios.length) return
    const cond = condominios.find((item) => item.id === condominioSelecionado)
    if (!cond) return
    const mesPadrao = dataParaMesInput(cond.dataFechamento)
    if (!mesPadrao) return
    setMesFechamento((valorAtual) => (valorAtual === mesPadrao ? valorAtual : mesPadrao))
  }, [condominioSelecionado, condominios])

  useEffect(() => {
    if (!resultados.length) {
      setMostrarModalIndices(false)
      setPrevisaoCalculada(false)
      return
    }
    setMostrarModalIndices(true)
    setPrevisaoCalculada(false)
  }, [resultados])

  useEffect(() => {
    setValoresEditados({})
    setEditandoTabela(false)
  }, [resultados, condominioSelecionado])

  async function gerarPrevisao() {
    if (!token) {
      setErro('Token não disponível. Autentique-se primeiro.')
      return
    }
    if (!condominioSelecionado) {
      setErro('Selecione um condomínio.')
      return
    }
    if (!mesFechamento) {
      setErro('Informe o mês de fechamento.')
      return
    }

    setErro(null)
    setFallbackRelatorioInfo(null)
    setLoading(true)
    setResultados([])

    try {
      const referencia = new Date(`${mesFechamento}-01T00:00:00`)
      if (isNaN(referencia.getTime())) throw new Error('Mês de fechamento inválido.')
      const intervalos = gerarIntervalos(referencia)
      const lista: ResultadoMes[] = []

      for (const intervalo of intervalos) {
        const resumo = await buscarResumoMensal(api, condominioSelecionado, intervalo.inicio, intervalo.fim)
        lista.push({
          label: intervalo.label,
          inicio: intervalo.inicio,
          fim: intervalo.fim,
          total: resumo.total,
          quantidade: resumo.quantidade,
          categorias: resumo.categorias,
        })
      }

      setResultados(lista)
    } catch (error: any) {
      setErro(error?.message || 'Falha ao gerar a previsão.')
    } finally {
      setLoading(false)
    }
  }

  async function gerarRelatorioFallback() {
    if (!token) {
      setErro('Token não disponível. Autentique-se primeiro.')
      return
    }
    if (!condominioSelecionado) {
      setErro('Selecione um condomínio.')
      return
    }
    setFallbackRelatorioLoading(true)
    setFallbackRelatorioInfo(null)
    try {
      const resp = await gerarRelatorioPorCodigo(
        token,
        'W046A',
        condominioSelecionado,
        {},
        'pdf',
        true
      )
      setFallbackRelatorioInfo({
        id: resp.idImpressao,
        url: resp.url,
      })
    } catch (e: any) {
      setErro(e?.message || 'Falha ao gerar o relatório (fallback).')
    } finally {
      setFallbackRelatorioLoading(false)
    }
  }

  const planilhaLabels = useMemo(() => resultados.map((item) => item.label), [resultados])
  const monthPairs = useMemo(() => {
    return planilhaLabels.map((label) => {
      const parsed = parseMesAnoLabel(label)
      const projLabelBase =
        parsed != null ? formatMesAnoLabel(parsed.monthIndex, parsed.year + 1) : `${label} + 1`
      return {
        sourceLabel: label,
        refLabel: `${label} (Ref.)`,
        projLabel: `${projLabelBase} (Proj.)`,
      }
    })
  }, [planilhaLabels])
  const totalRefLabel = 'Total (Ref.)'
  const totalProjLabel = 'Total (Proj.)'
  const monthColumns = useMemo(() => {
    const cols: string[] = []
    monthPairs.forEach((pair) => {
      cols.push(pair.refLabel, pair.projLabel)
    })
    cols.push(totalRefLabel, totalProjLabel)
    return cols
  }, [monthPairs, totalRefLabel, totalProjLabel])

  const colunasVisiveis = useMemo(() => {
    const cols: string[] = []
    if (mostrarComparacaoRef) {
      monthPairs.forEach((pair) => {
        cols.push(pair.refLabel, pair.projLabel)
      })
      cols.push(totalRefLabel, totalProjLabel)
    } else {
      monthPairs.forEach((pair) => {
        cols.push(pair.projLabel)
      })
      cols.push(totalProjLabel)
    }
    return cols
  }, [mostrarComparacaoRef, monthPairs, totalRefLabel, totalProjLabel])

  const normalizar = useCallback(
    (s?: string) => (s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() : ''),
    [],
  )

  const isExtraordinariaDescricao = useCallback(
    (s?: string) => normalizar(s).includes('extraordin'),
    [normalizar],
  )

  const isContaMaeExtraordinaria = useCallback(
    (codigoMae?: string, categoria?: string) => {
      if (!codigoMae) return false
      const descMae = planoContasMap[codigoMae]
      if (isExtraordinariaDescricao(descMae)) return true
      if (categoria && isExtraordinariaDescricao(stripCodigoFromLabel(categoria))) return true
      return false
    },
    [planoContasMap, isExtraordinariaDescricao],
  )

  const obterFatorReajuste = useCallback(
    (codigo?: string, categoria?: string) => {
      const chave = obterContaMaeCodigo(codigo || categoria || '')
      if (isContaMaeExtraordinaria(chave, categoria)) {
        return 1
      }
      const bruto = indicesReajuste[chave]
      if (bruto == null || bruto === '') return 1
      const normalizado = Number(String(bruto).replace(',', '.'))
      return Number.isFinite(normalizado) ? 1 + normalizado / 100 : 1
    },
    [indicesReajuste, isContaMaeExtraordinaria],
  )

  const handleIndiceChange = useCallback((codigo: string, valor: string) => {
    setIndicesReajuste((prev) => {
      const proximo = { ...prev, [codigo]: valor }
      return proximo
    })
    setPrevisaoCalculada(false)
  }, [])

  const abrirModalIndices = useCallback(() => {
    setMostrarModalIndices(true)
    setPrevisaoCalculada(false)
  }, [])

  const fecharModalIndices = useCallback(() => {
    setMostrarModalIndices(false)
  }, [])

  const abrirModalRateio = useCallback(() => {
    setMostrarModalRateio(true)
  }, [])

  const fecharModalRateio = useCallback(() => {
    setMostrarModalRateio(false)
  }, [])

  const handleValorEditadoChange = useCallback((rowKey: string, coluna: string, valor: number) => {
    setValoresEditados((prev) => {
      const atual = prev[rowKey] ? { ...prev[rowKey] } : {}
      atual[coluna] = valor
      return {
        ...prev,
        [rowKey]: atual,
      }
    })
  }, [])

  const confirmarCalculo = useCallback(() => {
    setPrevisaoCalculada(true)
    setMostrarModalIndices(false)
    requestAnimationFrame(() => {
      if (planilhaRef.current) {
        planilhaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    })
  }, [])

  const irParaPlanilhaCalculada = useCallback(() => {
    if (!previsaoCalculada) return
    if (planilhaRef.current) {
      planilhaRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [previsaoCalculada])

  const toggleContaMae = useCallback((codigo: string) => {
    setExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(codigo)) {
        next.delete(codigo)
      } else {
        next.add(codigo)
      }
      return next
    })
  }, [])

  const planilhaRows = useMemo(() => {
    if (!resultados.length) return []
    const mapa = new Map<
      string,
      {
        categoria: string
        codigo: string
        descricao: string
        labelFormatada: string
        valores: Record<string, number>
        total: number
      }
    >()

    resultados.forEach((mes) =>
      mes.categorias.forEach((cat) => {
        const info = parseContaInfo(cat.conta)
        if (!mapa.has(cat.conta)) {
          mapa.set(cat.conta, {
            categoria: cat.conta,
            codigo: info.codigo,
            descricao: info.descricao,
            labelFormatada: info.label,
            valores: {},
            total: 0,
          })
        }
        const row = mapa.get(cat.conta)!
        row.valores[mes.label] = cat.total
        row.total += cat.total
      }),
    )

    return Array.from(mapa.values()).sort((a, b) => b.total - a.total)
  }, [resultados])

  const contasMaeList = useMemo(() => {
    const mapa = new Map<string, string>()
    planilhaRows.forEach((row) => {
      const codigoMae = obterContaMaeCodigo(row.codigo || row.categoria)
      if (!codigoMae) return
      if (!mapa.has(codigoMae)) {
        const descricao = planoContasMap[codigoMae]
        mapa.set(codigoMae, descricao ? `${codigoMae} - ${descricao}` : codigoMae)
      }
    })
    const lista = Array.from(mapa.entries())
      .map(([codigo, label]) => ({ codigo, label }))
      .filter((c) => !isContaMaeExtraordinaria(c.codigo, c.label))
      .sort((a, b) => compareCodigoStrings(a.codigo, b.codigo))
    return lista
  }, [planilhaRows, planoContasMap, isContaMaeExtraordinaria])

  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())

  useEffect(() => {
    setExpandidos((prev) => {
      const next = new Set<string>()
      contasMaeList.forEach(({ codigo }) => {
        if (prev.has(codigo)) next.add(codigo)
      })
      return next
    })
  }, [contasMaeList])

  useEffect(() => {
    if (!contasMaeList.length) {
      setIndicesReajuste({})
      return
    }
    setIndicesReajuste((prev) => {
      let mudou = false
      const next = { ...prev }
      contasMaeList.forEach(({ codigo }) => {
        if (!(codigo in next)) {
          next[codigo] = '0'
          mudou = true
        }
      })
      Object.keys(next).forEach((codigo) => {
        if (!contasMaeList.find((c) => c.codigo === codigo)) {
          delete next[codigo]
          mudou = true
        }
      })
      return mudou ? next : prev
    })
  }, [contasMaeList])

  type ContaMaeDisplay = {
    codigo: string
    label: string
    valores: Record<string, number>
    children: {
      key: string
      label: string
      valores: Record<string, number>
      codigo: string
    }[]
  }

  const contasMaeAgrupadas = useMemo<ContaMaeDisplay[]>(() => {
    if (!planilhaRows.length) return []

    const makeEmptyValues = () =>
      monthColumns.reduce((acc, col) => {
        acc[col] = 0
        return acc
      }, {} as Record<string, number>)

    const mapa = new Map<string, ContaMaeDisplay>()

    const ensureMae = (codigoMae: string) => {
      if (!mapa.has(codigoMae)) {
        const descricao = planoContasMap[codigoMae]
        mapa.set(codigoMae, {
          codigo: codigoMae,
          label: descricao ? `${codigoMae} - ${descricao}` : codigoMae,
          valores: makeEmptyValues(),
          children: [],
        })
      }
      return mapa.get(codigoMae)!
    }

    const obterValorAjustado = (rowKey: string, coluna: string, valorPadrao: number) => {
      const override = valoresEditados[rowKey]?.[coluna]
      return typeof override === 'number' && Number.isFinite(override) ? override : valorPadrao
    }

    planilhaRows.forEach((row) => {
      const codigoMae = obterContaMaeCodigo(row.codigo || row.categoria)
      const mae = ensureMae(codigoMae)
      const valoresLinha = makeEmptyValues()
      const fator = obterFatorReajuste(row.codigo, row.categoria)
      const rowKey = row.codigo || row.categoria
      monthPairs.forEach((pair) => {
        const valorReferenciaBase = row.valores[pair.sourceLabel] || 0
        const valorRef = obterValorAjustado(rowKey, pair.refLabel, valorReferenciaBase)
        const valorProjBase = valorReferenciaBase * fator
        const valorProj = obterValorAjustado(rowKey, pair.projLabel, valorProjBase)
        valoresLinha[pair.refLabel] = valorRef
        valoresLinha[pair.projLabel] = valorProj
      })
      valoresLinha[totalRefLabel] = monthPairs.reduce(
        (acc, pair) => acc + valoresLinha[pair.refLabel],
        0,
      )
      valoresLinha[totalProjLabel] = monthPairs.reduce(
        (acc, pair) => acc + valoresLinha[pair.projLabel],
        0,
      )
      mae.children.push({
        key: `${row.categoria}-item`,
        label: row.labelFormatada,
        valores: valoresLinha,
        codigo: row.codigo || row.categoria,
      })
      monthColumns.forEach((col) => {
        mae.valores[col] += valoresLinha[col] || 0
      })
    })

    return Array.from(mapa.values()).sort((a, b) => compareCodigoStrings(a.codigo, b.codigo))
  }, [
    planilhaRows,
    monthColumns,
    monthPairs,
    obterFatorReajuste,
    planoContasMap,
    totalRefLabel,
    totalProjLabel,
    valoresEditados,
  ])

  const contasMaeOrdinarias = useMemo(
    () => contasMaeAgrupadas.filter((mae) => !isContaMaeExtraordinaria(mae.codigo, mae.label)),
    [contasMaeAgrupadas, isContaMaeExtraordinaria],
  )
  const contasMaeExtraordinarias = useMemo(
    () => contasMaeAgrupadas.filter((mae) => isContaMaeExtraordinaria(mae.codigo, mae.label)),
    [contasMaeAgrupadas, isContaMaeExtraordinaria],
  )

  const planilhaTotalLinha = useMemo(() => {
    if (!contasMaeOrdinarias.length) return null
    const valores = monthColumns.reduce((acc, col) => {
      acc[col] = contasMaeOrdinarias.reduce((sum, mae) => sum + (mae.valores[col] || 0), 0)
      return acc
    }, {} as Record<string, number>)
    return { categoria: 'TOTAL DO PERÍODO', valores }
  }, [contasMaeOrdinarias, monthColumns])

  const totalResumoRef = planilhaTotalLinha?.valores?.[totalRefLabel] ?? 0
  const totalResumoProj = planilhaTotalLinha?.valores?.[totalProjLabel] ?? 0
  const somaFracoes = useMemo(
    () => unidades.reduce((acc, unidade) => acc + (unidade.fracao > 0 ? unidade.fracao : 0), 0),
    [unidades],
  )
  const mediaMensalRateio = useMemo(
    () => (MEDIA_RATEIO_DIVISOR > 0 ? totalResumoProj / MEDIA_RATEIO_DIVISOR : 0),
    [totalResumoProj],
  )
  const rateioPorUnidade = useMemo(() => {
    if (!unidades.length) return []
    return unidades.map((unidade) => {
      const peso = somaFracoes > 0 ? (unidade.fracao || 0) / somaFracoes : 1 / unidades.length
      return {
        ...unidade,
        percentual: peso * 100,
        valorMensal: mediaMensalRateio * peso,
      }
    })
  }, [unidades, somaFracoes, mediaMensalRateio])
  const totalPercentualRateio = useMemo(
    () => rateioPorUnidade.reduce((acc, unidade) => acc + (Number.isFinite(unidade.percentual) ? unidade.percentual : 0), 0),
    [rateioPorUnidade],
  )
  const totalValorMensalRateio = useMemo(
    () => rateioPorUnidade.reduce((acc, unidade) => acc + (unidade.valorMensal || 0), 0),
    [rateioPorUnidade],
  )

  // Montagem do gráfico de pizza com a média das contas-mãe
  const graficoIndicesData = useMemo(() => {
    const labels: string[] = []
    const valores: number[] = []
    
    // Agrupar valores por conta-mãe
    const valoresPorContaMae = new Map<string, number[]>()
    
    planilhaRows.forEach((row) => {
      const codigoMae = obterContaMaeCodigo(row.codigo || row.categoria)
      if (!codigoMae) return
      
      // Coletar todos os valores desta conta (de todos os meses)
      const valoresMeses = Object.values(row.valores).filter(v => Number.isFinite(v) && v > 0)
      if (valoresMeses.length === 0) return
      
      if (!valoresPorContaMae.has(codigoMae)) {
        valoresPorContaMae.set(codigoMae, [])
      }
      valoresPorContaMae.get(codigoMae)!.push(...valoresMeses)
    })
    
    // Calcular a média de cada conta-mãe
    contasMaeList.forEach(({ codigo, label }) => {
      const todosValores = valoresPorContaMae.get(codigo) || []
      if (todosValores.length === 0) return
      
      // Calcular média
      const soma = todosValores.reduce((acc, v) => acc + v, 0)
      const media = soma / todosValores.length
      
      if (Number.isFinite(media) && media > 0) {
        labels.push(label)
        valores.push(media)
      }
    })
    
    return { labels, valores }
  }, [contasMaeList, planilhaRows])

  useEffect(() => {
    if (!mostrarModalGrafico) return
    const canvas = graficoCanvasRef.current
    if (!canvas) return
    
    // Pequeno delay para garantir que o canvas está renderizado
    const timer = setTimeout(() => {
      if (graficoInstanceRef.current) {
        graficoInstanceRef.current.destroy()
        graficoInstanceRef.current = null
      }
      const { labels, valores } = graficoIndicesData
      if (valores.length === 0 || valores.every((v) => v <= 0)) {
        return
      }
      const colors = labels.map((_, i) => {
        const base = (i * 37) % 360
        return `hsl(${base} 70% 55%)`
      })
      graficoInstanceRef.current = new Chart(canvas, {
        type: 'pie',
        data: {
          labels,
          datasets: [
            {
              label: 'Média (R$)',
              data: valores,
              backgroundColor: colors,
              borderWidth: 1,
            },
          ],
        },
        options: {
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const v = ctx.parsed as number
                  return `${ctx.label}: ${formatCurrency(v)}`
                },
              },
            },
          },
        },
      })
    }, 100)

    return () => {
      clearTimeout(timer)
      if (graficoInstanceRef.current) {
        graficoInstanceRef.current.destroy()
        graficoInstanceRef.current = null
      }
    }
  }, [mostrarModalGrafico, graficoIndicesData])

  return (
    <div className="p-3 space-y-3">
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Previsão Orçamentária</h1>
          <p className="text-[11px] text-gray-500">Consulta direta na API de despesas.</p>
        </div>
      <TokenExpiryToast token={token} />
      </div>

      <div className="bg-white border border-gray-200 rounded-md p-3 shadow-sm space-y-3">
        {erro && (
          <div className="flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded p-3">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <span>{erro}</span>
          </div>
        )}

        {erro?.toLowerCase().includes('resposta html') && (
          <div className="rounded border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900 space-y-2">
            <p>
              A API de despesas retornou HTML (provável redirecionamento/login do backend). Seu JWT está válido,
              mas este endpoint não está aceitando o token no momento.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={gerarRelatorioFallback}
                disabled={fallbackRelatorioLoading || !condominioSelecionado}
                className="inline-flex items-center justify-center gap-2 px-3 py-1.5 rounded bg-amber-600 text-white text-xs font-medium hover:bg-amber-700 disabled:opacity-60"
              >
                {fallbackRelatorioLoading ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Gerando relatório (fallback)...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-3 h-3" />
                    Gerar relatório W046A (PDF)
                  </>
                )}
              </button>
              {fallbackRelatorioInfo?.url && (
                <a
                  href={fallbackRelatorioInfo.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-amber-700 underline"
                >
                  Abrir PDF gerado
                </a>
              )}
              {!fallbackRelatorioInfo?.url && fallbackRelatorioInfo?.id && (
                <span className="text-amber-700">
                  ID da impressão na fila: <strong>{fallbackRelatorioInfo.id}</strong>
                </span>
              )}
            </div>
          </div>
        )}

        <div className="grid gap-3 md:grid-cols-4">
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wide">
              Condomínio
            </label>
            <select
              className="w-full border border-gray-300 rounded px-2 py-2 text-sm"
              disabled={loadingCondominios || loading || condominios.length === 0}
              value={condominioSelecionado}
              onChange={(e) => setCondominioSelecionado(e.target.value)}
            >
              {condominios.length === 0 && <option value="">Nenhum condomínio disponível</option>}
              {condominios.map((cond) => (
                <option key={cond.id} value={cond.id}>
                  {cond.nome}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-1 uppercase tracking-wide">
              Mês de fechamento
            </label>
            <div className="flex items-center border border-gray-300 rounded px-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <input
                type="month"
                value={mesFechamento}
                onChange={(e) => setMesFechamento(e.target.value)}
                className="w-full bg-transparent border-0 focus:ring-0 text-sm ml-2 py-2"
                disabled={loading}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Busca automática dos últimos 12 meses.</p>
          </div>
          <div className="flex flex-col justify-end md:col-span-2">
            <button
              onClick={gerarPrevisao}
              disabled={loading || !condominioSelecionado || !mesFechamento}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60 w-full md:w-auto"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Consultando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Gerar previsão
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm text-center text-sm text-gray-600 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          Buscando balancetes diretamente na API...
        </div>
      )}

      {!loading && resultados.length > 0 && (
        <>
          <div className="bg-white border border-gray-200 rounded-md shadow-sm p-3 space-y-2">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-2">
              <div>
                <h2 className="text-[13px] font-semibold text-gray-800">Configurar índices e liberar a previsão</h2>
                <p className="text-[11px] text-gray-500">Ajuste os percentuais das contas-mãe e calcule a planilha do próximo período.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={abrirModalIndices}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  Calcular previsão
                </button>
                <button
                  onClick={irParaPlanilhaCalculada}
                  disabled={!previsaoCalculada}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded border border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Planilha da previsão calculada
                </button>
                <button
                  onClick={() => setEditandoTabela((prev) => !prev)}
                  disabled={!previsaoCalculada}
                  className={`inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded border ${
                    editandoTabela
                      ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  {editandoTabela ? 'Concluir edição' : 'Editar planilha'}
                </button>
                <button
                  onClick={abrirModalRateio}
                  disabled={!previsaoCalculada || loadingUnidades || rateioPorUnidade.length === 0}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Rateio por fração
                </button>
                <button
                  onClick={() => setMostrarModalGrafico(true)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded border border-gray-200 text-gray-700 hover:bg-gray-50"
                  title="Abrir gráfico de pizza com a média das contas-mãe"
                >
                  <PieChart className="w-4 h-4 mr-2" />
                  Gráfico (pizza)
                </button>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-gray-600 select-none">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                checked={mostrarComparacaoRef}
                onChange={(e) => setMostrarComparacaoRef(e.target.checked)}
                disabled={!previsaoCalculada}
              />
              Mostrar colunas de referência (Ref.) para comparação
            </label>
            {!previsaoCalculada && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-1.5">
                Calcule a previsão após definir os índices para visualizar a planilha.
              </div>
            )}
          </div>

          {previsaoCalculada && (
            <>
              <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-900">
                <p className="font-medium">
                  Período: {resultados[0]?.label} a {resultados[resultados.length - 1]?.label}
                </p>
                <p>
                  {mostrarComparacaoRef && (
                    <>
                      Total referência: <strong>{formatCurrency(totalResumoRef)}</strong> •{' '}
                    </>
                  )}
                  Total projetado: <strong>{formatCurrency(totalResumoProj)}</strong> •{' '}
                  {resultados.reduce((acc, item) => acc + item.quantidade, 0)} despesas liquidadas
                </p>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <h3 className="text-sm font-semibold text-gray-800">Visualizações</h3>
                  <button
                    onClick={() => setMostrarModalGrafico(true)}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded border border-gray-200 hover:bg-gray-50"
                    title="Abrir gráfico de pizza com a média das contas-mãe"
                  >
                    <PieChart className="w-4 h-4" />
                    Gráfico (pizza) das contas-mãe
                  </button>
                </div>
              </div>

              <div ref={planilhaRef} className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-sm font-semibold text-gray-800">Planilha consolidada (conta → subtotais)</h2>
                  {monthPairs.length > 0 && (
                    <span className="text-xs text-gray-500">
                      1º mês projetado:{' '}
                      <strong>{monthPairs[0].projLabel.replace(' (Proj.)', '')}</strong>
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b">
                        <th className="py-2 pr-2 font-medium">Categoria</th>
                        {colunasVisiveis.map((label) => (
                          <th key={label} className="py-2 px-2 font-medium text-right whitespace-nowrap">
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {contasMaeOrdinarias.map((mae) => {
                        const aberto = expandidos.has(mae.codigo)
                        return (
                          <React.Fragment key={mae.codigo}>
                            <tr className="bg-yellow-50 text-gray-900 font-semibold border-l-4 border-yellow-300">
                              <td className="py-1 pr-2 whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => toggleContaMae(mae.codigo)}
                                  className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded border border-yellow-300 text-yellow-700 bg-white/70 hover:bg-white"
                                >
                                  {aberto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                </button>
                                {mae.label}
                              </td>
                              {colunasVisiveis.map((label) => (
                                <td key={`${mae.codigo}-${label}`} className="py-1 px-2 text-right text-gray-700 whitespace-nowrap">
                                  {formatCurrency(mae.valores[label] || 0)}
                                </td>
                              ))}
                            </tr>
                            {aberto &&
                              mae.children.map((child) => (
                                <tr key={child.key} className="border-b last:border-b-0">
                                  <td className="py-1 pr-2 whitespace-nowrap text-gray-800" style={{ paddingLeft: '32px' }}>
                                    {child.label}
                                  </td>
                                  {colunasVisiveis.map((label) => {
                                    const valor = child.valores[label] || 0
                                    const ehTotal = label === totalRefLabel || label === totalProjLabel
                                    const podeEditar = editandoTabela && !ehTotal
                                    return (
                                      <td
                                        key={`${child.key}-${label}`}
                                        className="py-1 px-2 text-right text-gray-600 whitespace-nowrap"
                                      >
                                        {podeEditar ? (
                                          <input
                                            type="number"
                                            step="0.01"
                                            className="w-28 text-right border border-gray-300 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                                            value={Number.isFinite(valor) ? valor : 0}
                                            onChange={(e) => {
                                              const parsed = Number(e.target.value)
                                              handleValorEditadoChange(
                                                child.codigo,
                                                label,
                                                Number.isFinite(parsed) ? parsed : 0,
                                              )
                                            }}
                                          />
                                        ) : (
                                          formatCurrency(valor)
                                        )}
                                      </td>
                                    )
                                  })}
                                </tr>
                              ))}
                          </React.Fragment>
                        )
                      })}
                      {planilhaTotalLinha && (
                        <tr className="bg-blue-50 border-t border-blue-200 font-semibold text-blue-900">
                          <td className="py-2 pr-2">{planilhaTotalLinha.categoria}</td>
                          {colunasVisiveis.map((label) => (
                            <td key={`total-${label}`} className="py-2 px-2 text-right">
                              {formatCurrency(planilhaTotalLinha.valores[label] || 0)}
                            </td>
                          ))}
                        </tr>
                      )}
                      {contasMaeExtraordinarias.length > 0 &&
                        contasMaeExtraordinarias.map((mae) => {
                          const aberto = expandidos.has(mae.codigo)
                          return (
                            <React.Fragment key={`extra-${mae.codigo}`}>
                              <tr className="bg-gray-50 text-gray-900 font-semibold border-l-4 border-gray-300">
                                <td className="py-1 pr-2 whitespace-nowrap">
                                  <button
                                    type="button"
                                    onClick={() => toggleContaMae(mae.codigo)}
                                    className="inline-flex items-center justify-center w-5 h-5 mr-2 rounded border border-gray-300 text-gray-700 bg-white/70 hover:bg-white"
                                  >
                                    {aberto ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                                  </button>
                                  {mae.label} <span className="text-xs text-gray-500">(fora do total)</span>
                                </td>
                                {colunasVisiveis.map((label) => (
                                  <td key={`${mae.codigo}-${label}`} className="py-1 px-2 text-right text-gray-700 whitespace-nowrap">
                                    {formatCurrency(mae.valores[label] || 0)}
                                  </td>
                                ))}
                              </tr>
                              {aberto &&
                                mae.children.map((child) => (
                                  <tr key={`extra-${child.key}`} className="border-b last:border-b-0">
                                    <td className="py-1 pr-2 whitespace-nowrap text-gray-800" style={{ paddingLeft: '32px' }}>
                                      {child.label}
                                    </td>
                                    {colunasVisiveis.map((label) => {
                                      const valor = child.valores[label] || 0
                                      return (
                                        <td key={`${child.key}-${label}`} className="py-1 px-2 text-right text-gray-600 whitespace-nowrap">
                                          {formatCurrency(valor)}
                                        </td>
                                      )
                                    })}
                                  </tr>
                                ))}
                            </React.Fragment>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {!loading && resultados.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6 text-center text-sm text-gray-500 shadow-sm">
          Configure os filtros e clique em “Gerar previsão” para carregar os 12 últimos balancetes diretamente da API.
        </div>
      )}

      {mostrarModalIndices && resultados.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={fecharModalIndices} />
          <div className="relative z-10 w-full max-w-5xl bg-white rounded-lg shadow-2xl border border-gray-200 p-0 max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-gray-50">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Índices de reajuste</h3>
                <p className="text-[11px] text-gray-600">Aplique os percentuais nas contas-mãe; vale para todas as subcontas.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fecharModalIndices}
                  className="text-gray-500 hover:text-gray-700 text-lg leading-none px-2"
                  aria-label="Fechar"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="px-6 py-3 border-b bg-white">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-end">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => {
                      const presets = [0, 3, 5, 7, 10]
                      const atual = Number((indicesReajuste['__last__preset__'] ?? '').toString())
                      const idx = Math.max(0, presets.findIndex((p) => p === atual))
                      const next = presets[(idx + 1) % presets.length]
                      const nextStr = String(next)
                      setIndicesReajuste((prev) => {
                        const nextMap: Record<string, string> = { ...prev, __last__preset__: nextStr }
                        contasMaeList.forEach((c) => { nextMap[c.codigo] = nextStr })
                        return nextMap
                      })
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-blue-200 text-blue-700 hover:bg-blue-50"
                    title="Ciclar presets e aplicar em todas as contas (0, 3, 5, 7, 10%)"
                  >
                    Preset ↑
                  </button>
                  {[0, 3, 5, 7, 10].map((p) => (
                    <button
                      key={p}
                      onClick={() => {
                        const v = String(p)
                        setIndicesReajuste((prev) => {
                          const next: Record<string, string> = { ...prev }
                          contasMaeList.forEach((c) => { next[c.codigo] = v })
                          next['__last__preset__'] = v
                          return next
                        })
                      }}
                      className="px-2.5 py-1.5 text-xs font-medium rounded border border-gray-200 hover:bg-gray-50"
                    >
                      {p}%
                    </button>
                  ))}
                  <button
                    onClick={() => {
                      setIndicesReajuste((prev) => {
                        const next: Record<string, string> = { ...prev }
                        contasMaeList.forEach((c) => { next[c.codigo] = '0' })
                        next['__last__preset__'] = '0'
                        return next
                      })
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                    title="Zerar todos os índices"
                  >
                    Zerar todos
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {contasMaeList.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Nenhuma conta-mãe encontrada para este período. Gere novamente a previsão para atualizar os dados.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="font-semibold text-sm text-gray-800 mb-2">Índices de reajuste por conta</div>
                  <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2">
                  {contasMaeList.map((conta) => {
                    const valor = indicesReajuste[conta.codigo] ?? ''
                    const setValor = (v: string) => handleIndiceChange(conta.codigo, v)
                    const step = (inc: number) => {
                      const base = parseFloat(String(valor).replace(',', '.')) || 0
                      const prox = (base + inc)
                      setValor(String(Number.isFinite(prox) ? prox : base))
                    }
                    return (
                      <div
                        key={conta.codigo}
                        className="flex items-center justify-between gap-3 border border-yellow-100 bg-yellow-50/40 rounded px-3 py-2"
                        title={conta.label}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] text-gray-500">{conta.codigo}</div>
                          <div className="text-xs font-medium text-gray-800 truncate">{conta.label}</div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => step(-0.5)}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                            title="-0,5%"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            step="0.01"
                            inputMode="decimal"
                            className="w-24 border border-gray-300 rounded px-2 py-1 text-right text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                            value={valor}
                            onChange={(e) => setValor(e.target.value)}
                            placeholder="0"
                          />
                          <span className="text-xs text-gray-500">%</span>
                          <button
                            onClick={() => step(+0.5)}
                            className="px-2 py-1 text-xs rounded border border-gray-300 hover:bg-gray-50"
                            title="+0,5%"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3 border-t bg-gray-50">
              {monthPairs.length > 0 && (
                <span className="text-xs text-gray-500">
                  1º mês projetado: <strong>{monthPairs[0].projLabel.replace(' (Proj.)', '')}</strong>
                </span>
              )}
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={fecharModalIndices}
                  className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarCalculo}
                  disabled={contasMaeList.length === 0}
                  className="px-4 py-2 text-sm font-medium rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  Calcular previsão
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarModalRateio && (
        <div className="fixed inset-0 z-40 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={fecharModalRateio} />
          <div className="relative z-10 w-full max-w-5xl bg-white rounded-lg shadow-2xl border border-gray-200 p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Rateio mensal por fração ideal</h3>
                <p className="text-xs text-gray-500">
                  O valor projetado do período é dividido por 12 meses e repartido proporcionalmente à fração de cada unidade.
                </p>
              </div>
              <button
                onClick={fecharModalRateio}
                className="text-gray-500 hover:text-gray-700 text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 text-sm">
              <div className="bg-blue-50 border border-blue-100 rounded px-3 py-2">
                <p className="text-[11px] uppercase text-blue-600 tracking-wide">Total projetado</p>
                <p className="text-base font-semibold text-blue-900">{formatCurrency(totalResumoProj)}</p>
              </div>
              <div className="bg-emerald-50 border border-emerald-100 rounded px-3 py-2">
                <p className="text-[11px] uppercase text-emerald-600 tracking-wide">Média mensal (total ÷ 12)</p>
                <p className="text-base font-semibold text-emerald-900">{formatCurrency(mediaMensalRateio)}</p>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2">
                <p className="text-[11px] uppercase text-gray-600 tracking-wide">Unidades consideradas</p>
                <p className="text-base font-semibold text-gray-900">
                  {rateioPorUnidade.length}{' '}
                  <span className="text-xs font-medium text-gray-500">
                    • Soma das frações:{' '}
                    {somaFracoes > 0
                      ? somaFracoes.toLocaleString('pt-BR', { maximumFractionDigits: 6 })
                      : '0'}
                  </span>
                </p>
              </div>
            </div>

            {somaFracoes <= 0 && rateioPorUnidade.length > 0 && (
              <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                Frações não informadas pela API. O rateio foi distribuído igualmente entre as unidades.
              </div>
            )}

            {erroUnidades && (
              <div className="mt-3 flex items-start gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <span>{erroUnidades}</span>
              </div>
            )}

            <div className="mt-4 flex-1 overflow-y-auto border border-gray-100 rounded">
              {loadingUnidades ? (
                <div className="flex items-center justify-center py-8 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Carregando unidades...
                </div>
              ) : rateioPorUnidade.length === 0 ? (
                <div className="py-6 text-center text-sm text-gray-500">
                  Nenhuma unidade encontrada para este condomínio.
                </div>
              ) : (
                <table className="min-w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Unidade</th>
                      <th className="text-right font-medium px-3 py-2">% do condomínio</th>
                      <th className="text-right font-medium px-3 py-2">Valor / mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rateioPorUnidade.map((unidade) => (
                      <tr key={unidade.id} className="border-t border-gray-100">
                        <td className="px-3 py-2 font-medium text-gray-900">{unidade.nome}</td>
                        <td className="px-3 py-2 text-right text-gray-700">
                          {`${unidade.percentual.toLocaleString('pt-BR', {
                            minimumFractionDigits: 4,
                            maximumFractionDigits: 4,
                          })}%`}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                          {formatCurrency(unidade.valorMensal || 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50 font-semibold text-gray-800">
                      <td className="px-3 py-2">Total distribuído</td>
                      <td className="px-3 py-2 text-right">
                        {`${totalPercentualRateio.toLocaleString('pt-BR', {
                          minimumFractionDigits: 4,
                          maximumFractionDigits: 4,
                        })}%`}
                      </td>
                      <td className="px-3 py-2 text-right">{formatCurrency(totalValorMensalRateio)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={fecharModalRateio}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal do Gráfico de Pizza */}
      {mostrarModalGrafico && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMostrarModalGrafico(false)} />
          <div className="relative z-10 w-full max-w-4xl bg-white rounded-lg shadow-2xl border border-gray-200 p-0 max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-4 px-6 py-4 border-b bg-gray-50">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Gráfico de Pizza - Média das Contas-mãe</h3>
                <p className="text-[11px] text-gray-600">Distribuição das médias mensais por conta-mãe</p>
              </div>
              <button
                onClick={() => setMostrarModalGrafico(false)}
                className="text-gray-500 hover:text-gray-700 text-lg leading-none px-2"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {graficoIndicesData.valores.length === 0 || graficoIndicesData.valores.every((v) => v <= 0) ? (
                <div className="text-center py-12">
                  <p className="text-sm text-gray-500">
                    Gere a previsão para visualizar o gráfico com a média das contas-mãe.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="border border-gray-100 rounded p-4">
                    <div className="h-[400px] flex items-center justify-center">
                      <canvas ref={graficoCanvasRef} />
                    </div>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4">
                    <div className="font-semibold text-sm text-gray-800 mb-3">Média das contas-mãe</div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-300">
                            <th className="text-left py-2 px-3 font-semibold text-gray-700">Conta</th>
                            <th className="text-right py-2 px-3 font-semibold text-gray-700">Média Mensal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {graficoIndicesData.labels.map((label, index) => {
                            const valor = graficoIndicesData.valores[index]
                            return (
                              <tr key={`modal-media-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                                <td className="py-2 px-3 text-gray-800">{label}</td>
                                <td className="py-2 px-3 text-right font-medium text-gray-900 tabular-nums">{formatCurrency(valor)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 border-t-2 border-gray-300">
                            <td className="py-2 px-3 font-semibold text-gray-800">Total</td>
                            <td className="py-2 px-3 text-right font-bold text-gray-900 tabular-nums">
                              {formatCurrency(graficoIndicesData.valores.reduce((acc, v) => acc + v, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 flex justify-end border-t bg-gray-50">
              <button
                onClick={() => setMostrarModalGrafico(false)}
                className="px-4 py-2 text-sm font-medium rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}



