import React from 'react'
import { Link, useLocation } from 'react-router-dom'
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
import { useAuth } from '../contexts/AuthContext'

type MenuItem = {
  id: string
  label: string
  path: string
  icon: React.ReactNode
  section: 'controlar' | 'acompanhar' | 'outros'
}

// Itens do menu organizados por seção
const menuItems: MenuItem[] = [
  // Seção CONTROLAR
  {
    id: 'mandatos',
    label: 'Mandatos',
    path: '/mandatos',
    icon: <FileText size={16} />,
    section: 'controlar'
  },
  {
    id: 'certificado-digital',
    label: 'Certificado Digital',
    path: '/certificado-digital',
    icon: <ShieldCheck size={16} />,
    section: 'controlar'
  },
  {
    id: 'assembleias',
    label: 'Assembleias',
    path: '/assembleias',
    icon: <Users size={16} />,
    section: 'controlar'
  },
  {
    id: 'previsao-orcamentaria',
    label: 'Previsão Orçamentária',
    path: '/previsao-orcamentaria',
    icon: <TrendingUp size={16} />,
    section: 'controlar'
  },
  {
    id: 'debito-automatico',
    label: 'Débito Automático',
    path: '/debito-automatico',
    icon: <CreditCard size={16} />,
    section: 'outros'
  },
  {
    id: 'seguros',
    label: 'Seguros',
    path: '/seguros',
    icon: <Shield size={16} />,
    section: 'controlar'
  },
  {
    id: 'manutencoes',
    label: 'Manutenção',
    path: '/manutencoes',
    icon: <Wrench size={16} />,
    section: 'controlar'
  },
  // Seção ACOMPANHAR
  {
    id: 'fluxo-caixa',
    label: 'Fluxo de Caixa',
    path: '/fluxo-caixa',
    icon: <DollarSign size={16} />,
    section: 'acompanhar'
  },
  {
    id: 'inadimplencia',
    label: 'Inadimplência',
    path: '/inadimplencia',
    icon: <AlertCircle size={16} />,
    section: 'acompanhar'
  },
  {
    id: 'saldo-bancario',
    label: 'Saldo Bancário',
    path: '/saldo-bancario',
    icon: <Wallet size={16} />,
    section: 'acompanhar'
  },
  // Outros módulos
  {
    id: 'condominios',
    label: 'Condomínios',
    path: '/condominios',
    icon: <Building2 size={16} />,
    section: 'outros'
  },
  {
    id: 'moradores',
    label: 'Moradores',
    path: '/moradores',
    icon: <Users size={16} />,
    section: 'outros'
  },
  {
    id: 'reunioes',
    label: 'Reuniões',
    path: '/reunioes',
    icon: <Calendar size={16} />,
    section: 'outros'
  },
  {
    id: 'documentos',
    label: 'Documentos',
    path: '/documentos',
    icon: <FileCheck size={16} />,
    section: 'outros'
  },
  {
    id: 'ocorrencias',
    label: 'Ocorrências',
    path: '/ocorrencias',
    icon: <ClipboardList size={16} />,
    section: 'outros'
  },
  {
    id: 'boletos',
    label: 'Boletos',
    path: '/boletos',
    icon: <Receipt size={16} />,
    section: 'outros'
  },
  {
    id: 'relatorios',
    label: 'Relatórios',
    path: '/relatorios',
    icon: <BarChart3 size={16} />,
    section: 'outros'
  },
  {
    id: 'comunicados',
    label: 'Comunicados',
    path: '/comunicados',
    icon: <Mail size={16} />,
    section: 'outros'
  },
  {
    id: 'notificacoes',
    label: 'Notificações',
    path: '/notificacoes',
    icon: <Bell size={16} />,
    section: 'outros'
  },
  {
    id: 'auditoria',
    label: 'Auditoria',
    path: '/auditoria',
    icon: <FileSearch size={16} />,
    section: 'outros'
  },
  {
    id: 'usuarios',
    label: 'Usuários',
    path: '/usuarios',
    icon: <UserCheck size={16} />,
    section: 'outros'
  },
  {
    id: 'configuracoes',
    label: 'Configurações',
    path: '/configuracoes',
    icon: <Settings size={16} />,
    section: 'outros'
  },
]

