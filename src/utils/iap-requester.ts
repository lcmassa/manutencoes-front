let httpRequester: ((url: string, init?: RequestInit) => Promise<Response>) | null = null
let requesterReadyResolve: (() => void) | null = null
const requesterReady: Promise<void> = new Promise((resolve) => {
  requesterReadyResolve = resolve
})

export function setHttpRequester(fn: (url: string, init?: RequestInit) => Promise<Response>) {
  httpRequester = fn
  if (requesterReadyResolve) requesterReadyResolve()
}

export async function iapFetch(input: string, init?: RequestInit) {
  if (!httpRequester) {
    await requesterReady
  }
  const headers = new Headers(init?.headers || {})
  const hasXCompany = Array.from(headers.keys()).some(k => k.toLowerCase() === 'x-company-id')
  const hasCompany = Array.from(headers.keys()).some(k => k.toLowerCase() === 'company-id')
  if (!hasXCompany || !hasCompany) {
    const companyId = typeof window !== 'undefined' ? localStorage.getItem('x-company-id') : null
    if (companyId) {
      if (!hasXCompany) headers.set('x-company-id', companyId)
      if (!hasCompany) headers.set('company-id', companyId)
    }
  }
  const finalInit: RequestInit = { ...init, headers }
  
  let response: Response
  try {
    if (httpRequester) {
      response = await httpRequester(input, finalInit)
    } else {
      response = await fetch(input, finalInit)
    }
  } catch (e: any) {
    // Se o erro contém URL de login, bloquear
    const errorMsg = e?.message || String(e) || ''
    if (errorMsg.includes('login') || errorMsg.includes('auth') || errorMsg.includes('superlogica.net')) {
      console.error('[iapFetch] ⚠️ BLOQUEADO: Erro com URL de login detectado:', errorMsg)
      return new Response(JSON.stringify({
        error: 'Unauthorized',
        detail: 'Token de autenticação expirado ou inválido.',
        message: 'Para renovar o token, execute: ./iap auth'
      }), {
        status: 401,
        statusText: 'Unauthorized',
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      })
    }
    throw e
  }
  
  // BLOQUEAR REDIRECIONAMENTOS PARA LOGIN
  const locationHeader = response.headers.get('location')
  if (locationHeader && (
    locationHeader.includes('login') || 
    locationHeader.includes('auth') || 
    locationHeader.includes('superlogica.net/u/') ||
    locationHeader.includes('login-hml.superlogica.net')
  )) {
    console.error('[iapFetch] ⚠️ BLOQUEADO: Header Location com redirecionamento para login:', locationHeader)
    return new Response(JSON.stringify({
      error: 'Unauthorized',
      detail: 'Token de autenticação expirado ou inválido. A API tentou redirecionar para página de login.',
      message: 'Para renovar o token, execute: ./iap auth'
    }), {
      status: 401,
      statusText: 'Unauthorized',
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    })
  }
  
  // BLOQUEAR QUALQUER RESPOSTA HTML - a API nunca deve retornar HTML para endpoints JSON
  const contentType = response.headers.get('content-type') || ''
  const isHtmlContentType = contentType.includes('text/html')
  
  // Se for HTML, ler o conteúdo para confirmar e bloquear
  if (isHtmlContentType || response.status === 401 || response.status === 403) {
    try {
      const text = await response.clone().text()
      const isHtml = isHtmlContentType || 
                    text.trim().startsWith('<!DOCTYPE') ||
                    text.trim().startsWith('<!doctype') ||
                    text.trim().startsWith('<html') ||
                    text.trim().startsWith('<HTML') ||
                    (text.includes('login') && text.includes('password') && text.includes('form'))
      
      if (isHtml) {
        console.error('[iapFetch] ⚠️ BLOQUEADO: Resposta HTML detectada. Token pode ter expirado.')
        console.error('[iapFetch] URL:', input)
        console.error('[iapFetch] Content-Type:', contentType)
        console.error('[iapFetch] Status:', response.status)
        console.error('[iapFetch] Primeiros 300 caracteres:', text.substring(0, 300))
        
        // Retornar uma resposta de erro JSON em vez de HTML
        return new Response(JSON.stringify({
          error: 'Unauthorized',
          detail: 'Token de autenticação expirado ou inválido. A API retornou HTML em vez de JSON.',
          message: 'Para renovar o token, execute: ./iap auth',
          content_type: contentType,
          response_preview: text.substring(0, 200)
        }), {
          status: 401,
          statusText: 'Unauthorized',
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          }
        })
      }
    } catch (e) {
      // Se não conseguir ler o texto, continuar normalmente
      console.warn('[iapFetch] Não foi possível verificar conteúdo da resposta:', e)
    }
  }
  
  return response
}


