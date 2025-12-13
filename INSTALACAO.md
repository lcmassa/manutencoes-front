# 📦 Guia de Instalação - Sistema de Manutenções

Este guia explica como instalar e executar o sistema de manutenções em um novo computador.

## 🔧 Requisitos do Sistema

### Software Necessário

1. **Node.js** (versão 18 ou superior)
   - Download: https://nodejs.org/
   - Verificar instalação: `node --version`
   - Verificar npm: `npm --version`

2. **Git** (opcional, para clonar repositório)
   - Download: https://git-scm.com/
   - Verificar: `git --version`

3. **Navegador moderno**
   - Google Chrome (recomendado)
   - Firefox
   - Edge
   - Safari (Mac)

### Requisitos de Sistema

- **Windows**: Windows 10 ou superior
- **Linux**: Ubuntu 20.04+ ou distribuição similar
- **macOS**: macOS 10.15+ ou superior
- **RAM**: Mínimo 4GB (recomendado 8GB)
- **Espaço em disco**: Mínimo 500MB livres

## 📥 Instalação Passo a Passo

### 1. Instalar Node.js

#### Windows:
1. Baixe o instalador do site oficial: https://nodejs.org/
2. Execute o instalador e siga as instruções
3. Marque a opção "Add to PATH" durante a instalação
4. Reinicie o terminal/PowerShell

#### Linux (Ubuntu/Debian):
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### macOS:
```bash
# Usando Homebrew
brew install node

# Ou baixe o instalador do site oficial
```

### 2. Verificar Instalação

Abra um terminal e execute:
```bash
node --version   # Deve mostrar v18.x.x ou superior
npm --version    # Deve mostrar 9.x.x ou superior
```

### 3. Extrair e Preparar o Projeto

1. Extraia o arquivo ZIP em uma pasta de sua escolha
2. Abra o terminal na pasta do projeto:
   ```bash
   cd /caminho/para/manutencoes/front
   ```

### 4. Instalar Dependências

Execute o comando:
```bash
npm install
```

Este processo pode levar alguns minutos na primeira vez. Ele irá:
- Baixar todas as dependências do projeto
- Instalar pacotes do npm
- Configurar o ambiente de desenvolvimento

### 5. Autenticação (Primeira Vez)

Antes de executar o sistema, você precisa autenticar:

1. Navegue até a raiz do projeto `iap-apps`:
   ```bash
   cd ../..  # Voltar para iap-apps
   ```

2. Execute o comando de autenticação:
   ```bash
   ./iap auth
   ```

3. Siga as instruções na tela:
   - Abra a URL fornecida no navegador
   - Digite o código fornecido
   - Aguarde a confirmação

4. O token será salvo automaticamente em `.iap-cli/token.jwt`

### 6. Executar o Sistema

Volte para a pasta do frontend:
```bash
cd apps/manutencoes/front
```

Execute o servidor de desenvolvimento:
```bash
npm run dev
```

O sistema estará disponível em: **http://localhost:5173**

## 🚀 Comandos Úteis

### Desenvolvimento
```bash
npm run dev          # Inicia servidor de desenvolvimento
npm run build        # Cria build de produção
npm run preview      # Visualiza build de produção
```

### Autenticação
```bash
./iap auth           # Renovar token (quando expirar)
```

## 🔄 Renovação do Token

O token expira após algumas horas. Para renovar:

1. Execute: `./iap auth`
2. Siga as instruções na tela
3. Recarregue a página no navegador (Ctrl+Shift+R)

## 🐛 Solução de Problemas

### Erro: "npm não encontrado"
- Verifique se Node.js está instalado: `node --version`
- Reinstale Node.js se necessário
- Reinicie o terminal após instalação

### Erro: "Porta 5173 já está em uso"
- Feche outros programas usando a porta
- Ou altere a porta no arquivo `vite.config.ts`

### Erro: "Token não encontrado"
- Execute `./iap auth` na raiz do projeto
- Verifique se o arquivo `.iap-cli/token.jwt` foi criado

### Erro: "Cannot find module"
- Execute `npm install` novamente
- Delete a pasta `node_modules` e execute `npm install` novamente

### Erro de conexão com a API
- Verifique sua conexão com a internet
- Verifique se o token não expirou: `./iap auth`

## 📁 Estrutura de Arquivos Importantes

```
manutencoes/
├── front/
│   ├── src/              # Código fonte da aplicação
│   ├── package.json       # Dependências do projeto
│   ├── vite.config.ts     # Configuração do Vite
│   └── tsconfig.json      # Configuração do TypeScript
└── iap.config.yaml       # Configuração do IAP
```

## 🔐 Segurança

- **NÃO compartilhe** o arquivo `.iap-cli/token.jwt`
- **NÃO faça commit** do token no Git
- O token é pessoal e não deve ser compartilhado

## 📞 Suporte

Se encontrar problemas:
1. Verifique os logs no console do navegador (F12)
2. Verifique os logs no terminal onde o servidor está rodando
3. Consulte a seção "Solução de Problemas" acima

## ✅ Checklist de Instalação

- [ ] Node.js instalado (v18+)
- [ ] npm instalado e funcionando
- [ ] Projeto extraído e na pasta correta
- [ ] `npm install` executado com sucesso
- [ ] `./iap auth` executado e token gerado
- [ ] `npm run dev` executado sem erros
- [ ] Aplicação acessível em http://localhost:5173

## 🎯 Próximos Passos

Após a instalação bem-sucedida:
1. Acesse http://localhost:5173
2. Faça login (se necessário)
3. Explore os módulos disponíveis:
   - Dashboard
   - Mandatos
   - Manutenções
   - Seguros
   - Fluxo de Caixa
   - Certificado Digital
   - Assembleias

