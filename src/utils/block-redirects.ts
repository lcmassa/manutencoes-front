// Bloqueador de redirecionamentos automáticos para login
// Este arquivo deve ser importado no main.tsx ANTES de qualquer outro código

// Aguardar DOM estar pronto antes de interceptar
if (typeof window !== 'undefined') {
  const initBlockRedirects = () => {
    try {
      console.log('[BlockRedirects] Inicializando bloqueador de redirecionamentos...')

          // Interceptar window.location.href usando Proxy (mais compatível)
          try {
            // Tentar interceptar apenas se não foi interceptado antes
            if (!(window.location as any).__hrefIntercepted) {
              const originalHrefDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href')
              if (originalHrefDescriptor && originalHrefDescriptor.set) {
                const originalSetter = originalHrefDescriptor.set
                Object.defineProperty(window.location, 'href', {
                  set: function(value: string) {
                    // SEMPRE permitir gestao.adm e localhost (desenvolvimento local)
                    if (typeof value === 'string' && (
                      value.includes('gestao.adm') ||
                      value.includes('localhost') ||
                      value.includes('127.0.0.1') ||
                      value.startsWith('http://gestao.adm') ||
                      value.startsWith('https://gestao.adm') ||
                      value.startsWith('http://localhost') ||
                      value.startsWith('https://localhost')
                    )) {
                      return originalSetter.call(window.location, value)
                    }

                    // Verificar se é redirecionamento para login (apenas URLs externas)
                    const isLoginRedirect =
                      typeof value === 'string' && (
                        value.includes('superlogica.net/u/') ||
                        value.includes('login-hml.superlogica.net') ||
                        value.includes('superlogica.net/u/login') ||
                        value.includes('superlogica.net/u/auth') ||
                        (value.includes('/u/login') && !value.includes('localhost') && !value.includes('gestao.adm')) ||
                        (value.includes('/u/auth') && !value.includes('localhost') && !value.includes('gestao.adm')) ||
                        (value.includes('/login/identifier') && !value.includes('localhost') && !value.includes('gestao.adm'))
                      )

                    if (isLoginRedirect) {
                      console.error('[BlockRedirects] ⚠️ BLOQUEADO: Tentativa de redirecionamento para login:', value)
                      return // Bloquear redirecionamento
                    }

                    return originalSetter.call(window.location, value)
                  },
                  get: originalHrefDescriptor.get,
                  configurable: true,
                  enumerable: true
                })
                ;(window.location as any).__hrefIntercepted = true
              }
            }
          } catch (e) {
            // Ignorar erro silenciosamente - alguns navegadores não permitem interceptação
            // O bloqueio via fetch já cobre a maioria dos casos
          }

          // Interceptar window.location.assign (tentar apenas se não foi interceptado)
          try {
            if (!(window.location as any).__assignIntercepted) {
              const originalAssign = window.location.assign.bind(window.location)
              Object.defineProperty(window.location, 'assign', {
                value: function(url: string) {
                  // SEMPRE permitir gestao.adm e localhost (desenvolvimento local)
                  if (typeof url === 'string' && (
                    url.includes('gestao.adm') ||
                    url.includes('localhost') ||
                    url.includes('127.0.0.1') ||
                    url.startsWith('http://gestao.adm') ||
                    url.startsWith('https://gestao.adm') ||
                    url.startsWith('http://localhost') ||
                    url.startsWith('https://localhost')
                  )) {
                    return originalAssign(url)
                  }

                  // Verificar se é redirecionamento para login (apenas URLs externas)
                  const isLoginRedirect =
                    typeof url === 'string' && (
                      url.includes('superlogica.net/u/') ||
                      url.includes('login-hml.superlogica.net') ||
                      url.includes('superlogica.net/u/login') ||
                      url.includes('superlogica.net/u/auth')
                    )

                  if (isLoginRedirect) {
                    console.error('[BlockRedirects] ⚠️ BLOQUEADO: location.assign para login:', url)
                    return // Bloquear
                  }
                  return originalAssign(url)
                },
                writable: true,
                configurable: true
              })
              ;(window.location as any).__assignIntercepted = true
            }
          } catch (e) {
            // Ignorar erro silenciosamente
          }

          // Interceptar window.location.replace (tentar apenas se não foi interceptado)
          try {
            if (!(window.location as any).__replaceIntercepted) {
              const originalReplace = window.location.replace.bind(window.location)
              Object.defineProperty(window.location, 'replace', {
                value: function(url: string) {
                  // SEMPRE permitir gestao.adm e localhost (desenvolvimento local)
                  if (typeof url === 'string' && (
                    url.includes('gestao.adm') ||
                    url.includes('localhost') ||
                    url.includes('127.0.0.1') ||
                    url.startsWith('http://gestao.adm') ||
                    url.startsWith('https://gestao.adm') ||
                    url.startsWith('http://localhost') ||
                    url.startsWith('https://localhost')
                  )) {
                    return originalReplace(url)
                  }

                  // Verificar se é redirecionamento para login (apenas URLs externas)
                  const isLoginRedirect =
                    typeof url === 'string' && (
                      url.includes('superlogica.net/u/') ||
                      url.includes('login-hml.superlogica.net') ||
                      url.includes('superlogica.net/u/login') ||
                      url.includes('superlogica.net/u/auth')
                    )

                  if (isLoginRedirect) {
                    console.error('[BlockRedirects] ⚠️ BLOQUEADO: location.replace para login:', url)
                    return // Bloquear
                  }
                  return originalReplace(url)
                },
                writable: true,
                configurable: true
              })
              ;(window.location as any).__replaceIntercepted = true
            }
          } catch (e) {
            // Ignorar erro silenciosamente
          }

      // Interceptar fetch para bloquear redirecionamentos em respostas HTTP
      // MAS permitir que requisições normais funcionem
      try {
        const originalFetch = window.fetch
        window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
          // NÃO desabilitar redirect automático - deixar fetch funcionar normalmente
          // Só interceptar se realmente houver redirect para login
          const response = await originalFetch(input, init)
          
          // Verificar status de redirect (3xx) apenas se for realmente para login
          if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location')
            if (location) {
              const isLoginRedirect = 
                location.includes('login-hml.superlogica.net') ||
                location.includes('superlogica.net/u/login') ||
                location.includes('superlogica.net/u/auth')
              
              if (isLoginRedirect) {
                console.error('[BlockRedirects] ⚠️ BLOQUEADO: Resposta HTTP com redirect para login:', location)
                console.error('[BlockRedirects] Status:', response.status)
                console.error('[BlockRedirects] URL da requisição:', input)
                
                // Criar uma resposta de erro em vez de seguir o redirect
                return new Response(JSON.stringify({
                  error: 'Unauthorized',
                  detail: 'Token de autenticação expirado ou inválido. Execute: ./iap auth',
                  message: 'Para renovar o token, execute no terminal: ./iap auth'
                }), {
                  status: 401,
                  statusText: 'Unauthorized',
                  headers: {
                    'Content-Type': 'application/json',
                  }
                })
              }
            }
          }
          
          return response
        }
      } catch (e) {
        console.warn('[BlockRedirects] Não foi possível interceptar fetch:', e)
      }

      // REMOVIDO: Interceptador de cliques genérico
      // Não interceptar cliques normais - apenas bloquear redirecionamentos programáticos
      // O bloqueio de window.location e fetch já cobre os casos necessários

      console.log('[BlockRedirects] ✅ Bloqueador de redirecionamentos ativado')
    } catch (e) {
      console.error('[BlockRedirects] Erro ao inicializar bloqueador:', e)
      // Não quebra a aplicação se houver erro
    }
  }

  // Aguardar DOM estar pronto
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initBlockRedirects)
  } else {
    // DOM já está pronto, executar imediatamente
    initBlockRedirects()
  }
}

