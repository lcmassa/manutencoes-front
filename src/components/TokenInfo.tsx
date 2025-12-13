import React, { useState, useMemo, useEffect } from 'react'
import { decodeJWT, formatTimestamp, isTokenExpired, type JWTPayload } from '../utils/jwt'
import { Eye, EyeOff, Copy, CheckCircle2 } from 'lucide-react'

interface TokenInfoProps {
  token: string | null
}

export function TokenInfo({ token }: TokenInfoProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const [now, setNow] = useState(new Date())

  // Atualizar "now" apenas a cada minuto para evitar re-renderizações constantes
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date())
    }, 60000) // Atualizar a cada minuto
    
    return () => clearInterval(interval)
  }, [])

  // Memoizar payload e expired para evitar recálculos desnecessários
  const payload = useMemo(() => {
    if (!token) return null
    return decodeJWT(token)
  }, [token])

  const expired = useMemo(() => {
    if (!token) return false
    return isTokenExpired(token)
  }, [token])

  if (!token) {
    return null
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <span>Token JWT</span>
          {expired && (
            <span className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
              Expirado
            </span>
          )}
          {!expired && payload?.exp && (
            <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs rounded-full">
              Válido
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => copyToClipboard(token)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title="Copiar token completo"
          >
            {copied ? (
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 text-gray-500 hover:text-gray-700"
            title={expanded ? 'Ocultar detalhes' : 'Mostrar detalhes'}
          >
            {expanded ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {expanded && payload && (
        <div className="mt-3 space-y-3">
          {/* Informações principais */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {payload.iat && (
              <div className="col-span-2 bg-blue-50 border border-blue-200 rounded p-2">
                <span className="text-gray-700 font-semibold">📅 Data de Emissão/Atualização:</span>
                <div className="text-gray-900 font-mono mt-1">{formatTimestamp(payload.iat)}</div>
                {payload.iat && (() => {
                  const issuedDate = new Date(payload.iat * 1000)
                  const diffMs = now.getTime() - issuedDate.getTime()
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                  const diffDays = Math.floor(diffHours / 24)
                  
                  let ageText = ''
                  if (diffDays > 0) {
                    ageText = `há ${diffDays} dia(s)`
                  } else if (diffHours > 0) {
                    ageText = `há ${diffHours} hora(s)`
                  } else {
                    const diffMinutes = Math.floor(diffMs / (1000 * 60))
                    ageText = diffMinutes > 0 ? `há ${diffMinutes} minuto(s)` : 'agora'
                  }
                  
                  return (
                    <div className="text-xs text-gray-600 mt-1">
                      Token gerado {ageText}
                    </div>
                  )
                })()}
              </div>
            )}
            {payload.sub && (
              <div>
                <span className="text-gray-500">Subject (sub):</span>
                <div className="font-mono text-gray-900 break-all">{payload.sub}</div>
              </div>
            )}
            {payload.email && (
              <div>
                <span className="text-gray-500">Email:</span>
                <div className="font-mono text-gray-900">{payload.email}</div>
              </div>
            )}
            {payload.name && (
              <div>
                <span className="text-gray-500">Nome:</span>
                <div className="text-gray-900">{payload.name}</div>
              </div>
            )}
            {payload.exp && (
              <div>
                <span className="text-gray-500">Expira em:</span>
                <div className="text-gray-900">{formatTimestamp(payload.exp)}</div>
                {payload.exp && (() => {
                  const expDate = new Date(payload.exp * 1000)
                  const diffMs = expDate.getTime() - now.getTime()
                  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                  const diffDays = Math.floor(diffHours / 24)
                  
                  if (diffMs < 0) {
                    return <div className="text-xs text-red-600 mt-1">⚠️ Expirado</div>
                  } else if (diffDays > 0) {
                    return <div className="text-xs text-gray-600 mt-1">Válido por mais {diffDays} dia(s)</div>
                  } else if (diffHours > 0) {
                    return <div className="text-xs text-yellow-600 mt-1">⚠️ Expira em {diffHours} hora(s)</div>
                  } else {
                    const diffMinutes = Math.floor(diffMs / (1000 * 60))
                    return <div className="text-xs text-red-600 mt-1">⚠️ Expira em {diffMinutes} minuto(s)</div>
                  }
                })()}
              </div>
            )}
          </div>

          {/* Payload completo (JSON formatado) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Payload completo:</span>
              <button
                onClick={() => copyToClipboard(JSON.stringify(payload, null, 2))}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copiar JSON
              </button>
            </div>
            <pre className="bg-gray-900 text-green-400 p-3 rounded text-xs overflow-x-auto max-h-64 overflow-y-auto">
              {JSON.stringify(payload, null, 2)}
            </pre>
          </div>

          {/* Token completo (truncado) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-gray-500">Token completo:</span>
              <button
                onClick={() => copyToClipboard(token)}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Copiar token
              </button>
            </div>
            <div className="bg-gray-900 text-gray-300 p-3 rounded text-xs font-mono break-all max-h-32 overflow-y-auto">
              {token}
            </div>
          </div>
        </div>
      )}

      {expanded && !payload && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
          Não foi possível decodificar o token. Pode não ser um JWT válido.
        </div>
      )}

      {/* Informação sobre atualização do token e tempo restante */}
      {!expanded && payload && (
        <div className="mt-2 space-y-1 text-xs">
          {payload.iat && (
            <div className="text-gray-600">
              <span className="text-gray-500">Atualizado:</span> {formatTimestamp(payload.iat)}
            </div>
          )}
          {payload.exp && (() => {
            const expDate = new Date(payload.exp * 1000)
            const diffMs = expDate.getTime() - now.getTime()
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
            const diffDays = Math.floor(diffHours / 24)
            const diffMinutes = Math.floor(diffMs / (1000 * 60))
            
            if (diffMs < 0) {
              return (
                <div className="text-red-600 font-semibold">
                  ⚠️ Token expirado há {Math.abs(diffDays)} dia(s)
                </div>
              )
            } else if (diffDays > 0) {
              return (
                <div className="text-gray-600">
                  <span className="text-gray-500">Expira em:</span> {diffDays} dia(s) ({formatTimestamp(payload.exp)})
                </div>
              )
            } else if (diffHours > 0) {
              return (
                <div className="text-yellow-600 font-semibold">
                  ⚠️ Expira em {diffHours} hora(s) ({formatTimestamp(payload.exp)})
                </div>
              )
            } else {
              return (
                <div className="text-red-600 font-semibold">
                  ⚠️ Expira em {diffMinutes} minuto(s) ({formatTimestamp(payload.exp)})
                </div>
              )
            }
          })()}
        </div>
      )}
    </div>
  )
}

