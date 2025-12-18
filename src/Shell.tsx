import React, { useEffect } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { SidebarMenu } from './components/SidebarMenu'

export function Shell() {
  const { user, companyId, companies, setCompanyId, loading, token } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  
  // Garantir que o Dashboard seja a primeira tela se não houver hash
  useEffect(() => {
    if (!loading && token) {
      const timer = setTimeout(() => {
        const currentHash = window.location.hash
        const currentPath = location.pathname
        
        // Se não houver hash ou for apenas # ou #/, navegar para Dashboard
        if (!currentHash || currentHash === '#' || currentHash === '#/' || currentPath === '/') {
          window.location.hash = '#/'
          navigate('/', { replace: true })
        }
      }, 200)
      
      return () => clearTimeout(timer)
    }
  }, [loading, token, navigate, location])

  // Se não há token, não renderizar (deve mostrar AuthScreen)
  if (!token) {
    return null
  }

  // Se ainda está carregando, mostra loading simples
  if (loading) {
    return (
      <div className="flex min-h-screen bg-gray-50 items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    )
  }

  // Preparar dados do usuário
  const userData = user ? {
    name: user.name,
    email: user.email,
    picture: user.picture,
  } : undefined

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar Menu */}
      <SidebarMenu />
      
      {/* Main Content Area */}
      <div className="flex-1 ml-[200px]">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-40">
          <div className="px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/logo-ab.png" 
                alt="AB - Administração Condominial e Negócios Imobiliários" 
                className="h-10 w-auto object-contain"
                onError={(e) => {
                  const target = e.target as HTMLImageElement
                  target.style.display = 'none'
                }}
              />
              <h1 className="text-xl font-semibold text-gray-900">
                Administradora de Condomínios
              </h1>
            </div>
            
            {/* Company Selector */}
            {companies && companies.length > 0 && (
              <div className="flex items-center gap-2">
                <select
                  value={companyId || ''}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name} ({company.id})
                    </option>
                  ))}
                </select>
              </div>
            )}
            
            {/* User Info */}
            {userData && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{userData.name}</p>
                  <p className="text-xs text-gray-500">{userData.email}</p>
                </div>
                {userData.picture && (
                  <img
                    src={userData.picture}
                    alt={userData.name}
                    className="h-10 w-10 rounded-full"
                  />
                )}
              </div>
            )}
          </div>
        </header>
        
        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
