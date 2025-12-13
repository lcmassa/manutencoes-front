// Logger com sanitização de dados sensíveis

const isProduction = import.meta.env.PROD
const isDevelopment = import.meta.env.DEV

/**
 * Campos sensíveis que devem ser sanitizados nos logs
 */
const SENSITIVE_FIELDS = [
  'proprietario',
  'inquilino',
  'cpf',
  'cnpj',
  'email',
  'telefone',
  'token',
  'authorization',
  'password'
]

/**
 * Sanitiza objeto removendo ou mascarando campos sensíveis
 */
function sanitizeForLogging(obj: any, depth: number = 0): any {
  if (depth > 5) {
    return '[Max depth reached]'
  }
  
  if (obj === null || obj === undefined) {
    return obj
  }
  
  if (typeof obj !== 'object') {
    return obj
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeForLogging(item, depth + 1))
  }
  
  const sanitized: any = {}
  
  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase()
    
    // Verificar se é campo sensível
    const isSensitive = SENSITIVE_FIELDS.some(field => keyLower.includes(field))
    
    if (isSensitive) {
      // Mascarar valor sensível
      if (typeof value === 'string' && value.length > 0) {
        sanitized[key] = value.length > 4 
          ? `${value.substring(0, 2)}***${value.substring(value.length - 2)}`
          : '***'
      } else {
        sanitized[key] = '***'
      }
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value, depth + 1)
    } else {
      sanitized[key] = value
    }
  }
  
  return sanitized
}

/**
 * Logger com níveis e sanitização
 */
export const logger = {
  debug: (...args: any[]) => {
    if (isDevelopment) {
      const sanitized = args.map(arg => sanitizeForLogging(arg))
      console.log('[DEBUG]', ...sanitized)
    }
  },
  
  info: (...args: any[]) => {
    const sanitized = args.map(arg => sanitizeForLogging(arg))
    console.log('[INFO]', ...sanitized)
  },
  
  warn: (...args: any[]) => {
    const sanitized = args.map(arg => sanitizeForLogging(arg))
    console.warn('[WARN]', ...sanitized)
  },
  
  error: (...args: any[]) => {
    const sanitized = args.map(arg => sanitizeForLogging(arg))
    console.error('[ERROR]', ...sanitized)
  }
}



