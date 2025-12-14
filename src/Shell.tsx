import React, { useMemo } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import { AppShell, useLayout, type MenuItem } from '@superlogica/ui'
import '@superlogica/ui/dist/index.css'
import {
  FileText,
  Wrench,
  Users,
  Building2,
  Calendar,
  DollarSign,
  FileCheck,
  Settings,
  BarChart3,
  Mail,
  Bell,
  Shield,
  ClipboardList,
  Archive,
  Receipt,
  CreditCard,
  FileSearch,
  UserCheck,
  Home,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Wallet,
} from 'lucide-react'

// Mapeamento de ícones do lucide-react para IconName do AppShell (se necessário)
// Por enquanto, vamos usar os componentes React diretamente
const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText size={18} />,
  Wrench: <Wrench size={18} />,
  Users: <Users size={18} />,
  Building2: <Building2 size={18} />,
  Calendar: <Calendar size={18} />,
  DollarSign: <DollarSign size={18} />,
  FileCheck: <FileCheck size={18} />,
  Settings: <Settings size={18} />,
  BarChart3: <BarChart3 size={18} />,
  Mail: <Mail size={18} />,
  Bell: <Bell size={18} />,
  Shield: <Shield size={18} />,
  ClipboardList: <ClipboardList size={18} />,
  Archive: <Archive size={18} />,
  Receipt: <Receipt size={18} />,
  CreditCard: <CreditCard size={18} />,
  FileSearch: <FileSearch size={18} />,
  UserCheck: <UserCheck size={18} />,
  Home: <Home size={18} />,
  ShieldCheck: <ShieldCheck size={18} />,
  TrendingUp: <TrendingUp size={18} />,
  AlertCircle: <AlertCircle size={18} />,
  Wallet: <Wallet size={18} />,
}

// Itens do menu organizados por seção
const menuItemsData = [
  // Seção CONTROLAR
  { id: 'mandatos', label: 'Mandatos', path: '#/mandatos', icon: 'FileText', section: 'controlar' },
  { id: 'certificado-digital', label: 'Certificado Digital', path: '#/certificado-digital', icon: 'ShieldCheck', section: 'controlar' },
  { id: 'assembleias', label: 'Assembleias', path: '#/assembleias', icon: 'Users', section: 'controlar' },
  { id: 'previsao-orcamentaria', label: 'Previsão Orçamentária', path: '#/previsao-orcamentaria', icon: 'TrendingUp', section: 'controlar' },
  { id: 'seguros', label: 'Seguros', path: '#/seguros', icon: 'Shield', section: 'controlar' },
  { id: 'manutencoes', label: 'Manutenção', path: '#/manutencoes', icon: 'Wrench', section: 'controlar' },
  // Seção ACOMPANHAR
  { id: 'fluxo-caixa', label: 'Fluxo de Caixa', path: '#/fluxo-caixa', icon: 'DollarSign', section: 'acompanhar' },
  { id: 'inadimplencia', label: 'Inadimplência', path: '#/inadimplencia', icon: 'AlertCircle', section: 'acompanhar' },
  { id: 'receitas-mes', label: 'Receitas do Mês', path: '#/receitas-mes', icon: 'Wallet', section: 'acompanhar' },
  { id: 'saldo-bancario', label: 'Saldo Bancário', path: '#/saldo-bancario', icon: 'Wallet', section: 'acompanhar' },
  // Outros módulos
  { id: 'debito-automatico', label: 'Débito Automático', path: '#/debito-automatico', icon: 'CreditCard', section: 'outros' },
  { id: 'condominios', label: 'Condomínios', path: '#/condominios', icon: 'Building2', section: 'outros' },
  { id: 'moradores', label: 'Moradores', path: '#/moradores', icon: 'Users', section: 'outros' },
  { id: 'reunioes', label: 'Reuniões', path: '#/reunioes', icon: 'Calendar', section: 'outros' },
  { id: 'documentos', label: 'Documentos', path: '#/documentos', icon: 'FileCheck', section: 'outros' },
  { id: 'ocorrencias', label: 'Ocorrências', path: '#/ocorrencias', icon: 'ClipboardList', section: 'outros' },
  { id: 'boletos', label: 'Boletos', path: '#/boletos', icon: 'Receipt', section: 'outros' },
  { id: 'relatorios', label: 'Relatórios', path: '#/relatorios', icon: 'BarChart3', section: 'outros' },
  { id: 'comunicados', label: 'Comunicados', path: '#/comunicados', icon: 'Mail', section: 'outros' },
  { id: 'notificacoes', label: 'Notificações', path: '#/notificacoes', icon: 'Bell', section: 'outros' },
  { id: 'auditoria', label: 'Auditoria', path: '#/auditoria', icon: 'FileSearch', section: 'outros' },
  { id: 'usuarios', label: 'Usuários', path: '#/usuarios', icon: 'UserCheck', section: 'outros' },
  { id: 'configuracoes', label: 'Configurações', path: '#/configuracoes', icon: 'Settings', section: 'outros' },
]

