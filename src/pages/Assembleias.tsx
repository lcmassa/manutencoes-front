import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import api from '../lib/api'
import { TokenInfo } from '../components/TokenInfo'

type Assembleia = {
  id: string
  condominio: string
  tipo: 'AGO Normal' | 'AGO com Eleição'
  dataPrevista: string
  dataRealizacao: string // Data de realização (vazio se ainda não foi realizada)
  dataVencimentoMandato: string // Data de vencimento do mandato do síndico
  status: 'agendada' | 'realizada' | 'nao_marcada'
}

export function Assembleias() {
  const { token, companyId } = useAuth()
  const [data, setData] = useState<Assembleia[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState<string>('')
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
        const mes = parseInt(dateParts[1], 10) - 1 // Mês é 0-indexed em Date
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

  const formatarDataParaDDMMYYYY = useCallback((dateString: string | null): string => {
    if (!dateString || dateString.trim() === '') return '-'
    
    // Se já está no formato dd/mm/yyyy, retornar como está
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
      }
      return dateString
    }
    
    const dia = String(date.getDate()).padStart(2, '0')
    const mes = String(date.getMonth() + 1).padStart(2, '0')
    const ano = date.getFullYear()
    return `${dia}/${mes}/${ano}`
  }, [parseDate])

  const carregarAssembleias = useCallback(async () => {
    if (loadingRef.current) return
    if (tokenExpiredRef.current) return

    console.log('[Assembleias] ========== INICIANDO CARREGAMENTO DE ASSEMBLEIAS ==========')
    if (!token) {
      setErro('Token de autenticação não disponível.')
      setLoading(false)
      return
    }

    loadingRef.current = true
    setLoading(true)
    setErro(null)

    const timeoutId = setTimeout(() => {
      if (loadingRef.current) {
        setErro('Timeout: O carregamento demorou muito.')
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
      
      // Buscar todos os condomínios ativos
      console.log('[Assembleias] Buscando condomínios ativos...')
      let todosCondominios: any[] = []
      let paginaCondominios = 1
      let temMaisCondominios = true
      
      try {
        while (temMaisCondominios) {
          try {
            const urlCondominios = `/api/condominios/superlogica/condominios/get?id=-1&somenteCondominiosAtivos=1&ignorarCondominioModelo=1&itensPorPagina=100&pagina=${paginaCondominios}`
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Assembleias.tsx:131',message:'Request condominios - BEFORE',data:{url:urlCondominios,pagina:paginaCondominios,token:token?token.substring(0,20)+'...':'null',companyId:companyId||localStorage.getItem('x-company-id')||'null'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            const responseCondominios = await api.get<any>(urlCondominios)
            
            const dataCondominios = responseCondominios.data
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Assembleias.tsx:134',message:'Request condominios - AFTER success',data:{status:responseCondominios.status,isArray:Array.isArray(dataCondominios),dataKeys:dataCondominios&&typeof dataCondominios==='object'?Object.keys(dataCondominios):[],dataLength:Array.isArray(dataCondominios)?dataCondominios.length:0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
            // #endregion
            // Detectar resposta OK (200) com corpo indicando 401/necessidade de sessão (padrão Superlógica)
            if (
              dataCondominios &&
              typeof dataCondominios === 'object' &&
              (
                dataCondominios.status === '401' ||
                dataCondominios.status === 401 ||
                String(dataCondominios.status || '').includes('401') ||
                /Digite sua senha/i.test(String(dataCondominios.msg || dataCondominios.message || ''))
              )
            ) {
              throw new Error('SESSION_REQUIRED_SUPERLOGICA')
            }
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
            // #region agent log
            fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Assembleias.tsx:167',message:'Request condominios - ERROR',data:{status:err?.response?.status,statusText:err?.response?.statusText,message:err?.message,errorData:err?.response?.data?JSON.stringify(err.response.data).substring(0,500):'N/A',url:urlCondominios,pagina:paginaCondominios},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
            // #endregion
            if (err?.message === 'SESSION_REQUIRED_SUPERLOGICA') {
              setErro(
                'Erro ao carregar condomínios:\n\n' +
                'Acesso não autorizado pelo endpoint.\n\n' +
                'Observação: o token JWT pode estar VÁLIDO, mas este endpoint específico requer sessão (login) e não aceita JWT direto.\n\n' +
                'Alternativas:\n' +
                '• Usar um endpoint do gateway que aceite JWT para listar condomínios/síndicos;\n' +
                '• Configurar um backend intermediário que consuma os serviços legados e exponha via JWT.\n\n' +
                'Verifique o console do navegador (F12) para mais detalhes.'
              )
              setLoading(false)
              loadingRef.current = false
              temMaisCondominios = false
              break
            }
            if (err?.response?.status === 401) {
              tokenExpiredRef.current = true
              throw err
            }
            temMaisCondominios = false
          }
        }
        
        console.log(`[Assembleias] ✅ Total de condomínios encontrados: ${todosCondominios.length}`)
        
        if (todosCondominios.length === 0) {
          setErro('Nenhum condomínio encontrado.')
          setLoading(false)
          loadingRef.current = false
          return
        }
      } catch (err: any) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Assembleias.tsx:199',message:'Outer catch - condominios error',data:{status:err?.response?.status,message:err?.message,errorData:err?.response?.data?JSON.stringify(err.response.data).substring(0,500):'N/A'},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        const errorMsg = err?.response?.status === 422 
          ? `Erro ao carregar condomínios: HTTP ${err.response.status}: ${err?.response?.data?.msg || err?.response?.data?.message || err?.message || 'Unprocessable Entity'}`
          : `Erro ao buscar condomínios: ${err?.message || 'Erro desconhecido'}`
        setErro(errorMsg)
        setLoading(false)
        loadingRef.current = false
        return
      }

      // Estratégia otimizada: calcular diretamente baseado nos síndicos (muito mais rápido)
      // Não buscar assembleias da API - muito lento e desnecessário
      console.log('[Assembleias] Calculando assembleias baseado em mandatos...')
      let assembleias: Assembleia[] = []
      
      // Criar mapa de condomínios para facilitar busca
      const condominiosMap = new Map<string, string>()
      todosCondominios.forEach(c => {
        const id = String(c.id_condominio_cond || c.ID_CONDOMINIO_COND || c.id)
        const nome = c.st_fantasia_cond || c.ST_FANTASIA_COND || c.st_nome_cond || c.nome || 'Sem nome'
        condominiosMap.set(id, nome)
      })
      
      // Buscar síndicos de forma otimizada: apenas primeira página (mais rápido)
      // Como temos apenas 68 condomínios, não precisamos buscar todas as páginas
      try {
        console.log('[Assembleias] Buscando síndicos atuais (primeira página)...')
        const urlSindicos = `/api/condominios/superlogica/sindicos?comStatus=atuais&itensPorPagina=100&pagina=1`
        const responseSindicos = await api.get<any>(urlSindicos)
        
        const dataSindicos = responseSindicos.data
        // Detectar resposta OK (200) com corpo indicando 401/necessidade de sessão (padrão Superlógica)
        if (
          dataSindicos &&
          typeof dataSindicos === 'object' &&
          (
            dataSindicos.status === '401' ||
            dataSindicos.status === 401 ||
            String(dataSindicos.status || '').includes('401') ||
            /Digite sua senha/i.test(String(dataSindicos.msg || dataSindicos.message || ''))
          )
        ) {
          throw new Error('SESSION_REQUIRED_SUPERLOGICA')
        }
        const listaSindicos = Array.isArray(dataSindicos) 
          ? dataSindicos 
          : dataSindicos?.data || dataSindicos?.sindicos || []
        
        console.log(`[Assembleias] ✅ Encontrados ${listaSindicos.length} síndicos na primeira página`)
        
        // Processar síndicos para calcular previsão de assembleias
        // Criar lista de assembleias (não usar Map para permitir múltiplas por condomínio)
        const assembleiasList: Assembleia[] = []
        
        console.log(`[Assembleias] Processando ${listaSindicos.length} síndicos para calcular assembleias...`)
        
        for (const sindico of listaSindicos) {
          const idCondominio = String(sindico.id_condominio_cond || sindico.ID_CONDOMINIO_COND || sindico.id_condominio || '')
          const nomeCondominio = condominiosMap.get(idCondominio) || 
                                 sindico.st_nome_cond || sindico.ST_NOME_COND || 
                                 sindico.condominio || 'Sem nome'
          
          // Buscar data de saída do mandato
          const dataSaida = sindico.dt_saida_sin || sindico.DT_SAIDA_SIN || sindico.data_saida
          
          if (dataSaida && idCondominio) {
            const dataSaidaParseada = parseDate(dataSaida)
            
            if (dataSaidaParseada) {
              const hoje = new Date()
              hoje.setHours(0, 0, 0, 0)
              
              // Calcular AGO Normal: 390 dias antes do vencimento do mandato
              const previsaoAGONormal = new Date(dataSaidaParseada)
              previsaoAGONormal.setDate(previsaoAGONormal.getDate() - 390)
              previsaoAGONormal.setHours(0, 0, 0, 0)
              
              // Calcular AGO com Eleição: 30 dias antes do vencimento do mandato
              const previsaoAGOEleicao = new Date(dataSaidaParseada)
              previsaoAGOEleicao.setDate(previsaoAGOEleicao.getDate() - 30)
              previsaoAGOEleicao.setHours(0, 0, 0, 0)
              
              // Adicionar AGO Normal
              assembleiasList.push({
                id: `ago-normal-${idCondominio}-${sindico.id_sindico_sin || sindico.ID_SINDICO_SIN || Math.random()}`,
                condominio: nomeCondominio,
                tipo: 'AGO Normal',
                dataPrevista: formatarDataParaDDMMYYYY(previsaoAGONormal.toISOString()),
                dataRealizacao: '',
                dataVencimentoMandato: formatarDataParaDDMMYYYY(dataSaidaParseada.toISOString()),
                status: 'nao_marcada'
              })
              
              // Adicionar AGO com Eleição
              assembleiasList.push({
                id: `ago-eleicao-${idCondominio}-${sindico.id_sindico_sin || sindico.ID_SINDICO_SIN || Math.random()}`,
                condominio: nomeCondominio,
                tipo: 'AGO com Eleição',
                dataPrevista: formatarDataParaDDMMYYYY(previsaoAGOEleicao.toISOString()),
                dataRealizacao: '',
                dataVencimentoMandato: formatarDataParaDDMMYYYY(dataSaidaParseada.toISOString()),
                status: 'nao_marcada'
              })
            }
          } else if (!dataSaida && idCondominio) {
            // Síndico sem data de saída (mandato sem prazo definido) - adicionar assembleias genéricas
            assembleiasList.push({
              id: `ago-normal-${idCondominio}-sem-data-${Math.random()}`,
              condominio: nomeCondominio,
              tipo: 'AGO Normal',
              dataPrevista: '-',
              dataRealizacao: '',
              dataVencimentoMandato: '-',
              status: 'nao_marcada'
            })
            
            assembleiasList.push({
              id: `ago-eleicao-${idCondominio}-sem-data-${Math.random()}`,
              condominio: nomeCondominio,
              tipo: 'AGO com Eleição',
              dataPrevista: '-',
              dataRealizacao: '',
              dataVencimentoMandato: '-',
              status: 'nao_marcada'
            })
          }
        }
        
        // Adicionar assembleias à lista principal
        assembleias.push(...assembleiasList)
        console.log(`[Assembleias] Adicionadas ${assembleiasList.length} assembleias`)
        
        // Garantir que TODOS os condomínios apareçam (mesmo sem síndico encontrado)
        console.log(`[Assembleias] Garantindo que todos os ${todosCondominios.length} condomínios apareçam...`)
        
        // Criar set de condomínios que já têm assembleias
        const condominiosComAssembleias = new Set<string>()
        assembleias.forEach(a => {
          // Extrair ID do condomínio do ID da assembleia (formato: ago-normal-{idCondominio}-...)
          const parts = a.id.split('-')
          if (parts.length >= 3) {
            condominiosComAssembleias.add(parts[2])
          }
        })
        
        // Adicionar assembleias para condomínios sem síndico encontrado
        for (const condominio of todosCondominios) {
          const idCondominio = String(condominio.id_condominio_cond || condominio.ID_CONDOMINIO_COND || condominio.id)
          const nomeCondominio = condominio.st_fantasia_cond || condominio.ST_FANTASIA_COND || condominio.st_nome_cond || condominio.nome || 'Sem nome'
          
          if (idCondominio && nomeCondominio !== 'Sem nome' && !condominiosComAssembleias.has(idCondominio)) {
            // Condomínio sem assembleia calculada - adicionar ambas as assembleias sem data
            assembleias.push({
              id: `ago-normal-${idCondominio}-sem-data`,
              condominio: nomeCondominio,
              tipo: 'AGO Normal',
              dataPrevista: '-',
              dataRealizacao: '',
              dataVencimentoMandato: '-',
              status: 'nao_marcada'
            })
            
            assembleias.push({
              id: `ago-eleicao-${idCondominio}-sem-data`,
              condominio: nomeCondominio,
              tipo: 'AGO com Eleição',
              dataPrevista: '-',
              dataRealizacao: '',
              dataVencimentoMandato: '-',
              status: 'nao_marcada'
            })
          }
        }
        
        console.log(`[Assembleias] ✅ Total de ${assembleias.length} assembleias calculadas`)
        
      } catch (err: any) {
        console.error('[Assembleias] Erro ao buscar síndicos:', err)
        if (err?.message === 'SESSION_REQUIRED_SUPERLOGICA') {
          setErro(
            'Erro ao carregar mandatos:\n\n' +
            'Acesso não autorizado pelo endpoint.\n\n' +
            'Observação: o token JWT pode estar VÁLIDO, mas este endpoint específico requer sessão (login) e não aceita JWT direto.\n\n' +
            'Alternativas:\n' +
            '• Usar um endpoint do gateway que aceite JWT para listar condomínios/síndicos;\n' +
            '• Configurar um backend intermediário que consuma os serviços legados e exponha via JWT.\n\n' +
            'Verifique o console do navegador (F12) para mais detalhes.'
          )
          throw err
        }
        if (err?.response?.status === 401) {
          tokenExpiredRef.current = true
          throw err
        }
      }
      
      // Remover fallback lento - não buscar por condomínio individualmente
      // Se não encontrou assembleias suficientes, já criamos para todos os condomínios acima
      
      console.log(`[Assembleias] ✅ Total de assembleias encontradas: ${assembleias.length}`)
      
      // Remover duplicatas: garantir que cada condomínio apareça apenas uma vez por tipo
      // Usar Map com chave composta: condominio-tipo
      const assembleiasUnicas = new Map<string, Assembleia>()
      
      for (const assembleia of assembleias) {
        const chave = `${assembleia.condominio}-${assembleia.tipo}`
        
        // Se já existe, manter a que tem data prevista válida ou a mais recente
        const existente = assembleiasUnicas.get(chave)
        
        if (!existente) {
          assembleiasUnicas.set(chave, assembleia)
        } else {
          // Se a existente não tem data válida e a atual tem, substituir
          const existenteTemData = existente.dataPrevista && existente.dataPrevista !== '-'
          const atualTemData = assembleia.dataPrevista && assembleia.dataPrevista !== '-'
          
          if (!existenteTemData && atualTemData) {
            assembleiasUnicas.set(chave, assembleia)
          } else if (existenteTemData && atualTemData) {
            // Ambas têm data - manter a mais recente (mais próxima do vencimento)
            const dataExistente = parseDate(existente.dataPrevista)
            const dataAtual = parseDate(assembleia.dataPrevista)
            
            if (dataAtual && dataExistente && dataAtual > dataExistente) {
              assembleiasUnicas.set(chave, assembleia)
            }
          }
        }
      }
      
      // Converter de volta para array
      assembleias = Array.from(assembleiasUnicas.values())
      
      console.log(`[Assembleias] ✅ Após remover duplicatas: ${assembleias.length} assembleias únicas`)
      const condominiosUnicos = new Set(assembleias.map(a => a.condominio))
      console.log(`[Assembleias] ✅ Total de condomínios únicos: ${condominiosUnicos.size}`)
      
      // Validar que não há mais de 68 condomínios × 2 tipos = 136 assembleias
      if (condominiosUnicos.size > 68) {
        console.warn(`[Assembleias] ⚠️ ATENÇÃO: Encontrados ${condominiosUnicos.size} condomínios únicos, mas deveria haver no máximo 68!`)
      }
      
      // Ordenar: primeiro por data prevista (crescente), depois por tipo (AGO Normal antes de AGO com Eleição), depois alfabeticamente por condomínio
      const assembleiasOrdenadas = assembleias.sort((a, b) => {
        const dataA = parseDate(a.dataPrevista)
        const dataB = parseDate(b.dataPrevista)
        
        // Se ambas têm data válida, ordenar por data
        if (dataA && dataB) {
          const diffData = dataA.getTime() - dataB.getTime()
          if (diffData !== 0) {
            return diffData // Ordenar por data (mais próxima primeiro)
          }
          // Se mesma data, ordenar por tipo (AGO Normal antes de AGO com Eleição)
          if (a.tipo !== b.tipo) {
            return a.tipo === 'AGO Normal' ? -1 : 1
          }
          // Se mesmo tipo e mesma data, ordenar alfabeticamente por condomínio
          return a.condominio.localeCompare(b.condominio, 'pt-BR', { sensitivity: 'base' })
        }
        
        // Se apenas A tem data, A vem primeiro
        if (dataA && !dataB) {
          return -1
        }
        
        // Se apenas B tem data, B vem primeiro
        if (!dataA && dataB) {
          return 1
        }
        
        // Se nenhum tem data, ordenar por tipo, depois alfabeticamente
        if (a.tipo !== b.tipo) {
          return a.tipo === 'AGO Normal' ? -1 : 1
        }
        return a.condominio.localeCompare(b.condominio, 'pt-BR', { sensitivity: 'base' })
      })
      
      // Aplicar lógica de status baseado na data de realização
      // 'realizada' quando houver data de realização; 'agendada' quando houver data prevista futura; senão 'nao_marcada'
      const assembleiasComStatusCorrigido = assembleiasOrdenadas.map(assembleia => {
        const dataReal = assembleia.dataRealizacao && assembleia.dataRealizacao.trim() !== '' ? parseDate(assembleia.dataRealizacao) : null
        if (dataReal) {
          return { ...assembleia, status: 'realizada' as const }
        }
        const dataPrev = parseDate(assembleia.dataPrevista)
        if (dataPrev) {
          const hoje = new Date()
          hoje.setHours(0, 0, 0, 0)
          if (dataPrev.getTime() >= hoje.getTime()) {
            return { ...assembleia, status: 'agendada' as const }
          }
        }
        return { ...assembleia, status: 'nao_marcada' as const }
      })
      
      setData(assembleiasComStatusCorrigido)
    } catch (e: any) {
      let errorMessage = e?.message || String(e)
      
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        errorMessage = 'Erro de conexão: Não foi possível conectar ao servidor.'
      } else if (errorMessage.includes('Timeout')) {
        errorMessage = 'Timeout: O carregamento demorou muito.'
      } else if (errorMessage.includes('401') || errorMessage.includes('expirado') || errorMessage.includes('expired')) {
        tokenExpiredRef.current = true
        errorMessage = 'Token de autenticação expirado. Para renovar, execute no terminal: ./iap auth\n\nDepois, recarregue a página.'
      } else if (errorMessage.includes('403') || errorMessage.includes('Permissão') || errorMessage.includes('permissão')) {
        errorMessage = 'Acesso negado: Você não tem permissão para acessar este recurso.'
      } else if (errorMessage.includes('404')) {
        errorMessage = 'Recurso não encontrado (404).'
      }
      
      setErro(errorMessage)
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
      loadingRef.current = false
    }
  }, [token, companyId, parseDate, formatarDataParaDDMMYYYY])

  const lastLoadRef = useRef<{ token: string | null; companyId: string | null; timestamp: number }>({ 
    token: null, 
    companyId: null,
    timestamp: 0
  })
  
  useEffect(() => {
    let isMounted = true
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    
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
        
        if (loadingRef.current) {
          return
        }
        
        lastLoadRef.current = { token, companyId, timestamp: Date.now() }
        carregarAssembleias()
      }, 300)
    }
    
    return () => {
      isMounted = false
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId])

  const filteredData = useMemo(() => {
    return data
      .filter(item => {
        const matchesSearch = !searchTerm || 
          item.condominio.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.tipo.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.dataPrevista.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.dataRealizacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.dataVencimentoMandato.toLowerCase().includes(searchTerm.toLowerCase())
        
        return matchesSearch
      })
      // Manter ordenação: primeiro por data, depois alfabeticamente
      .sort((a, b) => {
        const dataA = parseDate(a.dataPrevista)
        const dataB = parseDate(b.dataPrevista)
        
        if (dataA && dataB) {
          const diffData = dataA.getTime() - dataB.getTime()
          if (diffData !== 0) {
            return diffData
          }
          return a.condominio.localeCompare(b.condominio, 'pt-BR', { sensitivity: 'base' })
        }
        
        if (dataA && !dataB) return -1
        if (!dataA && dataB) return 1
        
        return a.condominio.localeCompare(b.condominio, 'pt-BR', { sensitivity: 'base' })
      })
  }, [data, searchTerm, parseDate])

  const formatDate = (dateString: string | null) => {
    if (!dateString || dateString === '-') return '-'
    return dateString
  }
  
  // Paginação
  const initializedFromUrlRef = useRef<boolean>(false)
  const [currentPage, setCurrentPage] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)
  
  // Inicializar estados a partir da URL (querystring)
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      const q = params.get('q')
      const pageParam = parseInt(params.get('page') || '', 10)
      const sizeParam = parseInt(params.get('size') || '', 10)
      
      if (q !== null) {
        setSearchTerm(q)
      }
      if (!isNaN(sizeParam) && [10, 20, 50, 100].includes(sizeParam)) {
        setPageSize(sizeParam)
      }
      if (!isNaN(pageParam) && pageParam >= 1) {
        setCurrentPage(pageParam)
      }
    } catch {
      // Ignorar erros de parsing da URL
    } finally {
      initializedFromUrlRef.current = true
    }
  }, [])
  
  // Resetar para a primeira página ao alterar a busca ou o tamanho da página
  useEffect(() => {
    if (!initializedFromUrlRef.current) return
    setCurrentPage(1)
  }, [searchTerm, pageSize])
  
  // Garantir que currentPage esteja dentro do intervalo quando a lista muda
  useEffect(() => {
    const totalPagesCalc = Math.max(1, Math.ceil(filteredData.length / pageSize))
    if (currentPage > totalPagesCalc) {
      setCurrentPage(totalPagesCalc)
    }
  }, [filteredData.length, pageSize, currentPage])
  
  // Sincronizar a URL com os estados de busca e paginação
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      
      if (searchTerm && searchTerm.trim() !== '') {
        params.set('q', searchTerm)
      } else {
        params.delete('q')
      }
      
      if (currentPage > 1) {
        params.set('page', String(currentPage))
      } else {
        params.delete('page')
      }
      
      if (pageSize !== 20) {
        params.set('size', String(pageSize))
      } else {
        params.delete('size')
      }
      
      const newQuery = params.toString()
      const newUrl = `${window.location.pathname}${newQuery ? `?${newQuery}` : ''}${window.location.hash}`
      window.history.replaceState(null, '', newUrl)
    } catch {
      // Ignorar erros de manipulação da URL
    }
  }, [searchTerm, currentPage, pageSize])
  
  const { paginatedData, totalItems, totalPages, startIndex, endIndex } = useMemo(() => {
    const total = filteredData.length
    const pages = Math.max(1, Math.ceil(total / pageSize))
    const safePage = Math.min(currentPage, pages)
    const start = (safePage - 1) * pageSize
    const end = Math.min(start + pageSize, total)
    return {
      paginatedData: filteredData.slice(start, end),
      totalItems: total,
      totalPages: pages,
      startIndex: start,
      endIndex: end
    }
  }, [filteredData, currentPage, pageSize])

  return (
    <div>
      <TokenInfo token={token} />

      {erro && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm font-semibold mb-2">Erro ao carregar assembleias:</p>
          <p className="text-red-700 text-sm mb-3 whitespace-pre-line">{erro}</p>
          {erro.includes('expirado') || erro.includes('expired') ? (
            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
              <p className="text-yellow-800 text-xs font-semibold mb-1">Como renovar o token:</p>
              <code className="block text-xs bg-gray-100 p-2 rounded mb-2">./iap auth</code>
              <p className="text-yellow-700 text-xs">Execute este comando no terminal e depois recarregue a página.</p>
            </div>
          ) : (
            <p className="text-red-600 text-xs mb-2">Verifique o console do navegador (F12) para mais detalhes.</p>
          )}
          <button
            onClick={() => {
              tokenExpiredRef.current = false
              carregarAssembleias()
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            Tentar novamente
          </button>
        </div>
      )}

      <h1 className="text-xl font-semibold text-gray-800 mb-4">
        Assembleias - Próximas Reuniões
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
            placeholder="Pesquisar por condomínio ou data..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {loading && (
        <div className="mb-4 p-4 text-center">
          <p className="text-gray-600">Carregando assembleias...</p>
        </div>
      )}

      {!loading && !erro && filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          Nenhuma assembleia encontrada.
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
                  TIPO
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  DATA PREVISTA
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  DATA REALIZAÇÃO
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  VENCIMENTO MANDATO
                </th>
                <th className="border-b border-gray-300 px-2 py-1.5 text-left font-semibold text-gray-700 text-xs">
                  STATUS
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((item) => {
                return (
                  <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {item.condominio}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight font-medium">
                      {item.tipo}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {formatDate(item.dataPrevista)}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {item.dataRealizacao || '-'}
                    </td>
                    <td className="px-2 py-1 text-xs text-gray-900 leading-tight">
                      {formatDate(item.dataVencimentoMandato)}
                    </td>
                    <td className="px-2 py-1 text-xs leading-tight">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                        item.status === 'agendada' 
                          ? 'bg-blue-100 text-blue-800' 
                          : item.status === 'realizada'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {item.status === 'agendada' ? 'Agendada' : 
                         item.status === 'realizada' ? 'Realizada' : 
                         'Não Marcada'}
                      </span>
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
          {totalItems > 0 ? (
            <>
              Mostrando {startIndex + 1}–{endIndex} de {totalItems}
            </>
          ) : (
            <>Mostrando 0 resultado(s)</>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600">Linhas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
              className="text-xs border border-gray-300 rounded px-2 py-1"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className={`px-2 py-1 text-xs rounded border ${
                currentPage <= 1 ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Anterior
            </button>
            <span className="text-xs text-gray-600">
              Página {Math.min(currentPage, totalPages)} de {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className={`px-2 py-1 text-xs rounded border ${
                currentPage >= totalPages ? 'text-gray-400 border-gray-200 cursor-not-allowed' : 'text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              Próxima
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

