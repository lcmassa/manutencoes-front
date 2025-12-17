// src/lib/api.ts
// Wrapper fetch configurado para injetar token automaticamente

const apiUrl = (import.meta as any).env?.VITE_API_URL || 'https://iap-gateway.applications.hml.superlogica.tech'

let currentToken: string | null = null

const setToken = (token: string | null) => {
  currentToken = token
  if (token) {
    console.log('[API] Token configurado')
  } else {
    console.log('[API] Token removido')
  }
}

  // Função para fazer requisições com token automático
const apiRequest = async <T = any>(
  method: string,
  url: string,
  data?: any,
  options?: RequestInit
): Promise<{ data: T; status: number; statusText: string }> => {
  // IMPORTANTE: Separar headers de options primeiro para evitar sobrescrita
  const { headers: optionsHeaders, ...restOptions } = options || {}
  
  // Construir headers base como objeto simples
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  
  // Converter optionsHeaders para objeto simples se necessário
  const optionsHeadersObj: Record<string, string> = {}
  let explicitAuthHeader: string | null = null
  
  if (optionsHeaders) {
    if (optionsHeaders instanceof Headers) {
      // Se for objeto Headers, converter para objeto simples
      optionsHeaders.forEach((value, key) => {
        if (key.toLowerCase() === 'authorization') {
          explicitAuthHeader = value
        } else {
          optionsHeadersObj[key] = value
        }
      })
    } else if (Array.isArray(optionsHeaders)) {
      // Se for array de tuplas [key, value]
      optionsHeaders.forEach(([key, value]) => {
        if (key.toLowerCase() === 'authorization') {
          explicitAuthHeader = value
        } else {
          optionsHeadersObj[key] = value
        }
      })
    } else {
      // Se for objeto simples
      const tempHeaders = optionsHeaders as Record<string, string>
      Object.keys(tempHeaders).forEach(key => {
        if (key.toLowerCase() === 'authorization') {
          explicitAuthHeader = tempHeaders[key]
        } else {
          optionsHeadersObj[key] = tempHeaders[key]
        }
      })
    }
    // Adicionar headers de options (exceto Authorization que será tratado separadamente)
    Object.assign(headers, optionsHeadersObj)
  }

  // Adicionar token se disponível
  // PRIORIDADE: Se Authorization está explícito nas options, usar ele (mais confiável)
  // Caso contrário, usar currentToken se disponível
  let authHeader: string | null = null
  
  if (explicitAuthHeader) {
    // Se Authorization está explícito nas options, usar ele (tem prioridade)
    authHeader = explicitAuthHeader
    console.log(`[API] 🔑 Usando token explícito das options: ${authHeader.substring(0, 30)}...`)
  } else if (currentToken) {
    // Se não há Authorization explícito, usar currentToken
    authHeader = `Bearer ${currentToken}`
    console.log(`[API] 🔑 Usando currentToken: ${currentToken.substring(0, 20)}...`)
  }
  
  // Validar formato do token antes de adicionar
  if (authHeader) {
    // Verificar se o token não está vazio e tem formato válido
    const tokenValue = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader
    if (tokenValue && tokenValue.trim().length > 10) {
      // Garantir que está no formato Bearer
      if (!authHeader.startsWith('Bearer ')) {
        authHeader = `Bearer ${tokenValue}`
      }
      headers['Authorization'] = authHeader
      console.log(`[API] ✅ Token válido configurado no header`)
    } else {
      console.error(`[API] ❌ Token inválido ou muito curto: ${tokenValue ? tokenValue.substring(0, 20) : 'vazio'}...`)
      console.warn(`[API] ⚠️ Requisição será enviada SEM token!`)
    }
  } else {
    console.warn(`[API] ⚠️ Nenhum token disponível!`)
  }

  // Adicionar x-company-id se disponível
  // PRIORIDADE: Se está nas options (explícito), usar ele. Senão, usar do localStorage
  if (optionsHeadersObj['x-company-id']) {
    // Se está nas options, tem prioridade (foi passado explicitamente)
    headers['x-company-id'] = optionsHeadersObj['x-company-id']
    console.log(`[API] ✅ Company ID das options (prioridade): ${optionsHeadersObj['x-company-id']}`)
  } else {
    // Se não está nas options, buscar do localStorage
    const companyId = localStorage.getItem('x-company-id')
    if (companyId) {
      headers['x-company-id'] = companyId
      console.log(`[API] ✅ Company ID do localStorage: ${companyId}`)
    } else {
      console.warn(`[API] ⚠️ Company ID NÃO encontrado no localStorage nem nas options!`)
    }
  }
  
  // Adicionar company-id também (alguns endpoints podem usar este formato)
  if (optionsHeadersObj['company-id']) {
    headers['company-id'] = optionsHeadersObj['company-id']
  } else if (!headers['company-id'] && headers['x-company-id']) {
    headers['company-id'] = headers['x-company-id']
  }

  // Construir URL completa
  // Em desenvolvimento, usar proxy do Vite (gestao.adm/api)
  // Em produção, usar apiUrl completo
  const isDevelopment = window.location.hostname === 'gestao.adm' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  const fullUrl = url.startsWith('http') 
    ? url 
    : isDevelopment && url.startsWith('/api')
    ? url // Usar proxy do Vite em desenvolvimento
    : `${apiUrl}${url}`

  // Adicionar cache busting para requisições GET em desenvolvimento
  let finalUrl = fullUrl
  if (isDevelopment && method === 'GET' && !fullUrl.includes('?t=') && !fullUrl.includes('&t=')) {
    const separator = fullUrl.includes('?') ? '&' : '?'
    finalUrl = `${fullUrl}${separator}_t=${Date.now()}`
  }

  console.log(`[API] ${method} ${finalUrl}`)
  if (currentToken) {
    console.log(`[API] ✅ Token presente: ${currentToken.substring(0, 20)}...`)
    // Verificar se o token está expirado
    try {
      const parts = currentToken.split('.')
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        if (payload.exp) {
          const expDate = new Date(payload.exp * 1000)
          const now = new Date()
          if (expDate < now) {
            console.error(`[API] ❌ Token EXPIRADO! Expira em: ${expDate.toLocaleString('pt-BR')}`)
            console.error(`[API] ❌ Execute: ./iap auth para renovar o token`)
          }
        }
      }
    } catch (e) {
      // Ignorar erro de decodificação
    }
  } else {
    console.warn(`[API] ⚠️ Token NÃO presente!`)
  }

  // Log detalhado dos headers antes de enviar
  console.log(`[API] 📤 Headers sendo enviados:`, {
    'Authorization': headers['Authorization'] ? `${String(headers['Authorization']).substring(0, 30)}...` : 'NÃO PRESENTE',
    'x-company-id': headers['x-company-id'] || 'NÃO PRESENTE',
    'company-id': headers['company-id'] || 'NÃO PRESENTE',
    'Content-Type': headers['Content-Type'] || 'NÃO PRESENTE',
    'Cache-Control': headers['Cache-Control'] || 'NÃO PRESENTE',
  })

  const response = await fetch(finalUrl, {
    method,
    headers: headers, // Usar headers já mesclados acima
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store', // Desabilitar cache do navegador
    ...restOptions, // Outras opções (mas não headers, que já foram separados acima)
  })

  console.log(`[API] Resposta recebida - Status: ${response.status}, OK: ${response.ok}`)

  // Tratar erros 401 sem redirecionar
  if (response.status === 401) {
    console.error('[API] ❌ Erro 401 - Token pode estar expirado')
    // Não redirecionar, apenas retornar erro
  }

  let responseData: T
  const contentType = response.headers.get('content-type') || ''
  console.log(`[API] Content-Type: ${contentType}`)
  
  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json()
      console.log(`[API] ✅ JSON parseado com sucesso`)
      if (Array.isArray(responseData)) {
        console.log(`[API] Array com ${responseData.length} itens`)
      } else if (typeof responseData === 'object' && responseData !== null) {
        console.log(`[API] Objeto com chaves:`, Object.keys(responseData))
      }
    } catch (e) {
      console.error('[API] ❌ Erro ao fazer parse JSON:', e)
      const text = await response.text()
      console.error('[API] Resposta como texto:', text.substring(0, 200))
      throw {
        response: {
          status: response.status,
          statusText: response.statusText,
          data: text,
        },
        message: `Erro ao fazer parse JSON: ${e}`,
      }
    }
  } else {
    const text = await response.text()
    console.log(`[API] Resposta como texto (${text.length} chars)`)
    responseData = text as any
    
    // Verificar se é HTML (página de login)
    if (text.includes('<!DOCTYPE') || text.includes('<html') || (text.includes('login') && text.includes('password'))) {
      console.error('[API] ❌ Resposta HTML detectada (possível página de login)')
      throw {
        response: {
          status: 401,
          statusText: 'Unauthorized',
          data: 'Página de login retornada em vez de JSON',
        },
        message: 'Token de autenticação expirado ou inválido',
      }
    }
  }

  if (!response.ok) {
    console.error(`[API] ❌ Resposta não OK: ${response.status} ${response.statusText}`)
    
    // Tratamento específico para erros temporários (503, 502, 504)
    if (response.status === 503 || response.status === 502 || response.status === 504) {
      console.warn(`[API] ⚠️ Erro temporário do servidor (${response.status}). O serviço pode estar sobrecarregado ou em manutenção.`)
      
      // Tentar retry automático para erros temporários (apenas uma vez)
      const retryCount = (options as any)?._retryCount || 0
      if (retryCount === 0 && method === 'GET') {
        console.log(`[API] 🔄 Tentando retry automático após 2 segundos...`)
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        try {
          const retryResponse = await fetch(finalUrl, {
            method,
            headers: headers,
            body: data ? JSON.stringify(data) : undefined,
            cache: 'no-store',
            ...restOptions,
          })
          
          if (retryResponse.ok) {
            console.log(`[API] ✅ Retry bem-sucedido após erro ${response.status}`)
            const retryContentType = retryResponse.headers.get('content-type') || ''
            let retryData: T
            if (retryContentType.includes('application/json')) {
              retryData = await retryResponse.json()
            } else {
              retryData = await retryResponse.text() as any
            }
            return {
              data: retryData,
              status: retryResponse.status,
              statusText: retryResponse.statusText,
            }
          }
        } catch (retryError) {
          console.error(`[API] ❌ Retry falhou:`, retryError)
        }
      }
    }
    
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'api.ts:227',message:'API response not OK',data:{status:response.status,statusText:response.statusText,url:finalUrl,hasToken:!!currentToken,tokenPrefix:currentToken?currentToken.substring(0,20)+'...':'null',companyId:localStorage.getItem('x-company-id')||'null',responseData:typeof responseData==='string'?responseData.substring(0,500):JSON.stringify(responseData).substring(0,500)},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'J'})}).catch(()=>{});
    // #endregion
    
    // Mensagens de erro mais descritivas
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    if (response.status === 503) {
      errorMessage = `Serviço temporariamente indisponível (503). O servidor pode estar sobrecarregado ou em manutenção. Aguarde alguns instantes e tente novamente.`
    } else if (response.status === 502) {
      errorMessage = `Erro de gateway (502). O servidor intermediário recebeu uma resposta inválida. Tente novamente em alguns instantes.`
    } else if (response.status === 504) {
      errorMessage = `Timeout do gateway (504). O servidor demorou muito para responder. Tente novamente em alguns instantes.`
    }
    
    throw {
      response: {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      },
      message: errorMessage,
    }
  }

  console.log(`[API] ✅ Requisição bem-sucedida`)
  return {
    data: responseData,
    status: response.status,
    statusText: response.statusText,
  }
}

// API object similar ao axios
const api = {
  get: <T = any>(url: string, config?: RequestInit) => apiRequest<T>('GET', url, undefined, config),
  post: <T = any>(url: string, data?: any, config?: RequestInit) => apiRequest<T>('POST', url, data, config),
  put: <T = any>(url: string, data?: any, config?: RequestInit) => apiRequest<T>('PUT', url, data, config),
  delete: <T = any>(url: string, config?: RequestInit) => apiRequest<T>('DELETE', url, undefined, config),
  patch: <T = any>(url: string, data?: any, config?: RequestInit) => apiRequest<T>('PATCH', url, data, config),
  setToken,
  getToken: () => currentToken,
}

export default api

