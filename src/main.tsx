// IMPORTANTE: Importar bloqueador de redirecionamentos ANTES de qualquer outro código
import './utils/block-redirects'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import '@superlogica/ui/dist/index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