export function MainMenu() {
  const location = useLocation()
  const { user, companyId, companies, setCompanyId } = useAuth()
  
  // Para hash router, usar hash ou pathname
  const currentPath = location.hash ? location.hash.replace('#', '') : location.pathname

  const controlarItems = menuItems.filter(item => item.section === 'controlar')
  const acompanharItems = menuItems.filter(item => item.section === 'acompanhar')
  const outrosItems = menuItems.filter(item => item.section === 'outros')

  const renderMenuItem = (item: MenuItem) => {
    const isActive = currentPath === item.path || currentPath.startsWith(item.path + '/')
    
    return (
      <Link
        key={item.id}
        to={item.path}
        className={`
          flex items-center gap-2 px-3 py-2 rounded transition-colors cursor-pointer
          ${isActive 
            ? 'bg-blue-600 text-white' 
            : 'text-blue-100 hover:bg-blue-700/50'
          }
        `}
      >
        <div className="flex-shrink-0">
          {item.icon}
        </div>
        <span className="text-sm font-medium">{item.label}</span>
      </Link>
    )
  }

  return (
    <div className="bg-blue-900 w-64 min-h-screen flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-blue-800">
        <div className="flex items-center justify-center mb-2" style={{ height: '48px' }}>
          <img 
            src="/super.png" 
            alt="Superlógica" 
            className="h-full w-auto max-w-full object-contain"
            style={{ maxHeight: '48px' }}
            onError={(e) => {
              // Fallback se a imagem não carregar
              const target = e.target as HTMLImageElement
              target.style.display = 'none'
              const fallback = document.createElement('div')
              fallback.className = 'text-white font-bold text-lg'
              fallback.textContent = 'Superlógica'
              target.parentElement?.appendChild(fallback)
            }}
          />
        </div>
        <div className="text-center mt-2">
          <p className="text-blue-300 text-xs font-mono">
            Σα$$α
          </p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Seção CONTROLAR */}
        <div className="mb-4">
          <div className="px-4 py-2">
            <h3 className="text-yellow-400 text-xs font-bold uppercase tracking-wider">
              CONTROLAR
            </h3>
          </div>
          <div className="space-y-1 px-2">
            {controlarItems.map(renderMenuItem)}
          </div>
        </div>

        {/* Seção ACOMPANHAR */}
        <div className="mb-4">
          <div className="px-4 py-2">
            <h3 className="text-yellow-400 text-xs font-bold uppercase tracking-wider">
              ACOMPANHAR
            </h3>
          </div>
          <div className="space-y-1 px-2">
            {acompanharItems.map(renderMenuItem)}
          </div>
        </div>

        {/* Outros itens (colapsáveis ou em seção separada) */}
        {outrosItems.length > 0 && (
          <div className="mb-4">
            <div className="px-4 py-2">
              <h3 className="text-yellow-400 text-xs font-bold uppercase tracking-wider">
                OUTROS
              </h3>
            </div>
            <div className="space-y-1 px-2">
              {outrosItems.map(renderMenuItem)}
            </div>
          </div>
        )}
      </div>

      {/* Footer - Company Selector */}
      <div className="p-4 border-t border-blue-800">
        <div className="mb-2">
          <label className="text-blue-300 text-xs font-medium block mb-1">
            Empresa:
          </label>
          <select
            value={companyId || ''}
            onChange={(e) => setCompanyId(e.target.value)}
            className="w-full bg-blue-800 text-white text-sm rounded px-2 py-1 border border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {companies.map(company => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
            {companies.length === 0 && (
              <option value="">local</option>
            )}
          </select>
        </div>
      </div>
    </div>
  )
}
