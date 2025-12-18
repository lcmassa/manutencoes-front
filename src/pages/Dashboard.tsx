import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import { 
  FileText, 
  Wrench, 
  Building2, 
  Users, 
  Calendar,
  DollarSign,
  BarChart3,
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react'

export function Dashboard() {
  const { user, companyId } = useAuth()

  const stats = [
    {
      label: 'Mandatos Ativos',
      value: '0',
      icon: <FileText className="w-6 h-6" />,
      color: 'bg-blue-500',
      status: 'ativo'
    },
    {
      label: 'Manutenções Pendentes',
      value: '0',
      icon: <Wrench className="w-6 h-6" />,
      color: 'bg-yellow-500',
      status: 'em-desenvolvimento'
    },
    {
      label: 'Condomínios',
      value: '0',
      icon: <Building2 className="w-6 h-6" />,
      color: 'bg-green-500',
      status: 'planejado'
    },
    {
      label: 'Moradores',
      value: '0',
      icon: <Users className="w-6 h-6" />,
      color: 'bg-purple-500',
      status: 'planejado'
    },
  ]

  const recentActivities = [
    {
      type: 'mandato',
      title: 'Novo mandato criado',
      time: '2 horas atrás',
      icon: <FileText className="w-4 h-4" />,
    },
    {
      type: 'manutencao',
      title: 'Manutenção agendada',
      time: '5 horas atrás',
      icon: <Wrench className="w-4 h-4" />,
    },
  ]

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Dashboard - Administradora de Condomínios
        </h1>
        <p className="text-gray-600">
          Licença: <span className="font-semibold text-blue-600">Abimóveis (003)</span>
          {companyId && (
            <span className="ml-4 text-sm text-gray-500">
              Company ID: {companyId}
            </span>
          )}
        </p>
        {user && (
          <p className="text-sm text-gray-500 mt-1">
            Usuário: {user.name || user.email}
          </p>
        )}
      </div>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <div
            key={index}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`${stat.color} p-3 rounded-lg text-white`}>
                {stat.icon}
              </div>
              {stat.status === 'ativo' && (
                <CheckCircle2 className="w-5 h-5 text-green-500" />
              )}
              {stat.status === 'em-desenvolvimento' && (
                <Clock className="w-5 h-5 text-yellow-500" />
              )}
              {stat.status === 'planejado' && (
                <AlertCircle className="w-5 h-5 text-gray-400" />
              )}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">{stat.value}</div>
            <div className="text-sm text-gray-600">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Módulos Disponíveis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Módulos do Sistema</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="w-5 h-5 text-blue-600" />
              <h3 className="font-semibold text-gray-900">Mandatos</h3>
              <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                Ativo
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Gestão completa de mandatos de síndicos
            </p>
            <a
              href="#/mandatos"
              className="text-sm text-blue-600 hover:text-blue-700 mt-2 inline-block"
            >
              Acessar →
            </a>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 hover:border-yellow-500 transition-colors">
            <div className="flex items-center gap-3 mb-2">
              <Wrench className="w-5 h-5 text-yellow-600" />
              <h3 className="font-semibold text-gray-900">Manutenções</h3>
              <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                Em Dev
              </span>
            </div>
            <p className="text-sm text-gray-600">
              Controle de manutenções e vencimentos
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 opacity-60">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="w-5 h-5 text-gray-400" />
              <h3 className="font-semibold text-gray-500">Condomínios</h3>
              <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                Planejado
              </span>
            </div>
            <p className="text-sm text-gray-500">
              Cadastro e gestão de condomínios
            </p>
          </div>
        </div>
      </div>

      {/* Atividades Recentes */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Atividades Recentes</h2>
        <div className="space-y-3">
          {recentActivities.length > 0 ? (
            recentActivities.map((activity, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-gray-500">{activity.icon}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                  <p className="text-xs text-gray-500">{activity.time}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              Nenhuma atividade recente
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

