import React from 'react'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Shell } from './Shell'
import { Dashboard } from './pages/Dashboard'
import { Mandatos } from './pages/Mandatos'
import { Manutencoes } from './pages/Manutencoes'
import { CertificadoDigital } from './pages/CertificadoDigital'
import { Assembleias } from './pages/Assembleias'
import { Seguros } from './pages/Seguros'
import { FluxoCaixa } from './pages/FluxoCaixa'
import { Inadimplencia } from './pages/Inadimplencia'
import { PrevisaoOrcamentaria } from './pages/PrevisaoOrcamentaria'
import { SaldoBancario } from './pages/SaldoBancario'
import { FechamentoBalancete } from './pages/FechamentoBalancete'
import { AuthScreen } from './pages/AuthScreen'
import { ErrorBoundary } from './components/ErrorBoundary'

function ErrorPage({ error }: { error?: Error }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Erro</h1>
        <p className="text-gray-700 mb-2">
          {error?.message || 'Ocorreu um erro inesperado'}
        </p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Recarregar Página
        </button>
      </div>
    </div>
  )
}

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">404 - Página não encontrada</h1>
        <p className="text-gray-700 mb-4">
          A página que você está procurando não existe.
        </p>
        <a
          href="#/"
          className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Voltar para o início
        </a>
      </div>
    </div>
  )
}

function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Carregando aplicação...</p>
      </div>
    </div>
  )
}

// Componente que verifica autenticação e mostra tela apropriada
// SEM redirecionamentos - apenas render condicional
function AppContent() {
  const { token, loading, error } = useAuth()

  // Se está carregando, mostra loading
  if (loading) {
    return <LoadingScreen />
  }

  // Se houver erro (token não encontrado), mostra tela de auth
  if (error || !token) {
    return <AuthScreen />
  }

  // Se tem token, renderiza o app completo
  // NÃO fazer redirecionamento - apenas render condicional
  return <Shell />
}

function App() {
  const router = createHashRouter([
    {
      path: '/',
      element: (
        <ErrorBoundary>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ErrorBoundary>
      ),
      errorElement: <ErrorPage />,
      children: [
        {
          index: true,
          element: <Dashboard />,
        },
        {
          path: 'mandatos',
          element: <Mandatos />,
        },
        {
          path: 'manutencoes',
          element: <Manutencoes />,
        },
        {
          path: 'certificado-digital',
          element: <CertificadoDigital />,
        },
        {
          path: 'assembleias',
          element: <Assembleias />,
        },
        {
          path: 'seguros',
          element: <Seguros />,
        },
        {
          path: 'fluxo-caixa',
          element: <FluxoCaixa />,
        },
        {
          path: 'previsao-orcamentaria',
          element: <PrevisaoOrcamentaria />,
        },
        {
          path: 'inadimplencia',
          element: <Inadimplencia />,
        },
        {
          path: 'saldo-bancario',
          element: <SaldoBancario />,
        },
        {
          path: 'fechamento-balancete',
          element: <FechamentoBalancete />,
        },
        {
          path: '*',
          element: <NotFoundPage />,
        },
      ],
    },
  ])

  return <RouterProvider router={router} />
}

export default App
