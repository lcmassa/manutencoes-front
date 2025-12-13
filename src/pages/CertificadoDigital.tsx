import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenInfo } from '../components/TokenInfo'
import { X, Upload, Info } from 'lucide-react'

type CertificadoDigital = {
  id: string
  condominio: string
  nomeResponsavel: string
  fimMandato: string | null
  vencimentoCertificado: string | null
  email: string
  telefone: string
  status: 'valido' | 'vencido' | 'proximo_vencer'
}

export function CertificadoDigital() {
  const { token, companyId } = useAuth()
  const [data, setData] = useState<CertificadoDigital[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [modalAberto, setModalAberto] = useState(false)
  const [condominioSelecionado, setCondominioSelecionado] = useState<string | null>(null)
  const [usarCertificadoAdministradora, setUsarCertificadoAdministradora] = useState(false)
  const [mostrarAjuda, setMostrarAjuda] = useState(false)
  const loadingRef = useRef(false)
  const tokenExpiredRef = useRef(false)

  // Função auxiliar para parse de datas
  const parseDate = useCallback((dateString: string): Date | null => {
    if (!dateString || dateString === '-') return null
    try {
      // Se já está no formato dd/mm/yyyy, parsear diretamente
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString.trim())) {
        const dateParts = dateString.trim().split('/')
        const dia = parseInt(dateParts[0], 10)
        const mes = parseInt(dateParts[1], 10) - 1
        const ano = parseInt(dateParts[2], 10)
        
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null
        if (dia < 1 || dia > 31 || mes < 0 || mes > 11 || ano < 1900 || ano > 2100) return null
        
        return new Date(ano, mes, dia)
      }
      
      // Formato esperado: "01/01/2018 00:00:00" ou "01/01/2018" (DD/MM/YYYY)
      const parts = dateString.trim().split(' ')
      const datePart = parts[0]
      const dateParts = datePart.split('/')
      
      if (dateParts.length === 3) {
        const dia = parseInt(dateParts[0], 10)
        const mes = parseInt(dateParts[1], 10) - 1
        const ano = parseInt(dateParts[2], 10)
        
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

  const carregarCertificados = useCallback(async () => {
    if (loadingRef.current) {
      console.log('[CertificadoDigital] Requisição já em andamento, ignorando...')
      return
    }
    
    if (tokenExpiredRef.current) {
      console.log('[CertificadoDigital] Token expirado detectado anteriormente, ignorando requisição automática...')
      return
    }
    
    console.log('[CertificadoDigital] ========== INICIANDO CARREGAMENTO DE CERTIFICADOS ==========')
    console.log('[CertificadoDigital] Token disponível:', !!token)
    console.log('[CertificadoDigital] Company ID:', companyId)
    
    if (!token) {
      console.error('[CertificadoDigital] ❌ ERRO: Token não disponível!')
      setErro('Token de autenticação não disponível. Aguarde a autenticação ou recarregue a página.')
      setLoading(false)
      loadingRef.current = false
      return
    }
    
    loadingRef.current = true
    setLoading(true)
    setErro(null)
    
    const timeoutId = setTimeout(() => {
      if (loadingRef.current) {
        console.error('[CertificadoDigital] ⚠️ Timeout: Carregamento demorou mais de 5 minutos, cancelando...')
        setErro('Timeout: O carregamento demorou muito. Tente recarregar a página ou verifique sua conexão.')
        setLoading(false)
        loadingRef.current = false
      }
    }, 5 * 60 * 1000)
    
    try {
      // Garantir formato correto: abimoveis-003 (minúsculas com hífen)
      let rawCompanyId = companyId || localStorage.getItem('x-company-id') || 'abimoveis-003'
      rawCompanyId = rawCompanyId.trim().toLowerCase().replace(/=/g, '-').replace(/\s+/g, '')
      if (rawCompanyId.includes('abimoveis') && rawCompanyId.includes('003')) {
        rawCompanyId = 'abimoveis-003'
      }
      const currentCompanyId = rawCompanyId || 'abimoveis-003'
      
      // Função auxiliar para fazer requisição de uma página específica
      const fazerRequisicaoPagina = async (comStatus: string, idCondominio?: string, pagina: number = 1): Promise<{ list: any[], totalPaginas?: number, totalItens?: number }> => {
        if (tokenExpiredRef.current) {
          throw new Error('Token de autenticação expirado ou inválido.')
        }

        const params = new URLSearchParams({
          itensPorPagina: '50',
          pagina: String(pagina),
        })
        
        if (idCondominio) {
          params.append('idCondominio', idCondominio)
        }
        
        if (comStatus && comStatus.trim() !== '') {
          params.append('comStatus', comStatus.trim())
        }
        
        const url = `/api/condominios/superlogica/sindicos?${params.toString()}`
        
        try {
          const response = await api.get<any>(url)
          const responseData = response.data
          
          let list: any[] = []
          let totalPaginas: number | undefined
          let totalItens: number | undefined
          
          if (Array.isArray(responseData)) {
            list = responseData
          } else if (responseData?.data && Array.isArray(responseData.data)) {
            list = responseData.data
            if (responseData.totalPaginas !== undefined) totalPaginas = responseData.totalPaginas
            if (responseData.totalItens !== undefined) totalItens = responseData.totalItens
            if (responseData.total !== undefined) totalItens = responseData.total
          } else if (responseData?.sindicos && Array.isArray(responseData.sindicos)) {
            list = responseData.sindicos
          }
          
          return { list, totalPaginas, totalItens }
        } catch (err: any) {
          const status = err?.response?.status || 500
          if (status === 401) {
            tokenExpiredRef.current = true
            throw new Error(`HTTP ${status}: Token de autenticação expirado ou inválido. Execute: ./iap auth`)
          } else if (status === 422) {
            return { list: [], totalPaginas: 0, totalItens: 0 }
          }
          throw err
        }
      }
      
      // Função para buscar todas as páginas
      const fazerRequisicaoCompleta = async (comStatus: string, idCondominio?: string): Promise<any[]> => {
        if (tokenExpiredRef.current) return []
        
        let todasPaginas: any[] = []
        let paginaAtual = 1
        let temMaisPaginas = true
        
        while (temMaisPaginas && !tokenExpiredRef.current) {
          const resultado = await fazerRequisicaoPagina(comStatus, idCondominio, paginaAtual)
          todasPaginas = todasPaginas.concat(resultado.list)
          
          if (resultado.totalPaginas !== undefined) {
            temMaisPaginas = paginaAtual < resultado.totalPaginas
          } else if (resultado.totalItens !== undefined) {
            const itensPorPagina = 50
            const calculado = Math.ceil(resultado.totalItens / itensPorPagina)
            temMaisPaginas = paginaAtual < calculado
          } else {
            temMaisPaginas = resultado.list.length === 50
          }
          
          if (paginaAtual >= 200 || resultado.list.length === 0) {
            temMaisPaginas = false
          }
          
          paginaAtual++
        }
        
        return todasPaginas
      }
      
      // Buscar SOMENTE condomínios ativos
      console.log('[CertificadoDigital] ========== BUSCANDO SOMENTE CONDOMÍNIOS ATIVOS ==========')
      let todosCondominios: any[] = []
      let paginaCondominios = 1
      let temMaisCondominios = true
      
      try {
        while (temMaisCondominios) {
          try {
            // IMPORTANTE: somenteCondominiosAtivos=1 garante que apenas condomínios ativos sejam retornados
            const urlCondominios = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${paginaCondominios}`
            const responseCondominios = await api.get<any>(urlCondominios)
            
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
              tokenExpiredRef.current = true
              throw err
            }
            temMaisCondominios = false
          }
        }
        
        console.log(`[CertificadoDigital] ✅ Total de condomínios encontrados: ${todosCondominios.length}`)
        
        if (todosCondominios.length === 0) {
          setErro('Nenhum condomínio encontrado.')
          setLoading(false)
          loadingRef.current = false
          return
        }
      } catch (err: any) {
        console.error('[CertificadoDigital] Erro ao buscar condomínios:', err)
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
      
      // Buscar síndicos para cada condomínio
      console.log('[CertificadoDigital] ========== BUSCANDO SÍNDICOS PARA CADA CONDOMÍNIO ==========')
      let todasListas: any[] = []
      
      const condominiosParaProcessar = todosCondominios.slice(0, 100)
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
      
      try {
        const batchSize = 10
        for (let batchStart = 0; batchStart < condominiosParaProcessar.length; batchStart += batchSize) {
          const batch = condominiosParaProcessar.slice(batchStart, batchStart + batchSize)
          
          await Promise.all(batch.map(async (condominio, batchIndex) => {
            const i = batchStart + batchIndex
            const idCondominio = condominio.id_condominio_cond || condominio.ID_CONDOMINIO_COND || condominio.id
            if (!idCondominio) return
            
            if (tokenExpiredRef.current) return
            
            for (const status of ['atuais', 'passado']) {
              try {
                if (status === 'passado') {
                  await delay(20)
                }
                
                const resultados = await fazerRequisicaoCompleta(status, String(idCondominio))
                todasListas = todasListas.concat(resultados)
              } catch (err: any) {
                if (err?.response?.status === 401) {
                  tokenExpiredRef.current = true
                  throw err
                }
              }
            }
          }))
          
          if (batchStart + batchSize < condominiosParaProcessar.length) {
            await delay(20)
          }
        }
        
        console.log(`[CertificadoDigital] ✅ Total de síndicos encontrados: ${todasListas.length}`)
      } catch (err: any) {
        console.error('[CertificadoDigital] Erro ao buscar síndicos:', err)
        if (err?.response?.status === 401) {
          tokenExpiredRef.current = true
          setErro('Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.')
        } else {
          setErro(`Erro ao buscar síndicos: ${err?.message || 'Erro desconhecido'}`)
        }
        setLoading(false)
        loadingRef.current = false
        return
      }
      
      // Mapear dados para CertificadoDigital
      const hoje = new Date()
      hoje.setHours(0, 0, 0, 0)
      
      console.log('[CertificadoDigital] ========== MAPEANDO DADOS ==========')
      console.log('[CertificadoDigital] Total de itens recebidos da API:', todasListas.length)
      
      if (todasListas.length > 0) {
        console.log('[CertificadoDigital] Primeiro item da API (campos disponíveis):', Object.keys(todasListas[0]))
        console.log('[CertificadoDigital] Exemplo de item completo:', todasListas[0])
        
        // Verificar quais campos relacionados a certificado existem
        const primeiroItem = todasListas[0]
        const camposCertificado = Object.keys(primeiroItem).filter(key => 
          key.toLowerCase().includes('cert') || 
          key.toLowerCase().includes('certificado') ||
          key.toLowerCase().includes('vencimento')
        )
        console.log('[CertificadoDigital] Campos relacionados a certificado encontrados:', camposCertificado)
      }
      
      // Formatar datas para dd/mm/yyyy
      const formatarDataParaDDMMYYYY = (dateString: string | null): string => {
        if (!dateString || dateString.trim() === '') return '-'
        
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString.trim())) {
          return dateString.trim()
        }
        
        const date = parseDate(dateString)
        if (!date) {
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
          return dateString
        }
        
        const dia = String(date.getDate()).padStart(2, '0')
        const mes = String(date.getMonth() + 1).padStart(2, '0')
        const ano = date.getFullYear()
        return `${dia}/${mes}/${ano}`
      }
      
      // Filtrar apenas síndicos de condomínios ativos (garantir que o condomínio está na lista de ativos)
      const idsCondominiosAtivos = new Set(todosCondominios.map(c => 
        String(c.id_condominio_cond || c.ID_CONDOMINIO_COND || c.id)
      ))
      
      console.log(`[CertificadoDigital] Total de condomínios ativos: ${idsCondominiosAtivos.size}`)
      
      // Filtrar apenas síndicos de condomínios ativos
      const todasListasFiltradas = todasListas.filter((m: any) => {
        const idCondominio = String(m.id_condominio_cond || m.ID_CONDOMINIO_COND || m.id_condominio || '')
        const estaAtivo = idsCondominiosAtivos.has(idCondominio)
        return estaAtivo
      })
      
      console.log(`[CertificadoDigital] Síndicos antes do filtro de condomínios ativos: ${todasListas.length}`)
      console.log(`[CertificadoDigital] Síndicos após filtro (apenas condomínios ativos): ${todasListasFiltradas.length}`)
      
      const mapped: CertificadoDigital[] = todasListasFiltradas
        .map((m: any) => {
          // Campos relacionados a certificado digital - buscar em várias variações possíveis
          // A API pode retornar em diferentes formatos (minúsculas, maiúsculas, snake_case, etc)
          // IMPORTANTE: NÃO usar dt_saida_sin como fallback - se não encontrar campo específico, mostrar "Não possui"
          const vencimentoCertificadoRaw = 
            m.dt_vencimento_certificado || 
            m.DT_VENCIMENTO_CERTIFICADO || 
            m.dt_vencimento_cert || 
            m.DT_VENCIMENTO_CERT ||
            m.data_vencimento_certificado ||
            m.DATA_VENCIMENTO_CERTIFICADO ||
            m.dt_vencimento_certificado_digital ||
            m.DT_VENCIMENTO_CERTIFICADO_DIGITAL ||
            m.dt_certificado_vencimento ||
            m.DT_CERTIFICADO_VENCIMENTO ||
            // Buscar por qualquer campo que contenha "cert" e "venc"
            (() => {
              const campoEncontrado = Object.keys(m).find(key => 
                key.toLowerCase().includes('cert') && 
                key.toLowerCase().includes('venc') &&
                m[key] && // Campo deve ter valor
                m[key] !== m.dt_saida_sin // Não deve ser o mesmo que fim do mandato
              )
              return campoEncontrado ? m[campoEncontrado] : null
            })() ||
            null // Se não encontrar campo específico, retornar null (será exibido como "Não possui")
          
          // Log para debug do primeiro item
          if (todasListasFiltradas.indexOf(m) === 0) {
            console.log('[CertificadoDigital] Primeiro item - campos de certificado:', {
              dt_vencimento_certificado: m.dt_vencimento_certificado,
              DT_VENCIMENTO_CERTIFICADO: m.DT_VENCIMENTO_CERTIFICADO,
              dt_vencimento_cert: m.dt_vencimento_cert,
              dt_saida_sin: m.dt_saida_sin,
              vencimentoCertificadoRaw_encontrado: vencimentoCertificadoRaw,
              todosOsCampos: Object.keys(m).filter(k => k.toLowerCase().includes('cert') || k.toLowerCase().includes('venc'))
            })
          }
          
          const fimMandatoRaw = m.dt_saida_sin || m.DT_SAIDA_SIN || m.data_saida || null
          
          // Formatar vencimento do certificado: se não houver campo específico, mostrar "Não possui"
          const vencimentoCertificado = vencimentoCertificadoRaw 
            ? formatarDataParaDDMMYYYY(vencimentoCertificadoRaw)
            : 'Não possui'
          
          const fimMandato = formatarDataParaDDMMYYYY(fimMandatoRaw)
          
          // Determinar status do certificado (apenas se houver campo específico)
          let status: 'valido' | 'vencido' | 'proximo_vencer' = 'valido'
          if (vencimentoCertificadoRaw && vencimentoCertificado !== 'Não possui') {
            const vencimentoDate = parseDate(vencimentoCertificadoRaw)
            if (vencimentoDate) {
              const diasAteVencimento = Math.ceil((vencimentoDate.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24))
              if (diasAteVencimento < 0) {
                status = 'vencido'
              } else if (diasAteVencimento <= 60) {
                status = 'proximo_vencer'
              }
            }
          }

          return {
            id: String(m.id_sindico_sin || m.ID_SINDICO_SIN || m.id || Math.random()),
            condominio: m.st_nome_cond || m.ST_NOME_COND || m.condominio || 'Não informado',
            nomeResponsavel: m.st_nome_sin || m.ST_NOME_SIN || m.nome || 'Não informado',
            fimMandato: fimMandato,
            vencimentoCertificado: vencimentoCertificado,
            email: m.st_email_sin || m.ST_EMAIL_SIN || m.email || '',
            telefone: m.st_telefone_sin || m.ST_TELEFONE_SIN || m.telefone || '',
            status,
          }
        })
        // Ordenar: primeiro por vencimento do certificado, depois por condomínio
        .sort((a, b) => {
          // Primeiro critério: vencimento do certificado (crescente - mais próximo primeiro)
          // "Não possui" deve vir por último
          const vencA = a.vencimentoCertificado && a.vencimentoCertificado !== '-' && a.vencimentoCertificado !== 'Não possui' 
            ? parseDate(a.vencimentoCertificado) 
            : null
          const vencB = b.vencimentoCertificado && b.vencimentoCertificado !== '-' && b.vencimentoCertificado !== 'Não possui' 
            ? parseDate(b.vencimentoCertificado) 
            : null
          
          // Se ambos têm vencimento válido, ordenar por data
          if (vencA && vencB) {
            const diff = vencA.getTime() - vencB.getTime()
            if (diff !== 0) return diff
          } else if (vencA && !vencB) {
            // A tem vencimento, B não - A vem primeiro
            return -1
          } else if (!vencA && vencB) {
            // B tem vencimento, A não - B vem primeiro
            return 1
          } else if (!vencA && !vencB) {
            // Ambos não têm vencimento - ordenar por condomínio
            // Continuar para segundo critério
          }
          
          // Segundo critério: condomínio (ordem alfabética)
          return a.condominio.localeCompare(b.condominio, 'pt-BR', { sensitivity: 'base' })
        })
      
      // Remover duplicatas: manter apenas um por condomínio
      // Se houver múltiplos síndicos do mesmo condomínio, manter o que tem certificado mais próximo de vencer
      const condominiosUnicosMap = new Map<string, CertificadoDigital>()
      
      mapped.forEach((certificado) => {
        const nomeCondominioNormalizado = certificado.condominio.trim().toUpperCase()
        const certificadoExistente = condominiosUnicosMap.get(nomeCondominioNormalizado)
        
        if (!certificadoExistente) {
          condominiosUnicosMap.set(nomeCondominioNormalizado, certificado)
        } else {
          // Decidir qual manter: priorizar o que tem certificado válido (não "Não possui")
          const atualTemCertificado = certificado.vencimentoCertificado && 
                                      certificado.vencimentoCertificado !== '-' && 
                                      certificado.vencimentoCertificado !== 'Não possui'
          const existenteTemCertificado = certificadoExistente.vencimentoCertificado && 
                                         certificadoExistente.vencimentoCertificado !== '-' && 
                                         certificadoExistente.vencimentoCertificado !== 'Não possui'
          
          if (atualTemCertificado && !existenteTemCertificado) {
            // Atual tem certificado, existente não - manter atual
            condominiosUnicosMap.set(nomeCondominioNormalizado, certificado)
          } else if (!atualTemCertificado && existenteTemCertificado) {
            // Existente tem certificado, atual não - manter existente
            // Não fazer nada
          } else if (atualTemCertificado && existenteTemCertificado) {
            // Ambos têm certificado - manter o que tem vencimento mais próximo
            const vencExistente = parseDate(certificadoExistente.vencimentoCertificado)
            const vencAtual = parseDate(certificado.vencimentoCertificado)
            
            if (vencAtual && vencExistente) {
              if (vencAtual.getTime() < vencExistente.getTime()) {
                condominiosUnicosMap.set(nomeCondominioNormalizado, certificado)
              }
            } else if (vencAtual && !vencExistente) {
              condominiosUnicosMap.set(nomeCondominioNormalizado, certificado)
            }
          } else {
            // Nenhum tem certificado - manter o primeiro (ou ordenar por fim do mandato)
            // Manter existente (primeiro encontrado)
          }
        }
      })
      
      const certificadosUnicos = Array.from(condominiosUnicosMap.values())
      
      console.log(`[CertificadoDigital] ========== RESULTADO FINAL ==========`)
      console.log(`[CertificadoDigital] Total de itens mapeados: ${mapped.length}`)
      console.log(`[CertificadoDigital] Total de certificados únicos (após remover duplicatas): ${certificadosUnicos.length}`)
      
      if (certificadosUnicos.length > 0) {
        console.log('[CertificadoDigital] Primeiros 3 certificados:', certificadosUnicos.slice(0, 3))
      } else {
        console.warn('[CertificadoDigital] ⚠️ NENHUM CERTIFICADO ENCONTRADO!')
        console.warn('[CertificadoDigital] Verificando possíveis causas:')
        console.warn('[CertificadoDigital] - Total de síndicos recebidos:', todasListas.length)
        console.warn('[CertificadoDigital] - Total de itens mapeados:', mapped.length)
        console.warn('[CertificadoDigital] - Verifique se a API retorna campos de certificado digital')
      }
      
      setData(certificadosUnicos)
    } catch (e: any) {
      let errorMessage = e?.message || String(e)
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Erro de conexão: Não foi possível conectar ao servidor.'
      } else if (errorMessage.includes('Timeout')) {
        errorMessage = 'Timeout: A requisição demorou muito para responder.'
      } else if (errorMessage.includes('401') || errorMessage.includes('expirado')) {
        tokenExpiredRef.current = true
        errorMessage = 'Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.'
      }
      
      setErro(errorMessage)
      console.error('Erro ao carregar certificados:', e)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
      loadingRef.current = false
    }
  }, [token, companyId, parseDate])

  const lastLoadRef = useRef<{ token: string | null; companyId: string | null; timestamp: number }>({ 
    token: null, 
    companyId: null,
    timestamp: 0
  })
  
  useEffect(() => {
    let isMounted = true
    let timeoutId: NodeJS.Timeout | null = null
    
    if (!token) {
      setLoading(false)
      setErro('Token não disponível. Aguarde a autenticação.')
      return
    }
    
    const currentKey = `${token}-${companyId}`
    const lastKey = `${lastLoadRef.current.token}-${lastLoadRef.current.companyId}`
    const timeSinceLastLoad = Date.now() - lastLoadRef.current.timestamp
    
    if (currentKey === lastKey && timeSinceLastLoad < 500) {
      return
    }
    
    if (loadingRef.current) {
      return
    }
    
    if (!tokenExpiredRef.current) {
      timeoutId = setTimeout(() => {
        if (!isMounted) return
        if (loadingRef.current) return
        lastLoadRef.current = { token, companyId, timestamp: Date.now() }
        carregarCertificados()
      }, 300)
    }
    
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId]) // Não incluir carregarCertificados para evitar loops

  const filteredData = useMemo(() => {
    return data
      .filter(item => {
        const matchesSearch = !searchTerm || 
          item.condominio.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.nomeResponsavel.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.email.toLowerCase().includes(searchTerm.toLowerCase())
        
        return matchesSearch
      })
  }, [data, searchTerm])

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === '-') return '-'
    if (dateString === 'Não possui') return 'Não possui'
    return dateString // Já está formatado como dd/mm/yyyy
  }

  const calcularDiasAteVencimento = (vencimento: string | null): number | null => {
    if (!vencimento || vencimento === '-' || vencimento === 'Não possui') return null
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const venc = parseDate(vencimento)
    if (!venc) return null
    venc.setHours(0, 0, 0, 0)
    const diffTime = venc.getTime() - hoje.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const getRowStyle = (item: CertificadoDigital): string => {
    const diasAteVencimento = calcularDiasAteVencimento(item.vencimentoCertificado)
    
    if (diasAteVencimento === null) {
      return 'border-b border-gray-200 hover:bg-gray-50'
    }
    
    if (diasAteVencimento < 0) {
      return 'border-b border-gray-200 bg-red-100 hover:bg-red-200'
    } else if (diasAteVencimento <= 60) {
      return 'border-b border-gray-200 bg-yellow-100 hover:bg-yellow-200'
    }
    
    return 'border-b border-gray-200 hover:bg-gray-50'
  }

  return (
    <div>
      <TokenInfo token={token} />

      {erro && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-semibold mb-2">Erro ao carregar certificados:</p>
          <p className="text-red-700 text-sm mb-3 whitespace-pre-line">{erro}</p>
          {erro.includes('expirado') || erro.includes('expired') ? (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-xs font-semibold mb-1">Como renovar o token:</p>
              <code className="block text-xs bg-gray-100 p-2 rounded mb-2">./iap auth</code>
              <p className="text-yellow-700 text-xs">Execute este comando no terminal e depois recarregue a página.</p>
            </div>
          ) : null}
          <button
            onClick={() => {
              tokenExpiredRef.current = false
              carregarCertificados()
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <h1 className="text-xl font-semibold text-gray-800 mb-4">
        Controle de Vencimento de Certificados Digitais
      </h1>

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

      {loading && (
        <div className="mb-4 p-4 text-center">
          <p className="text-gray-600">Carregando certificados...</p>
        </div>
      )}

      {!loading && !erro && filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhum certificado encontrado.
        </div>
      )}

      {!loading && filteredData.length > 0 && (
        <div className="overflow-x-auto bg-white rounded-lg border border-gray-200">
          <table className="w-full border-collapse text-xs">
            <thead className="bg-gray-50">
              <tr>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  CONDOMÍNIO
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  RESPONSÁVEL
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  FIM DO MANDATO
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  VENCIMENTO DO CERTIFICADO
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredData.map((item) => {
                const diasAteVencimento = calcularDiasAteVencimento(item.vencimentoCertificado)
                
                return (
                  <tr key={item.id} className={getRowStyle(item)}>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {item.condominio}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {item.nomeResponsavel}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {formatDate(item.fimMandato)}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      <div className="flex items-center gap-2">
                        <span>{formatDate(item.vencimentoCertificado)}</span>
                        {item.vencimentoCertificado === 'Não possui' && (
                          <button
                            onClick={() => {
                              setCondominioSelecionado(item.condominio)
                              setModalAberto(true)
                            }}
                            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors flex items-center gap-1"
                            title="Enviar certificado digital A1"
                          >
                            <Upload size={12} />
                            Enviar
                          </button>
                        )}
                        {diasAteVencimento !== null && (
                          <span className="ml-2 text-xs">
                            {diasAteVencimento < 0 
                              ? `(Vencido há ${Math.abs(diasAteVencimento)} dia(s))`
                              : diasAteVencimento <= 60
                              ? `(${diasAteVencimento} dia(s) para vencer)`
                              : ''
                            }
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-gray-600">
          Mostrando {filteredData.length} resultado(s)
        </div>
      </div>

      {/* Modal de Certificado Digital A1 */}
      {modalAberto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header do Modal */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </div>
                <h2 className="text-xl font-semibold text-gray-900">CERTIFICADO DIGITAL A1</h2>
              </div>
              <button
                onClick={() => {
                  setModalAberto(false)
                  setCondominioSelecionado(null)
                  setUsarCertificadoAdministradora(false)
                  setMostrarAjuda(false)
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                title="Fechar"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            {/* Conteúdo do Modal */}
            <div className="p-6 space-y-6">
              {/* Informação do Condomínio */}
              {condominioSelecionado && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Condomínio:</strong> {condominioSelecionado}
                  </p>
                </div>
              )}

              {/* Seção de Ajuda sobre Certificado Digital A1 */}
              <div className="border-2 border-blue-400 rounded-lg p-5 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-md">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-gray-900">
                    Sobre o Certificado Digital A1
                  </h3>
                  <button
                    onClick={() => setMostrarAjuda(!mostrarAjuda)}
                    className="px-4 py-2.5 rounded-lg bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-all text-sm font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 min-w-[180px]"
                    title="Clique para ver informações sobre a utilidade do Certificado Digital A1 para EFD-Reinf"
                  >
                    <Info size={18} className="mr-2" />
                    {mostrarAjuda ? 'Ocultar Ajuda' : 'HELP - Ver Informações'}
                  </button>
                </div>
                {mostrarAjuda && (
                  <div className="mt-3 p-4 bg-white rounded-lg border border-blue-200 space-y-4 text-sm text-gray-700">
                        <div>
                          <p className="mb-2 leading-relaxed">
                            O Certificado Digital A1 é essencial para o condomínio no processo de envio da Escrituração Fiscal Digital de Retenções e Outras Informações Fiscais (EFD-Reinf) através do sistema Superlógica Condomínios.
                          </p>
                        </div>
                        
                        <div className="border-t border-gray-200 pt-3">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base">
                            Importância do Certificado Digital (A1) para a EFD-Reinf
                          </h4>
                          <p className="mb-2 leading-relaxed">
                            A principal função do certificado digital A1 no sistema Superlógica é validar e assinar a transmissão dos dados das retenções para o EFD-Reinf.
                          </p>
                          <p className="leading-relaxed">
                            Ele é um dos elementos cruciais para que a transmissão da EFD-Reinf ocorra, juntamente com outras configurações essenciais de tributação e fornecedores.
                          </p>
                        </div>

                        <div className="border-t border-gray-200 pt-3">
                          <h4 className="font-semibold text-gray-900 mb-2 text-base">
                            Como Inserir o Certificado Digital A1 no Superlógica Condomínios
                          </h4>
                          <p className="mb-2 leading-relaxed">
                            O sistema Superlógica Condomínios permite a utilização do certificado digital A1 da própria administradora (com procuração) ou do próprio condomínio. É importante notar que não é permitido usar um certificado com CNPJ diferente do configurado para o condomínio ou administradora.
                          </p>
                          
                          <div className="mt-3 bg-gray-50 p-3 rounded">
                            <h5 className="font-medium text-gray-900 mb-2">
                              Inserindo o Certificado Digital do Condomínio:
                            </h5>
                            <p className="mb-2 text-sm">
                              Para inserir o Certificado Digital A1 do condomínio no sistema Superlógica, siga os passos abaixo:
                            </p>
                            <ol className="list-decimal list-inside space-y-1.5 ml-2 text-sm">
                              <li>Acesse Condomínio &gt; Dados do condomínio.</li>
                              <li>No canto inferior direito da tela, clique em 'Certificado Digital A1'.</li>
                              <li>Em seguida, clique em 'Enviar certificado'.</li>
                              <li>Selecione o arquivo do certificado armazenado em seu computador.</li>
                              <li>Informe a senha do certificado e clique em 'Enviar' para finalizar.</li>
                            </ol>
                            <p className="mt-3 text-xs text-gray-600 italic">
                              <strong>Alternativa:</strong> Você também pode inserir o certificado do condomínio através de Despesas &gt; EFD-Reinf, passando o mouse sobre o condomínio desejado e clicando em 'Adicionar certificado'.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
              </div>

              {/* Botão Enviar Certificado */}
              <div>
                <button
                  onClick={() => {
                    // Aqui você pode adicionar lógica para upload do certificado
                    alert('Funcionalidade de upload será implementada. Condomínio: ' + condominioSelecionado)
                  }}
                  className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center justify-center gap-2"
                >
                  <Upload size={20} />
                  Enviar certificado
                </button>
              </div>

              {/* Caixa de Informação */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Info size={20} className="text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-blue-900">
                    Você ainda não enviou um certificado A1 do condomínio.
                  </p>
                </div>
              </div>

              {/* Checkbox EFD-Reinf */}
              <div className="border border-gray-200 rounded-lg p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={usarCertificadoAdministradora}
                    onChange={(e) => setUsarCertificadoAdministradora(e.target.checked)}
                    className="mt-1 w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-900">
                        Usar o certificado da administradora para transmissão da EFD-Reinf?
                      </span>
                      <button
                        className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300 transition-colors"
                        title="Mais informações sobre EFD-Reinf"
                        onClick={(e) => {
                          e.preventDefault()
                          alert('EFD-Reinf é a Escrituração Fiscal Digital de Retenções na Fonte e outras Informações Fiscais.')
                        }}
                      >
                        <span className="text-xs text-gray-600">?</span>
                      </button>
                    </div>
                  </div>
                </label>
              </div>

              {/* Botões de Ação */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setModalAberto(false)
                    setCondominioSelecionado(null)
                    setUsarCertificadoAdministradora(false)
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    // Aqui você pode adicionar lógica para salvar as configurações
                    alert('Configurações salvas para: ' + condominioSelecionado)
                    setModalAberto(false)
                    setCondominioSelecionado(null)
                    setUsarCertificadoAdministradora(false)
                  }}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

