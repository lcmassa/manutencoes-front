import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import path from 'path'
import react from '@vitejs/plugin-react'
import fs from 'fs'

const apiUrl = process.env.VITE_API_URL || 'https://iap-gateway.applications.hml.superlogica.tech'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'iap-debug-login-block',
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          // Servir arquivo token.jwt PRIMEIRO (antes de qualquer outra coisa)
          if (req.url === '/token.jwt' || req.url === '/.iap-cli/token.jwt' || (req.url && req.url.startsWith('/token.jwt')) || (req.url && req.url.startsWith('/.iap-cli/token.jwt'))) {
            try {
              const currentDir = path.dirname(fileURLToPath(import.meta.url))
              // Caminho absoluto correto (prioridade máxima)
              const tokenPathPrimary = '/home/luizmassa/PROJETOS/iap-apps/.iap-cli/token.jwt'
              const tokenPathWorkspaceFallback = '/home/luizmassa/PROJETOS/.iap-cli/token.jwt'
              // Caminho relativo: de apps/manutencoes/front para raiz do projeto
              const tokenPathRelativo = path.resolve(currentDir, '../../../.iap-cli/token.jwt')
              
              const possiblePaths = [
                tokenPathPrimary, // PRIORIDADE 1: token gerado por ./iap auth dentro de iap-apps/.iap-cli
                tokenPathWorkspaceFallback, // PRIORIDADE 2: token eventualmente salvo em /home/luizmassa/PROJETOS/.iap-cli
                tokenPathRelativo, // PRIORIDADE 3: caminho relativo (fallback)
              ]
              
              console.log(`[Vite] Procurando token em:`)
              console.log(`[Vite]   1. ${tokenPathPrimary}`)
              console.log(`[Vite]   2. ${tokenPathWorkspaceFallback}`)
              console.log(`[Vite]   3. ${tokenPathRelativo}`)
              
              let tokenContent: string | null = null
              let tokenPathFound: string | null = null
              
              for (const tokenPath of possiblePaths) {
                console.log(`[Vite] Verificando: ${tokenPath}`)
                if (fs.existsSync(tokenPath)) {
                  try {
                    // IMPORTANTE: Sempre ler do disco diretamente, sem cache
                    // Usar statSync para obter informações de modificação
                    const stats = fs.statSync(tokenPath)
                    tokenContent = fs.readFileSync(tokenPath, 'utf-8').trim()
                    
                    if (tokenContent && tokenContent.length > 10) {
                      tokenPathFound = tokenPath
                      console.log(`[Vite] ✅ Token encontrado e lido com sucesso de: ${tokenPath}`)
                      console.log(`[Vite] Tamanho do token: ${tokenContent.length} caracteres`)
                      console.log(`[Vite] Última modificação: ${stats.mtime.toISOString()}`)
                      break
                    } else {
                      console.warn(`[Vite] ⚠️ Arquivo encontrado mas vazio ou inválido: ${tokenPath}`)
                    }
                  } catch (err: any) {
                    console.error(`[Vite] ❌ Erro ao ler arquivo ${tokenPath}:`, err.message)
                  }
                } else {
                  console.log(`[Vite] Arquivo não existe: ${tokenPath}`)
                }
              }
              
              if (tokenContent && tokenPathFound) {
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                // Headers agressivos para evitar qualquer cache
                res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0, private')
                res.setHeader('Pragma', 'no-cache')
                res.setHeader('Expires', '0')
                res.setHeader('Last-Modified', new Date().toUTCString())
                res.setHeader('ETag', `"${Date.now()}-${Math.random()}"`) // ETag único para cada requisição
                res.end(tokenContent)
                console.log(`[Vite] ✅ Token servido com sucesso para: ${req.url} (sem cache)`)
                return
              } else {
                console.error('[Vite] ❌ Token não encontrado em nenhum caminho testado')
                console.error('[Vite] Caminhos testados:')
                possiblePaths.forEach((p, i) => {
                  console.error(`[Vite]   ${i + 1}. ${p} ${fs.existsSync(p) ? '(existe)' : '(não existe)'}`)
                })
                res.statusCode = 404
                res.setHeader('Content-Type', 'text/plain; charset=utf-8')
                res.end('Token file not found. Execute: ./iap auth')
                return
              }
            } catch (err: any) {
              console.error('[Vite] Erro ao ler token.jwt:', err)
              res.statusCode = 500
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end('Error reading token file')
              return
            }
          }
          
          // Intercepta requisições OPTIONS (preflight) para /api antes do proxy
          if (req.method === 'OPTIONS' && req.url && req.url.startsWith('/api')) {
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH')
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-company-id, company-id, Accept')
            res.setHeader('Access-Control-Max-Age', '86400')
            res.statusCode = 204
            res.end()
            return
          }
          
          // Intercepta requisições /api e faz fetch manual seguindo redirecionamentos
          if (req.url && req.url.startsWith('/api') && req.method !== 'OPTIONS') {
            try {
              const targetUrl = `${apiUrl}${req.url}`
              
              // Log dos headers recebidos
              console.log(`[Proxy] 📥 Requisição recebida: ${req.method} ${req.url}`)
              console.log(`[Proxy] 📥 Headers recebidos:`, {
                'authorization': req.headers['authorization'] ? `${String(req.headers['authorization']).substring(0, 30)}...` : 'NÃO PRESENTE',
                'x-company-id': req.headers['x-company-id'] || 'NÃO PRESENTE',
                'company-id': req.headers['company-id'] || 'NÃO PRESENTE',
                'content-type': req.headers['content-type'] || 'NÃO PRESENTE',
              })
              
              // Prepara headers da requisição
              const headers: Record<string, string> = {}
              
              // Copia headers importantes (verificar tanto lowercase quanto camelCase)
              const authHeader = req.headers['authorization'] || req.headers['Authorization']
              if (authHeader) {
                headers['Authorization'] = String(authHeader)
                console.log(`[Proxy] ✅ Authorization header copiado: ${String(authHeader).substring(0, 30)}...`)
              } else {
                console.error(`[Proxy] ❌ Authorization header NÃO encontrado nos headers recebidos!`)
                console.error(`[Proxy] Todos os headers recebidos:`, Object.keys(req.headers))
              }
              
              if (req.headers['x-company-id']) {
                headers['x-company-id'] = String(req.headers['x-company-id'])
              }
              if (req.headers['company-id']) {
                headers['company-id'] = String(req.headers['company-id'])
              }
              if (req.headers['content-type']) {
                headers['Content-Type'] = String(req.headers['content-type'])
              }
              
              console.log(`[Proxy] 📤 Headers sendo enviados para ${targetUrl}:`, {
                'Authorization': headers['Authorization'] ? `${headers['Authorization'].substring(0, 30)}...` : 'NÃO PRESENTE',
                'x-company-id': headers['x-company-id'] || 'NÃO PRESENTE',
                'company-id': headers['company-id'] || 'NÃO PRESENTE',
              })
              
              // Lê o body da requisição se existir
              let requestBody: Buffer | undefined = undefined
              if (req.method !== 'GET' && req.method !== 'HEAD') {
                const chunks: Buffer[] = []
                await new Promise<void>((resolve) => {
                  req.on('data', (chunk: Buffer) => chunks.push(chunk))
                  req.on('end', () => {
                    if (chunks.length > 0) {
                      requestBody = Buffer.concat(chunks)
                    }
                    resolve()
                  })
                })
              }
              
              // Faz a requisição seguindo redirecionamentos manualmente
              let finalResponse: Response | null = null
              let currentUrl = targetUrl
              let redirectCount = 0
              const maxRedirects = 5
              
              while (redirectCount < maxRedirects) {
                const response = await fetch(currentUrl, {
                  method: req.method || 'GET',
                  headers,
                  body: requestBody,
                  redirect: 'manual', // Seguimos redirecionamentos manualmente
                })
                
                // Se for redirecionamento, verifica se é para página de login
                if (response.status >= 300 && response.status < 400) {
                  const location = response.headers.get('location')
                  if (location) {
                    // SEMPRE permitir redirecionamentos para gestao.adm e localhost (desenvolvimento local)
                    if (location.includes('gestao.adm') || location.includes('localhost') || location.includes('127.0.0.1')) {
                      console.log('[Proxy] Permitindo redirecionamento para:', location)
                      currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href
                      redirectCount++
                      continue
                    }
                    
                    // Se o redirecionamento é para página de login EXTERNA, não seguir e retornar erro 401
                    const isLoginRedirect = 
                      location.includes('superlogica.net/u/') ||
                      location.includes('login-hml.superlogica.net') ||
                      location.includes('superlogica.net/u/login') ||
                      location.includes('superlogica.net/u/auth') ||
                      (location.includes('/u/login') && !location.includes('localhost') && !location.includes('gestao.adm')) ||
                      (location.includes('/u/auth') && !location.includes('localhost') && !location.includes('gestao.adm')) ||
                      (location.includes('/login/identifier') && !location.includes('localhost') && !location.includes('gestao.adm'))
                    
                    if (isLoginRedirect) {
                      console.error('[Proxy] ⚠️ BLOQUEADO: Redirecionamento para página de login detectado:', location)
                      console.error('[Proxy] Token pode ter expirado. Renove com: ./iap auth')
                      console.error('[Proxy] NÃO retornando redirect_url para evitar redirecionamento no navegador')
                      res.statusCode = 401
                      res.setHeader('Content-Type', 'application/json')
                      res.setHeader('Access-Control-Allow-Origin', '*')
                      // NÃO incluir redirect_url - isso pode causar redirecionamento no navegador
                      res.end(JSON.stringify({ 
                        error: 'Unauthorized',
                        detail: 'Token de autenticação expirado ou inválido. A API redirecionou para página de login.',
                        message: 'Para renovar o token, execute: ./iap auth'
                      }))
                      return
                    }
                    
                    console.log('[Proxy] Status', response.status, '- Seguindo redirecionamento para:', location)
                    currentUrl = location.startsWith('http') ? location : new URL(location, currentUrl).href
                    redirectCount++
                    continue
                  }
                }
                
                finalResponse = response
                break
              }
              
              if (!finalResponse) {
                throw new Error('Muitos redirecionamentos ou nenhuma resposta válida')
              }
              
              // Copia status e headers da resposta final
              res.statusCode = finalResponse.status
              
              // Copia todos os headers (exceto alguns problemáticos)
              finalResponse.headers.forEach((value, key) => {
                const lowerKey = key.toLowerCase()
                if (lowerKey !== 'content-encoding' && lowerKey !== 'transfer-encoding' && lowerKey !== 'content-length') {
                  res.setHeader(key, value)
                }
              })
              
              // Adiciona headers CORS
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.setHeader('Access-Control-Allow-Credentials', 'true')
              
              // Copia o body da resposta
              const responseBody = await finalResponse.text()
              
              // BLOQUEAR QUALQUER RESPOSTA HTML - a API nunca deve retornar HTML para endpoints JSON
              const contentType = finalResponse.headers.get('content-type') || ''
              const isHtml = contentType.includes('text/html') || 
                            contentType.includes('text/html;') ||
                            responseBody.trim().startsWith('<!DOCTYPE') ||
                            responseBody.trim().startsWith('<!doctype') ||
                            responseBody.trim().startsWith('<html') ||
                            responseBody.trim().startsWith('<HTML')
              
              if (isHtml) {
                console.error('[Proxy] ⚠️ BLOQUEADO: Resposta HTML detectada (esperado JSON).')
                console.error('[Proxy] Content-Type:', contentType)
                console.error('[Proxy] Primeiros 300 caracteres:', responseBody.substring(0, 300))
                console.error('[Proxy] Token pode ter expirado. Renove com: ./iap auth')
                
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Access-Control-Allow-Credentials', 'true')
                res.end(JSON.stringify({ 
                  error: 'Unauthorized',
                  detail: 'Token de autenticação expirado ou inválido. A API retornou HTML em vez de JSON.',
                  message: 'Para renovar o token, execute: ./iap auth',
                  content_type: contentType,
                  response_preview: responseBody.substring(0, 200)
                }))
                return
              }
              
              // Verificação adicional: se parece com página de login mesmo sem ser HTML explícito
              const isLoginPage = responseBody.includes('login') || 
                                  responseBody.includes('Login') || 
                                  responseBody.includes('superlogica.net/u/login') ||
                                  responseBody.includes('login-hml.superlogica.net') ||
                                  responseBody.includes('superlogica.net/u/auth') ||
                                  (responseBody.includes('email') && responseBody.includes('password') && responseBody.includes('form'))
              
              if (isLoginPage && !responseBody.trim().startsWith('{') && !responseBody.trim().startsWith('[')) {
                console.error('[Proxy] ⚠️ BLOQUEADO: Conteúdo de login detectado na resposta.')
                res.statusCode = 401
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.setHeader('Access-Control-Allow-Credentials', 'true')
                res.end(JSON.stringify({ 
                  error: 'Unauthorized',
                  detail: 'Token de autenticação expirado ou inválido. A API retornou conteúdo de login.',
                  message: 'Para renovar o token, execute: ./iap auth'
                }))
                return
              }
              
              res.setHeader('Content-Length', Buffer.byteLength(responseBody))
              res.end(responseBody)
              return
            } catch (err: any) {
              console.error('[Proxy Middleware] Erro:', err.message)
              if (!res.headersSent) {
                res.statusCode = 500
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.end(JSON.stringify({ error: 'Proxy error', message: err.message }))
              }
              return
            }
          }
          

              if (req.url && req.url.startsWith('/login')) {
                res.statusCode = 200
                res.setHeader('Content-Type', 'text/html; charset=utf-8')
                res.end(`<!doctype html>
    <html>
    <head><meta charset="utf-8"/><title>IAP Debug</title>
    <style>body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,sans-serif;padding:24px;line-height:1.5}code{background:#f4f4f5;padding:2px 6px;border-radius:4px}</style>
    </head>
    <body>
      <h1>Ambiente de Depuração</h1>
      <p>O login via navegador foi bloqueado no modo <strong>debug-front</strong>.</p>
      <p>Inicie o login pelo terminal (fluxo device) executando: <code>./iap auth</code>.</p>
      <p>Após autenticar, recarregue esta página.</p>
    </body>
    </html>`)
                return
              }
              next()
        })
      }
    }
  ],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    host: true, // Permite acesso de qualquer interface de rede
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        secure: false,
        ws: true,
        // O middleware acima já trata requisições /api, então este proxy
        // só é usado para casos não tratados (ex: WebSockets)
        configure: (proxy, _options) => {
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy Error]', err.message)
            if (!res.headersSent) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify({ error: 'Proxy error', message: err.message }))
            }
          })
        },
      },
      '/apps': { target: apiUrl, changeOrigin: true, secure: false, ws: true },
      // Autenticação: garantir que /logout e /callback vão ao gateway (login é bloqueado pelo middleware acima)
      '/logout': { target: apiUrl, changeOrigin: true, secure: false },
      '/callback': { target: apiUrl, changeOrigin: true, secure: false },
    },
  },
})

