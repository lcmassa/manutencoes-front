import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Copy, Check, Link2, Share2 } from 'lucide-react'

export function LinkAcessoDireto() {
  const location = useLocation()
  const [copied, setCopied] = useState(false)

  // Construir URL compartilhável (sem tokens ou informações sensíveis)
  // Este link funciona para qualquer pessoa autorizada
  const getFullUrl = () => {
    // Usar apenas a origem (sem query params ou tokens)
    const baseUrl = window.location.origin
    // Usar apenas o hash da rota (sem informações de sessão)
    const hash = location.hash || '#/'
    // Remover qualquer query string que possa conter tokens
    const cleanHash = hash.split('?')[0]
    return `${baseUrl}${cleanHash}`
  }

  const handleCopy = async () => {
    const url = getFullUrl()
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Fallback para navegadores mais antigos
      const textArea = document.createElement('textarea')
      textArea.value = url
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      } catch (e) {
        console.error('Erro ao copiar:', e)
      }
      document.body.removeChild(textArea)
    }
  }

  const url = getFullUrl()

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex-shrink-0">
          <Share2 className="w-5 h-5 text-blue-600" />
        </div>
        <input
          type="text"
          value={url}
          readOnly
          className="flex-1 px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors cursor-text font-mono"
          onClick={(e) => (e.target as HTMLInputElement).select()}
        />
        <button
          onClick={handleCopy}
          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
            copied
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
          title="Copiar link"
        >
          {copied ? (
            <>
              <Check className="w-4 h-4" />
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" />
              <span>Copiar</span>
            </>
          )}
        </button>
      </div>
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
        <Link2 className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-blue-800">
          <strong>Link compartilhável:</strong> Este link pode ser usado por qualquer pessoa autorizada. 
          A autenticação será solicitada automaticamente ao acessar.
        </p>
      </div>
    </div>
  )
}



