import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { Shield, Copy, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'

export function AuthScreen() {
  // useAuth deve ser chamado sempre (regra dos hooks)
  const { refreshToken, error: authError } = useAuth()
  
  const [authCode, setAuthCode] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  // Não verificar token do ambiente - o AuthContext já faz isso
  // Esta tela só aparece quando não há token ou há erro

  const generateAuthUrl = async () => {
    setIsGenerating(true)
    try {
      // Gerar um código único para esta sessão
      const sessionCode = `AUTH-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`
      setAuthCode(sessionCode)
      
      // URL base do gateway
      const gatewayUrl = 'https://iap-gateway.applications.hml.superlogica.tech'
      const authUrl = `${gatewayUrl}/login?redirectTo=${encodeURIComponent(window.location.origin + window.location.pathname + '#/')}&code=${sessionCode}`
      
      // Armazenar código na sessão
      sessionStorage.setItem('auth-code', sessionCode)
      sessionStorage.setItem('auth-url', authUrl)
      
      console.log('[AuthScreen] URL de autenticação gerada:', authUrl)
    } catch (e) {
      console.error('[AuthScreen] Erro ao gerar URL:', e)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const handleContinue = async () => {
    // Tentar renovar o token
    try {
      console.log('[AuthScreen] Tentando renovar token...')
      await refreshToken()
      console.log('[AuthScreen] ✅ Token renovado com sucesso')
    } catch (err) {
      console.error('[AuthScreen] Erro ao renovar token:', err)
    }
    // Recarregar a página após um breve delay para garantir que o novo token seja carregado
    console.log('[AuthScreen] Limpando cache e recarregando página...')
    
    // Limpar TODOS os caches antes de recarregar
    localStorage.clear()
    sessionStorage.clear()
    
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name))
      })
    }
    
    // Recarregar imediatamente após limpar cache
    setTimeout(() => {
      window.location.reload()
    }, 500) // Reduzir tempo de espera
  }

  // Verificar se há código de autenticação na URL (retorno do login)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const code = urlParams.get('code')
    const sessionCode = sessionStorage.getItem('auth-code')
    
    if (code && sessionCode && code === sessionCode) {
      // Login bem-sucedido, recarregar para pegar o novo token
      console.log('[AuthScreen] Código de autenticação confirmado, recarregando...')
      sessionStorage.removeItem('auth-code')
      sessionStorage.removeItem('auth-url')
      window.location.href = window.location.origin + window.location.pathname + '#/'
    }
  }, [])

  // Recuperar URL se já foi gerada
  useEffect(() => {
    const savedUrl = sessionStorage.getItem('auth-url')
    if (savedUrl) {
      const url = new URL(savedUrl)
      const code = url.searchParams.get('code')
      if (code) {
        setAuthCode(code)
      }
    }
  }, [])

  const authUrl = sessionStorage.getItem('auth-url') || ''

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Autenticação Necessária
          </h1>
          <p className="text-gray-600">
            Para continuar usando o sistema, é necessário autenticar-se
          </p>
        </div>

        {authError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-red-800 font-medium mb-1">Erro de Autenticação</p>
                <p className="text-red-700 text-sm">{authError}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Instruções */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              Instruções
            </h2>
            <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
              <li>O sistema tentou buscar o token da licença <strong>abimoveis-003</strong> automaticamente</li>
              <li>Se o token não foi encontrado, verifique se o endpoint <code>/internal/licenses/abimoveis-003/token</code> está configurado</li>
              <li>Alternativamente, execute <code>./iap auth</code> no terminal para autenticar</li>
              <li>O arquivo gerado fica em <code>/home/luiz-massa/PROJETOS/iap-apps/.iap-cli/token.jwt</code> (servido como <code>/.iap-cli/token.jwt</code> pelo Vite)</li>
              <li>Após autenticar, recarregue esta página</li>
              <li>O token será carregado automaticamente da API</li>
            </ol>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h2 className="font-semibold text-gray-900 mb-2">Onde o token é salvo?</h2>
            <p className="text-sm text-gray-700">
              O comando <code>./iap auth</code> grava o JWT em <code>/home/luiz-massa/PROJETOS/iap-apps/.iap-cli/token.jwt</code>. 
              Esse é o arquivo que o frontend espera para carregar automaticamente. Como fallback, ainda é aceito o caminho 
              <code>/home/luiz-massa/PROJETOS/.iap-cli/token.jwt</code>.
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Copie esse arquivo ao mover o app para outro computador ou após renovar o token.
            </p>
          </div>

          {/* Gerar URL */}
          {!authUrl && (
            <div>
              <button
                onClick={generateAuthUrl}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    Gerando URL...
                  </>
                ) : (
                  <>
                    <Shield className="w-5 h-5" />
                    Gerar URL de Autenticação
                  </>
                )}
              </button>
            </div>
          )}

          {/* URL Gerada */}
          {authUrl && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  URL de Autenticação (copie e abra em nova aba):
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={authUrl}
                    readOnly
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(authUrl)}
                    className="px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Copiar URL"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                    ) : (
                      <Copy className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                  <a
                    href={authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Abrir
                  </a>
                </div>
              </div>

              {authCode && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 mb-2">
                    <strong>Código de Autenticação:</strong>
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 px-3 py-2 bg-white border border-yellow-300 rounded text-sm font-mono">
                      {authCode}
                    </code>
                    <button
                      onClick={() => copyToClipboard(authCode)}
                      className="px-3 py-2 bg-yellow-100 border border-yellow-300 rounded hover:bg-yellow-200 transition-colors"
                    >
                      {copied ? (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-yellow-700" />
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-yellow-700 mt-2">
                    Guarde este código. Ele será usado para confirmar sua autenticação.
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleContinue}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Já fiz login, continuar
                </button>
                <button
                  onClick={() => {
                    sessionStorage.removeItem('auth-url')
                    sessionStorage.removeItem('auth-code')
                    setAuthCode('')
                    generateAuthUrl()
                  }}
                  className="px-6 py-3 bg-gray-100 border border-gray-300 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Gerar Nova URL
                </button>
              </div>
            </div>
          )}

          {/* Informações sobre o endpoint da API */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Endpoint da API</h3>
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
              <div className="mb-2 text-gray-400"># O sistema busca token em:</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-blue-400">GET /internal/licenses/abimoveis-003/token</code>
                <button
                  onClick={() => copyToClipboard('/internal/licenses/abimoveis-003/token')}
                  className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="mt-3 text-gray-400 text-xs">
                Certifique-se de que este endpoint está configurado no backend
              </div>
            </div>
          </div>

          {/* Alternativa: Terminal */}
          <div className="border-t border-gray-200 pt-6">
            <h3 className="font-semibold text-gray-900 mb-3">Alternativa: Autenticação via Terminal</h3>
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm">
              <div className="mb-2"># Execute no terminal:</div>
              <div className="flex items-center gap-2">
                <code className="flex-1">./iap auth</code>
                <button
                  onClick={() => copyToClipboard('./iap auth')}
                  className="px-2 py-1 bg-gray-800 rounded hover:bg-gray-700"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
              <div className="mt-3 text-gray-400 text-xs">
                Após executar, clique no botão abaixo para recarregar
              </div>
            </div>
            
            {/* Botão para forçar reload */}
            <div className="mt-4">
              <button
                onClick={() => {
                  console.log('[AuthScreen] 🔄 Recarregando página manualmente...')
                  localStorage.clear()
                  sessionStorage.clear()
                  window.location.reload()
                }}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <RefreshCw className="w-5 h-5" />
                Recarregar Página (F5)
              </button>
              <p className="text-xs text-gray-500 mt-2 text-center">
                Use este botão após executar <code>./iap auth</code> no terminal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

