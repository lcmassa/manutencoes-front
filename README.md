# Sistema de Gerenciamento - Administradora de Condomínios

Sistema completo para administração de condomínios utilizando dados reais da licença **Abimóveis (003)**.

## 🏗️ Arquitetura

### Estrutura de Pastas

```
src/
├── contexts/
│   └── AuthContext.tsx      # Contexto de autenticação centralizado
├── components/
│   └── MainMenu.tsx          # Menu principal com todos os módulos
├── pages/
│   ├── Dashboard.tsx         # Dashboard principal
│   ├── Mandatos.tsx          # Módulo de Mandatos (ATIVO)
│   └── Manutencoes.tsx       # Módulo de Manutenções (EM DESENVOLVIMENTO)
├── utils/
│   └── iap-requester.ts      # Utilitário para requisições HTTP
├── App.tsx                    # Componente raiz com rotas
├── Shell.tsx                  # Shell principal com layout
└── main.tsx                   # Ponto de entrada
```

## 🔐 Autenticação

O sistema utiliza um **contexto de autenticação centralizado** (`AuthContext`) que:

- ✅ Solicita o token **apenas uma vez** no início da aplicação
- ✅ Mantém o token **permanente** enquanto o app estiver em uso
- ✅ Configura automaticamente a licença **abimoveis-003** quando disponível
- ✅ Gerencia o `company-id` de forma centralizada
- ✅ Fornece o `requester` para todas as requisições HTTP

### Uso do AuthContext

```typescript
import { useAuth } from '../contexts/AuthContext'

function MeuComponente() {
  const { user, companyId, requester, loading, error } = useAuth()
  
  // Usar companyId nas requisições
  // Usar requester para fazer chamadas HTTP
}
```

## 📋 Módulos do Sistema

### ✅ Módulos Ativos

1. **Mandatos** (`/mandatos`)
   - Gestão completa de mandatos de síndicos
   - Status: **ATIVO**
   - Dados reais da licença abimoveis-003

### 🚧 Módulos em Desenvolvimento

2. **Manutenções** (`/manutencoes`)
   - Controle de manutenções e vencimentos
   - Status: **EM DESENVOLVIMENTO**

### 📅 Módulos Planejados

3. Condomínios
4. Moradores
5. Reuniões
6. Financeiro
7. Documentos
8. Ocorrências
9. Arquivo
10. Boletos
11. Pagamentos
12. Relatórios
13. Comunicados
14. Notificações
15. Segurança
16. Auditoria
17. Usuários
18. Configurações

## 🚀 Como Adicionar um Novo Módulo

1. **Criar a página do módulo** em `src/pages/`:
```typescript
// src/pages/NovoModulo.tsx
import React from 'react'
import { useAuth } from '../contexts/AuthContext'

export function NovoModulo() {
  const { companyId } = useAuth()
  // Implementação do módulo
}
```

2. **Adicionar rota** em `src/App.tsx`:
```typescript
{
  path: 'novo-modulo',
  element: <NovoModulo />,
}
```

3. **Adicionar item no menu** em `src/components/MainMenu.tsx`:
```typescript
{
  id: 'novo-modulo',
  label: 'Novo Módulo',
  path: '/novo-modulo',
  icon: <Icone size={20} />,
  status: 'ativo', // ou 'em-desenvolvimento' ou 'planejado'
  description: 'Descrição do módulo'
}
```

## 🔧 Configuração

### Licença

O sistema está configurado para usar automaticamente a licença **abimoveis-003** quando disponível nas permissões do usuário.

### Variáveis de Ambiente

- `VITE_IAP_TOKEN`: Token de autenticação (gerado via `./iap auth`)

## 📝 Boas Práticas

1. **Sempre use o `useAuth()` hook** para acessar dados de autenticação
2. **Use `iapFetch`** do `utils/iap-requester.ts` para requisições HTTP
3. **Sempre inclua `company-id`** nas requisições quando disponível
4. **Mantenha o status do módulo atualizado** no `MainMenu.tsx`
5. **Use dados reais** - não utilize mocks ou simulações

## 🐛 Troubleshooting

### Token Expirado

Se o token expirar, execute no terminal:
```bash
./iap auth
```

Depois, recarregue a página.

### Erro de Company ID

Verifique se a licença `abimoveis-003` está disponível nas permissões do usuário.

## 📚 Dependências Principais

- `@superlogica/iap-sdk`: SDK para autenticação e requisições
- `@superlogica/ui`: Componentes UI da Superlógica
- `react-router-dom`: Roteamento
- `lucide-react`: Ícones

## 🎯 Próximos Passos

1. Completar desenvolvimento do módulo **Manutenções**
2. Implementar módulos planejados conforme prioridade
3. Adicionar testes automatizados
4. Melhorar tratamento de erros
5. Adicionar loading states consistentes

