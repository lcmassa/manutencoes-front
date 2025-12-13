// Utilitário para decodificar JWT

export interface JWTPayload {
  [key: string]: any
  exp?: number
  iat?: number
  sub?: string
  email?: string
  name?: string
}

/**
 * Decodifica um token JWT sem verificar a assinatura
 * @param token Token JWT
 * @returns Payload decodificado ou null se inválido
 */
export function decodeJWT(token: string): JWTPayload | null {
  try {
    // JWT tem 3 partes separadas por ponto: header.payload.signature
    const parts = token.split('.')
    if (parts.length !== 3) {
      console.error('[JWT] Token inválido: não tem 3 partes')
      return null
    }

    // Decodificar payload (segunda parte)
    const payload = parts[1]
    
    // Base64 URL decode
    // Substituir caracteres URL-safe do Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    
    // Adicionar padding se necessário
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4)
    
    // Decodificar
    const decoded = atob(padded)
    
    // Parse JSON
    const parsed = JSON.parse(decoded) as JWTPayload
    
    return parsed
  } catch (error) {
    console.error('[JWT] Erro ao decodificar token:', error)
    return null
  }
}

/**
 * Formata um timestamp Unix para data legível
 */
export function formatTimestamp(timestamp?: number): string {
  if (!timestamp) return 'N/A'
  const date = new Date(timestamp * 1000)
  // Formato: DD/MM/YYYY HH:MM:SS
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`
}

/**
 * Verifica se o token está expirado
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token)
  if (!payload || !payload.exp) return false
  
  const now = Math.floor(Date.now() / 1000)
  return payload.exp < now
}

