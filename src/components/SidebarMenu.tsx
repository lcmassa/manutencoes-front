import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  Home,
  FileText,
  ShieldCheck,
  Users,
  TrendingUp,
  Shield,
  Wrench,
  DollarSign,
  AlertCircle,
  Wallet,
  Receipt,
  CreditCard,
  Building2,
  Calendar,
  FileCheck,
  ClipboardList,
  BarChart3,
} from 'lucide-react'

interface MenuItem {
  id: string
  label: string
  path: string
  icon: React.ReactNode
  section: 'controlar' | 'acompanhar' | 'outros'
  developed?: boolean
}

const menuItems: MenuItem[] = [
  // Dashboard
  { id: 'dashboard', label: 'Dashboard', path: '/', icon: <Home size={16} />, section: 'controlar', developed: true },
  
  // Seção CONTROLAR
  { id: 'mandatos', label: 'Mandatos', path: '/mandatos', icon: <FileText size={16} />, section: 'controlar', developed: true },
  { id: 'certificado-digital', label: 'Certificado Digital', path: '/certificado-digital', icon: <ShieldCheck size={16} />, section: 'controlar', developed: true },
  { id: 'assembleias', label: 'Assembleias', path: '/assembleias', icon: <Users size={16} />, section: 'controlar', developed: true },
  { id: 'previsao-orcamentaria', label: 'Previsão Orçamentária', path: '/previsao-orcamentaria', icon: <TrendingUp size={16} />, section: 'controlar', developed: true },
  { id: 'seguros', label: 'Seguros', path: '/seguros', icon: <Shield size={16} />, section: 'controlar', developed: true },
  { id: 'manutencoes', label: 'Manutenção', path: '/manutencoes', icon: <Wrench size={16} />, section: 'controlar', developed: true },
  
  // Seção ACOMPANHAR
  { id: 'fluxo-caixa', label: 'Fluxo de Caixa', path: '/fluxo-caixa', icon: <DollarSign size={16} />, section: 'acompanhar', developed: true },
  { id: 'inadimplencia', label: 'Inadimplência', path: '/inadimplencia', icon: <AlertCircle size={16} />, section: 'acompanhar', developed: true },
  { id: 'saldo-bancario', label: 'Saldo Bancário', path: '/saldo-bancario', icon: <Wallet size={16} />, section: 'acompanhar', developed: true },
  { id: 'fechamento-balancete', label: 'Fechamento Balancete', path: '/fechamento-balancete', icon: <Receipt size={16} />, section: 'acompanhar', developed: true },
  
  // Outros módulos
  { id: 'debito-automatico', label: 'Débito Automático', path: '/debito-automatico', icon: <CreditCard size={16} />, section: 'outros' },
  { id: 'condominios', label: 'Condomínios', path: '/condominios', icon: <Building2 size={16} />, section: 'outros' },
  { id: 'moradores', label: 'Moradores', path: '/moradores', icon: <Users size={16} />, section: 'outros' },
  { id: 'reunioes', label: 'Reuniões', path: '/reunioes', icon: <Calendar size={16} />, section: 'outros' },
  { id: 'documentos', label: 'Documentos', path: '/documentos', icon: <FileCheck size={16} />, section: 'outros' },
  { id: 'ocorrencias', label: 'Ocorrências', path: '/ocorrencias', icon: <ClipboardList size={16} />, section: 'outros' },
  { id: 'relatorios', label: 'Relatórios', path: '/relatorios', icon: <BarChart3 size={16} />, section: 'outros' },
]

export function SidebarMenu() {
  const location = useLocation()
  
  // #region agent log
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SidebarMenu.tsx:60',message:'SidebarMenu renderizado',data:{pathname:location.pathname,hash:location.hash,search:location.search},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
  }, [location]);
  // #endregion
  
  // Para hash router, usar pathname (React Router já resolve o hash)
  const currentPath = location.pathname
  
  const controlarItems = menuItems.filter(item => item.section === 'controlar')
  const acompanharItems = menuItems.filter(item => item.section === 'acompanhar')
  const outrosItems = menuItems.filter(item => item.section === 'outros')
  
  const isActive = (path: string) => {
    if (path === '/') {
      return currentPath === '/' || currentPath === ''
    }
    return currentPath === path || currentPath.startsWith(path + '/')
  }
  
  const renderMenuItem = (item: MenuItem) => {
    const active = isActive(item.path)
    
    return (
      <Link
        key={item.id}
        to={item.path}
        onClick={(e) => {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/f0428a8a-3429-4d2c-96c5-eee3af77a73c',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'SidebarMenu.tsx:87',message:'Link clicado no menu',data:{itemId:item.id,itemPath:item.path,currentPath,active},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
          // #endregion
        }}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-md transition-all duration-150
          ${active
            ? 'bg-blue-600 text-white shadow-md'
            : 'text-white/90 hover:bg-white/10 hover:text-white'
          }
        `}
        style={{
          fontSize: '0.75rem',
          lineHeight: '1rem',
          minHeight: '2.5rem',
        }}
      >
        <span className="flex-shrink-0">{item.icon}</span>
        <span className="flex-1 truncate whitespace-nowrap">
          {item.label}
          {item.developed && <span className="ml-1">✓</span>}
        </span>
      </Link>
    )
  }
  
  return (
    <aside className="fixed left-0 top-0 h-screen w-[200px] bg-indigo-900 text-white overflow-y-auto z-50">
      <div className="p-4">
        {/* Logo ou título */}
        <div className="mb-6">
          <h2 className="text-xs font-bold text-white/90">Menu</h2>
        </div>
        
        {/* Seção CONTROLAR */}
        <div className="mb-4">
          <h3 className="text-[0.5rem] font-semibold text-white/70 uppercase tracking-wider mb-2 px-2">
            Controlar
          </h3>
          <nav className="space-y-1">
            {controlarItems.map(renderMenuItem)}
          </nav>
        </div>
        
        {/* Seção ACOMPANHAR */}
        <div className="mb-4">
          <h3 className="text-[0.5rem] font-semibold text-white/70 uppercase tracking-wider mb-2 px-2">
            Acompanhar
          </h3>
          <nav className="space-y-1">
            {acompanharItems.map(renderMenuItem)}
          </nav>
        </div>
        
        {/* Linha divisória após Fechamento Balancete */}
        <div className="border-t border-white/20 my-2"></div>
        
        {/* Seção OUTROS */}
        <div className="mb-4">
          <h3 className="text-[0.5rem] font-semibold text-white/70 uppercase tracking-wider mb-2 px-2">
            Outros
          </h3>
          <nav className="space-y-1">
            {outrosItems.map(renderMenuItem)}
          </nav>
        </div>
      </div>
    </aside>
  )
}
