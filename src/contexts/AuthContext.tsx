// src/contexts/AuthContext.tsx
// Contexto de autenticação que busca token da licença abimoveis-003
// SEM redirecionamentos automáticos

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import api from '../lib/api'

type Permission = { company_id: string; vertical?: string; platform?: string }
type UserInfo = { 
  email?: string
  name?: string
  picture?: string
  permissions?: Permission[]
}

type AuthState = {
  token: string | null
  user: UserInfo | null
  companyId: string | null
  companies: Array<{ id: string; name: string }>
  loading: boolean
  error: string | null
  setCompanyId: (id: string) => void
  refreshToken: () => Promise<void>
}

const AuthContext = createContext<AuthState | undefined>(undefined)

const LICENCA_ID = 'abimoveis-003' // Formato correto: minúsculas com hífen
// Caminhos do token - usando caminho correto do usuário atual
const TOKEN_FILE_ACTUAL = '/home/luiz-massa/manutencoes/.iap-cli/token.jwt' // PRIORIDADE 1: Onde o token realmente está
const TOKEN_FILE_PRIMARY = '/home/luiz-massa/PROJETOS/iap-apps/.iap-cli/token.jwt' // PRIORIDADE 2: Onde ./iap auth salva
const TOKEN_FILE_LEGACY = '/home/luiz-massa/PROJETOS/.iap-cli/token.jwt' // PRIORIDADE 3: Fallback legado

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [companyId, setCompanyIdState] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Função para buscar token da licença abimoveis-003
  const fetchTokenFromLicense = useCallback(async (): Promise<string | null> => {
    // PRIORIDADE 1: Tentar ler do arquivo token.jwt (mais atualizado, gerado por ./iap auth)
    // O Vite serve este arquivo em /token.jwt ou /.iap-cli/token.jwt
    // Arquivo físico principal: /home/luiz-massa/PROJETOS/iap-apps/.iap-cli/token.jwt (gerado por ./iap auth)
    // Arquivo legado (fallback): /home/luiz-massa/PROJETOS/.iap-cli/token.jwt
    console.log('[AuthContext] ========== BUSCANDO TOKEN ==========')
    console.log('[AuthContext] Tentando ler token do arquivo token.jwt (gerado por ./iap auth)...')
    console.log('[AuthContext] Arquivo físico atual (prioridade): ', TOKEN_FILE_ACTUAL)
    console.log('[AuthContext] Arquivo físico principal: ', TOKEN_FILE_PRIMARY)
    console.log('[AuthContext] Arquivo legado (fallback): ', TOKEN_FILE_LEGACY)
    console.log('[AuthContext] URLs servidas pelo Vite: /token.jwt e /.iap-cli/token.jwt')
    
    const tokenFilePaths = [
      '/.iap-cli/token.jwt', // PRIORIDADE 1: Caminho mais específico
      '/token.jwt', // PRIORIDADE 2: Caminho alternativo
    ]
    
    for (const tokenPath of tokenFilePaths) {
      try {
        console.log(`[AuthContext] Tentando buscar de: ${tokenPath}`)
        // Adicionar timestamp para evitar cache
        const urlWithCacheBust = `${tokenPath}?t=${Date.now()}`
        const response = await fetch(urlWithCacheBust, { 
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        
        console.log(`[AuthContext] Resposta de ${tokenPath}: status ${response.status} ${response.statusText}`)
        
        if (response.ok) {
          const tokenFromFile = (await response.text()).trim()
          console.log(`[AuthContext] Token recebido: ${tokenFromFile.length} caracteres`)
          
          if (tokenFromFile && tokenFromFile.length > 10 && tokenFromFile.includes('.')) {
            // Verificar se é um JWT válido (tem 3 partes separadas por ponto)
            const parts = tokenFromFile.split('.')
            if (parts.length === 3) {
              console.log(`[AuthContext] ✅ Token encontrado em: ${tokenPath}`)
              console.log('[AuthContext] Token (primeiros 30 chars):', tokenFromFile.substring(0, 30) + '...')
              
              // Verificar se o token está expirado ANTES de retornar
              let tokenExpirado = false
              try {
                const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
                if (payload.iat) {
                  const date = new Date(payload.iat * 1000)
                  console.log('[AuthContext] 📅 Token gerado em:', date.toLocaleString('pt-BR'))
                }
                if (payload.exp) {
                  const expDate = new Date(payload.exp * 1000)
                  const now = new Date()
                  if (expDate < now) {
                    console.warn('[AuthContext] ⚠️ Token do arquivo está EXPIRADO!')
                    console.warn('[AuthContext] ⚠️ Execute: ./iap auth para renovar')
                    tokenExpirado = true
                  } else {
                    const diffMs = expDate.getTime() - now.getTime()
                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                    console.log(`[AuthContext] ✅ Token válido por mais ${diffHours}h ${diffMinutes}min`)
                  }
                }
              } catch (e) {
                console.warn('[AuthContext] ⚠️ Erro ao decodificar payload do token (continuando mesmo assim)')
              }
              
              // Se o token está expirado, não retornar - continuar para próximo caminho
              if (tokenExpirado) {
                console.log(`[AuthContext] Ignorando token expirado de ${tokenPath}, tentando próximo caminho...`)
                continue
              }
              
              // IMPORTANTE: Configurar o token na instância da API imediatamente
              api.setToken(tokenFromFile)
              console.log('[AuthContext] ✅ Token configurado na instância da API')
              
              return tokenFromFile
            } else {
              console.warn(`[AuthContext] ⚠️ Token de ${tokenPath} não tem formato JWT válido (${parts.length} partes em vez de 3)`)
            }
          } else {
            console.warn(`[AuthContext] ⚠️ Token de ${tokenPath} está vazio ou muito curto`)
          }
        } else {
          console.log(`[AuthContext] Arquivo não encontrado em ${tokenPath} (status ${response.status})`)
        }
      } catch (e: any) {
        console.warn(`[AuthContext] ⚠️ Erro ao buscar de ${tokenPath}:`, e.message)
        // Continuar para tentar próximo caminho
        continue
      }
    }
    console.error('[AuthContext] ❌ Token não encontrado em nenhum dos caminhos testados')
    console.error('[AuthContext] Caminhos testados:', tokenFilePaths.join(', '))
    console.error('[AuthContext] 💡 Execute: ./iap auth para gerar o token')
    console.error('[AuthContext] 💡 O token será salvo em:', TOKEN_FILE_ACTUAL, 'ou', TOKEN_FILE_PRIMARY)
    
    // PRIORIDADE 2: Tentar buscar da API (endpoint interno)
    console.log('[AuthContext] Tentando buscar token da API...')
    try {
      // Endpoint da API que retorna token para a licença
      // Adicionar cache busting para evitar cache
      const cacheBuster = `?t=${Date.now()}`
      const response = await api.get<{ token: string }>(`/internal/licenses/abimoveis-003/token${cacheBuster}`)
      
      if (response?.data?.token) {
        console.log('[AuthContext] ✅ Token obtido da API com sucesso')
        console.log('[AuthContext] Token (primeiros 30 chars):', response.data.token.substring(0, 30) + '...')
        return response.data.token
      }
      
      console.warn('[AuthContext] ⚠️ Resposta da API não contém token')
    } catch (err: any) {
      console.error('[AuthContext] ❌ Erro ao buscar token da API:', err)
      console.error('[AuthContext] Erro completo:', {
        message: err?.message,
        status: err?.response?.status,
        data: err?.response?.data
      })
      
      // Se o endpoint não existe (404), continuar para fallback
      if (err?.response?.status === 404) {
        console.warn('[AuthContext] ⚠️ Endpoint /internal/licenses/abimoveis-003/token não existe (404)')
      }
    }
    
    // PRIORIDADE 3: Fallback para token do ambiente (pode estar desatualizado)
    const envToken = (import.meta as any).env?.VITE_IAP_TOKEN
    if (envToken && envToken.trim() !== '') {
      console.warn('[AuthContext] ⚠️ Usando token do ambiente (VITE_IAP_TOKEN) - pode estar desatualizado!')
      console.warn('[AuthContext] ⚠️ Para atualizar, execute: ./iap auth')
      console.log('[AuthContext] Token (primeiros 30 chars):', envToken.substring(0, 30) + '...')
      return envToken
    }
    
    console.error('[AuthContext] ❌ Token não encontrado em nenhuma fonte')
    return null
  }, [])

  // Função para carregar informações do usuário
  const loadUserInfo = useCallback(async (token: string) => {
    try {
      console.log('[AuthContext] Carregando informações do usuário...')
      
      // Configurar token no axios
      api.setToken(token)
      
      // Buscar informações do usuário
      const userResponse = await api.get<UserInfo>('/api/user/')
      
      if (userResponse?.data) {
        console.log('[AuthContext] Usuário carregado:', userResponse.data)
        setUser(userResponse.data)
        
        // Configurar companyId - priorizar abimoveis-003
        // A comparação é case-insensitive porque a API pode retornar em diferentes formatos
        const permissions = userResponse.data.permissions || []
        const storedCompanyId = localStorage.getItem('x-company-id')
        
        console.log('[AuthContext] 🔍 Permissões recebidas:', permissions.map(p => ({
          company_id: p.company_id,
          vertical: p.vertical,
          platform: p.platform
        })))
        
        // Comparação case-insensitive para encontrar a permissão do Abimoveis
        const abimoveisPermission = permissions.find(p => 
          p.company_id?.toLowerCase() === LICENCA_ID.toLowerCase()
        )
        
        // Se não encontrou, tentar buscar por "abimoveis-003" (minúsculas) ou "abimoveis=003"
        const abimoveisPermissionAlt = !abimoveisPermission 
          ? permissions.find(p => {
              const id = p.company_id?.toLowerCase() || ''
              return id === 'abimoveis-003' || id === 'abimoveis=003' || id.includes('abimoveis') && id.includes('003')
            })
          : null
        
        const permissionFinal = abimoveisPermission || abimoveisPermissionAlt
        
        // Usar o valor exato retornado pela API se encontrado, senão usar LICENCA_ID
        // Mas garantir que seja "abimoveis-003" (com hífen, não "=")
        let abimoveisCompanyId = permissionFinal?.company_id || LICENCA_ID
        // Normalizar: se contém "=", substituir por "-"
        if (abimoveisCompanyId.includes('=')) {
          abimoveisCompanyId = abimoveisCompanyId.replace(/=/g, '-')
          console.log('[AuthContext] ⚠️ Company ID normalizado de "=" para "-":', abimoveisCompanyId)
        }
        // Garantir formato minúsculas com hífen
        if (abimoveisCompanyId.toLowerCase() === 'abimoveis=003' || abimoveisCompanyId.toLowerCase() === 'abimoveis 003') {
          abimoveisCompanyId = 'abimoveis-003'
          console.log('[AuthContext] ⚠️ Company ID normalizado para formato correto:', abimoveisCompanyId)
        }
        
        let initialCompanyId = 
          permissionFinal ? abimoveisCompanyId :
          (storedCompanyId && permissions.some(p => 
            p.company_id?.toLowerCase() === storedCompanyId.toLowerCase()
          ))
            ? storedCompanyId
            : permissions[0]?.company_id || LICENCA_ID
        
        // Normalizar o initialCompanyId: garantir formato "abimoveis-003" (minúsculas com hífen)
        let finalCompanyId = initialCompanyId
        // Remover espaços, converter para minúsculas, substituir "=" por "-"
        finalCompanyId = finalCompanyId.trim().toLowerCase().replace(/=/g, '-').replace(/\s+/g, '')
        // Se contém "abimoveis" e "003", garantir formato exato "abimoveis-003"
        if (finalCompanyId.includes('abimoveis') && finalCompanyId.includes('003')) {
          finalCompanyId = 'abimoveis-003'
        }
        // Se não contém "abimoveis", usar o LICENCA_ID como fallback
        if (!finalCompanyId.includes('abimoveis')) {
          console.warn('[AuthContext] ⚠️ Company ID não contém "abimoveis", usando LICENCA_ID:', finalCompanyId, '->', LICENCA_ID)
          finalCompanyId = LICENCA_ID
        }
        
        setCompanyIdState(finalCompanyId)
        localStorage.setItem('x-company-id', finalCompanyId)
        console.log('[AuthContext] Company ID configurado:', finalCompanyId)
        if (initialCompanyId !== finalCompanyId) {
          console.log('[AuthContext] Company ID normalizado de:', initialCompanyId, 'para:', finalCompanyId)
        }
      }
    } catch (err: any) {
      console.warn('[AuthContext] Não foi possível carregar usuário:', err)
      // Não falhar - continuar sem dados do usuário
      // Garantir que o companyId está no formato correto
      const companyIdNormalizado = LICENCA_ID.toLowerCase().replace(/=/g, '-')
      setCompanyIdState(companyIdNormalizado)
      localStorage.setItem('x-company-id', companyIdNormalizado)
      console.log('[AuthContext] Company ID configurado (fallback):', companyIdNormalizado)
    }
  }, [])

  // Inicialização da autenticação
  const initializeAuth = useCallback(async () => {
    setLoading(true)
    setError(null)
    
    let mounted = true
    
    // Timeout de segurança: se demorar mais de 30 segundos, parar o loading
    const timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[AuthContext] ⚠️ Timeout na inicialização (30s) - parando loading')
        setLoading(false)
        setError('Timeout ao inicializar autenticação. Verifique sua conexão e tente recarregar a página.')
      }
    }, 30000)
    
    try {
      console.log('[AuthContext] ========== INICIANDO AUTENTICAÇÃO ==========')
      console.log('[AuthContext] Licença:', LICENCA_ID)
      
      // Buscar token da licença abimoveis-003 com timeout
      const tokenPromise = fetchTokenFromLicense()
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 10000) // 10 segundos para buscar token
      })
      
      const fetchedToken = await Promise.race([tokenPromise, timeoutPromise])
      
      if (!mounted) {
        clearTimeout(timeoutId)
        return
      }
      
      if (!fetchedToken) {
        // Se não recebeu token, não redirecionar: apenas marcar erro
        console.error('[AuthContext] Token não encontrado para a licença abimoveis-003')
        clearTimeout(timeoutId)
        setError(`Token não encontrado para a licença abimoveis-003. Execute: ./iap auth e confirme se o arquivo está em ${TOKEN_FILE_ACTUAL} ou ${TOKEN_FILE_PRIMARY}`)
        setLoading(false)
        return
      }
      
      // Token obtido com sucesso
      setTokenState(fetchedToken)
      api.setToken(fetchedToken)
      
      // Carregar informações do usuário com timeout
      try {
        const userInfoPromise = loadUserInfo(fetchedToken)
        const userTimeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => {
            console.warn('[AuthContext] ⚠️ Timeout ao carregar informações do usuário')
            resolve()
          }, 15000) // 15 segundos para carregar usuário
        })
        
        await Promise.race([userInfoPromise, userTimeoutPromise])
      } catch (userErr) {
        console.warn('[AuthContext] ⚠️ Erro ao carregar informações do usuário (continuando mesmo assim):', userErr)
        // Continuar mesmo com erro ao carregar usuário
      }
      
      if (!mounted) {
        clearTimeout(timeoutId)
        return
      }
      
      clearTimeout(timeoutId)
      console.log('[AuthContext] ✅ Autenticação inicializada com sucesso')
      
    } catch (err: any) {
      console.error('[AuthContext] Erro ao inicializar autenticação:', err)
      clearTimeout(timeoutId)
      if (mounted) {
        setError(err?.message || 'Erro desconhecido ao obter token')
        setLoading(false)
      }
    } finally {
      if (mounted) {
        clearTimeout(timeoutId)
        setLoading(false)
      }
    }
    
    return () => {
      mounted = false
      clearTimeout(timeoutId)
    }
  }, [fetchTokenFromLicense, loadUserInfo])

  // Inicializar na montagem
  useEffect(() => {
    initializeAuth()
  }, [initializeAuth])

  // Ref para armazenar o hash do token atual (persiste entre renders)
  const lastTokenHashRef = useRef<string | null>(null)
  const isInitializedRef = useRef<boolean>(false)
  const loadUserInfoRef = useRef(loadUserInfo)

  // Atualizar ref quando loadUserInfo mudar
  useEffect(() => {
    loadUserInfoRef.current = loadUserInfo
  }, [loadUserInfo])

  // Polling para detectar mudanças no arquivo token.jwt
  // Verifica imediatamente e depois a cada 2 segundos se o token foi atualizado
  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null
    let isMounted = true
    let checkCount = 0
    
    // Função para verificar se o token mudou
    const checkTokenUpdate = async () => {
      if (!isMounted) return
      
      checkCount++
      console.log(`[AuthContext] 🔍 Verificação ${checkCount} do token...`)
      
      try {
        // Buscar token do arquivo com cache busting agressivo
        const tokenFilePaths = ['/.iap-cli/token.jwt', '/token.jwt']
        
        for (const tokenPath of tokenFilePaths) {
          try {
            const urlWithCacheBust = `${tokenPath}?t=${Date.now()}&_r=${Math.random()}`
            const response = await fetch(urlWithCacheBust, { 
              cache: 'no-store',
              headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
              }
            })
            
            console.log(`[AuthContext] Resposta de ${tokenPath}: ${response.status} ${response.statusText}`)
            
            if (response.ok) {
              const newToken = (await response.text()).trim()
              
              console.log(`[AuthContext] Token recebido: ${newToken.length} caracteres`)
              
              if (newToken && newToken.length > 10 && newToken.includes('.')) {
                // Criar hash simples do token para comparar
                const newTokenHash = `${newToken.length}-${newToken.substring(0, 20)}-${newToken.substring(newToken.length - 20)}`
                
                // Se é a primeira verificação, armazenar o hash
                if (!isInitializedRef.current) {
                  lastTokenHashRef.current = newTokenHash
                  isInitializedRef.current = true
                  console.log('[AuthContext] 🔍 Polling iniciado - hash inicial armazenado:', newTokenHash.substring(0, 50))
                  
                  // Se não há token inicial mas encontramos um token válido, usar ele
                  if (!token) {
                    console.log('[AuthContext] 🔄 Token encontrado na primeira verificação! Aplicando...')
                    
                    // Verificar se o token não está expirado
                    let tokenValido = true
                    try {
                      const parts = newToken.split('.')
                      if (parts.length === 3) {
                        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
                        if (payload.exp) {
                          const expDate = new Date(payload.exp * 1000)
                          const now = new Date()
                          if (expDate < now) {
                            console.warn('[AuthContext] ⚠️ Token encontrado está expirado')
                            tokenValido = false
                          }
                        }
                      }
                    } catch (e) {
                      console.warn('[AuthContext] ⚠️ Erro ao validar token, continuando mesmo assim...')
                    }
                    
                    if (tokenValido) {
                      // Atualizar token no estado e na API
                      setTokenState(newToken)
                      api.setToken(newToken)
                      
                      // Recarregar informações do usuário
                      try {
                        await loadUserInfoRef.current(newToken)
                        console.log('[AuthContext] ✅ Token aplicado com sucesso!')
                        // Recarregar página para garantir que tudo seja atualizado
                        console.log('[AuthContext] 🔄 Recarregando página após aplicar token inicial...')
                        localStorage.removeItem('x-company-id')
                        sessionStorage.clear()
                        setTimeout(() => {
                          if (isMounted) {
                            window.location.reload()
                          }
                        }, 500)
                      } catch (err) {
                        console.error('[AuthContext] ❌ Erro ao carregar informações do usuário:', err)
                        // Mesmo com erro, recarregar
                        localStorage.removeItem('x-company-id')
                        sessionStorage.clear()
                        setTimeout(() => {
                          if (isMounted) {
                            window.location.reload()
                          }
                        }, 1000)
                      }
                    }
                  }
                  return
                }
                
                // Verificar se o token mudou comparando hash (mais confiável que comparar strings completas)
                const hashMudou = newTokenHash !== lastTokenHashRef.current
                const tokenMudou = token ? newToken !== token : true // Se não há token, considerar que mudou
                
                console.log('[AuthContext] 🔍 Verificando mudança:', {
                  hashMudou,
                  tokenMudou,
                  hashAtual: lastTokenHashRef.current?.substring(0, 50),
                  hashNovo: newTokenHash.substring(0, 50),
                  temTokenAtual: !!token
                })
                
                // Se o token mudou, recarregar
                if (hashMudou || tokenMudou) {
                  if (!isMounted) return
                  
                  console.log('[AuthContext] 🔄 Token atualizado detectado! Aplicando...')
                  console.log('[AuthContext] Token antigo (primeiros 30):', token ? token.substring(0, 30) + '...' : 'NENHUM')
                  console.log('[AuthContext] Token novo (primeiros 30):', newToken.substring(0, 30) + '...')
                  
                  // Verificar se o novo token não está expirado
                  let tokenValido = true
                  try {
                    const parts = newToken.split('.')
                    if (parts.length === 3) {
                      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
                      if (payload.exp) {
                        const expDate = new Date(payload.exp * 1000)
                        const now = new Date()
                        if (expDate < now) {
                          console.warn('[AuthContext] ⚠️ Novo token está expirado, ignorando...')
                          tokenValido = false
                        } else {
                          const diffMs = expDate.getTime() - now.getTime()
                          const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                          console.log(`[AuthContext] ✅ Novo token válido por mais ${diffHours}h`)
                        }
                      }
                    }
                  } catch (e) {
                    console.warn('[AuthContext] ⚠️ Erro ao validar novo token, continuando mesmo assim...')
                  }
                  
                  if (!tokenValido) {
                    return
                  }
                  
                  // Atualizar hash ANTES de atualizar o estado para evitar loops
                  lastTokenHashRef.current = newTokenHash
                  
                  // Atualizar token no estado e na API IMEDIATAMENTE
                  setTokenState(newToken)
                  api.setToken(newToken)
                  
                  // Recarregar informações do usuário com o novo token usando ref
                  try {
                    await loadUserInfoRef.current(newToken)
                    if (isMounted) {
                      console.log('[AuthContext] ✅ Token atualizado e aplicado com sucesso!')
                      // Forçar reload da página para garantir que tudo seja atualizado
                      console.log('[AuthContext] 🔄 Recarregando página para aplicar novo token...')
                      // Limpar cache antes de recarregar
                      localStorage.removeItem('x-company-id')
                      sessionStorage.clear()
                      setTimeout(() => {
                        if (isMounted) {
                          window.location.reload()
                        }
                      }, 500) // Reduzir tempo de espera para 500ms
                    }
                  } catch (err) {
                    console.error('[AuthContext] ❌ Erro ao recarregar informações do usuário:', err)
                    // Mesmo com erro, recarregar a página para tentar novamente
                    localStorage.removeItem('x-company-id')
                    sessionStorage.clear()
                    setTimeout(() => {
                      if (isMounted) {
                        console.log('[AuthContext] 🔄 Recarregando página após erro...')
                        window.location.reload()
                      }
                    }, 1000)
                  }
                }
                
                break
              }
            }
          } catch (e) {
            // Ignorar erros silenciosamente no polling
            continue
          }
        }
      } catch (error) {
        // Ignorar erros no polling para não poluir o console
        console.debug('[AuthContext] Erro no polling (ignorado):', error)
      }
    }
    
    // Verificar IMEDIATAMENTE (não esperar)
    checkTokenUpdate()
    
    // Verificar a cada 2 segundos (mais frequente para detectar mudanças rapidamente)
    intervalId = setInterval(checkTokenUpdate, 2000)
    console.log('[AuthContext] 🔍 Polling de token iniciado (verifica imediatamente e depois a cada 2 segundos)')
    
    return () => {
      isMounted = false
      if (intervalId) clearInterval(intervalId)
      console.log('[AuthContext] 🔍 Polling de token parado')
    }
  }, [token]) // Removido loadUserInfo das dependências para evitar loops

  const setCompanyId = useCallback((id: string) => {
    localStorage.setItem('x-company-id', id)
    setCompanyIdState(id)
    console.log('[AuthContext] Company ID alterado para:', id)
  }, [])

  const refreshToken = useCallback(async () => {
    await initializeAuth()
  }, [initializeAuth])

  const companies = React.useMemo(() => {
    if (!user?.permissions) {
      // Se não tem permissões, retorna a licença padrão
      return [{ id: LICENCA_ID, name: 'Abimóveis (003)' }]
    }
    const ids = Array.from(new Set(user.permissions.map(p => p.company_id).filter(Boolean)))
    return ids.map(id => ({ 
      id, 
      // Comparação case-insensitive para identificar Abimoveis
      name: id?.toLowerCase() === LICENCA_ID.toLowerCase() ? 'Abimóveis (003)' : id 
    }))
  }, [user])

  const value: AuthState = {
    token,
    user,
    companyId,
    companies,
    loading,
    error,
    setCompanyId,
    refreshToken,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider')
  }
  return ctx
}
