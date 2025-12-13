import '@testing-library/jest-dom'

// Silencia warnings de future flags do React Router durante os testes
const origWarn = console.warn
console.warn = (...args: any[]) => {
  const msg = String(args[0] || '')
  if (msg.includes('React Router Future Flag Warning')) return
  origWarn(...args)
}