// Criar requester a partir do api.ts
function createRequester(token: string | null, companyId: string | null): (path: string, init?: RequestInit) => Promise<Response> {
  return async (path: string, init?: RequestInit) => {
    // Construir URL completa
    const apiUrl = (import.meta as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || 'https://iap-gateway.applications.hml.superlogica.tech'
    const isDevelopment = window.location.hostname === 'gestao.adm' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    const fullUrl = path.startsWith('http') 
      ? path 
      : isDevelopment && path.startsWith('/api')
      ? path
      : `${apiUrl}${path}`

    // Usar fetch diretamente, mas com headers do api
    const headers = new Headers(init?.headers || {})
    
    // Adicionar token se disponível
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    
    // Adicionar company-id
    if (companyId) {
      headers.set('x-company-id', companyId)
      headers.set('company-id', companyId)
    }

    return fetch(fullUrl, {
      ...init,
      headers,
    })
  }
}

export function Shell() {
  const { user, companyId, companies, setCompanyId, loading, token } = useAuth()
  
  // Criar requester para useLayout (sempre chamar hooks antes de returns condicionais)
  const requester = useMemo(() => createRequester(token, companyId), [token, companyId])
  
  // Obter dados do layout (opcional - pode retornar vazio se não houver endpoint)
  const { brand, themeTokens } = useLayout(companyId, requester)
  
  // Converter itens do menu para formato MenuItem do AppShell
  const coreMenuItems: MenuItem[] = useMemo(() => {
    const controlarItems = menuItemsData.filter(item => item.section === 'controlar')
    const acompanharItems = menuItemsData.filter(item => item.section === 'acompanhar')
    
    // Combinar itens de controlar e acompanhar no coreMenu
    // Adicionar Dashboard no início
    const allCoreItems = [
      { id: 'dashboard', label: 'Dashboard', path: '#/', icon: 'Home', section: 'controlar' },
      ...controlarItems,
      ...acompanharItems
    ]
    
    return allCoreItems.map(item => ({
      label: item.label,
      href: item.path,
      icon: iconMap[item.icon] || undefined,
    }))
  }, [])

  const extraMenuItems: MenuItem[] = useMemo(() => {
    const outrosItems = menuItemsData.filter(item => item.section === 'outros')
    
    return outrosItems.map(item => ({
      label: item.label,
      href: item.path,
      icon: iconMap[item.icon] || undefined,
    }))
  }, [])

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

  // Preparar dados do usuário para AppShell
  const userData = user ? {
    name: user.name,
    email: user.email,
    picture: user.picture,
  } : undefined

  // Preparar brand (pode vir do layout ou usar padrão)
  const brandData = brand || {
    title: 'Administradora de Condomínios',
    logoUrl: '/logo-ab.png',
  }

  return (
    <AppShell
      appName="Administradora de Condomínios"
      brand={brandData}
      user={userData}
      companyId={companyId || undefined}
      companies={companies}
      onChangeCompany={setCompanyId}
      coreMenu={coreMenuItems}
      extraMenu={extraMenuItems}
      themeTokens={themeTokens}
      request={requester}
    >
      <Outlet />
    </AppShell>
  )
}
