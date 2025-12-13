# 📦 Guia para Copiar o App para Outro Computador

## 🎯 Arquivos Necessários

### ✅ O que COPIAR:

1. **Todo o código fonte** (`src/`)
2. **Arquivos de configuração**:
   - `package.json` - Dependências
   - `package-lock.json` ou `yarn.lock` - Versões exatas
   - `vite.config.ts` - Configuração do Vite
   - `tsconfig.json` - Configuração TypeScript
   - `.env` ou `.env.local` (se existir) - Variáveis de ambiente
   - `index.html` - HTML principal
3. **Arquivos de documentação** (opcional mas recomendado):
   - `README.md`
   - `INSTALACAO.md`
   - `RELATORIOS.md`
   - `COPIAR_PARA_OUTRO_PC.md` (este arquivo)

### ❌ O que NÃO copiar:

- `node_modules/` - Será reinstalado
- `dist/` - Será gerado novamente
- `.vite/` - Cache do Vite (será recriado)
- `.git/` - Se usar Git, copie apenas o repositório
- Arquivos temporários e de build

## 🚀 Método 1: Script Automatizado (Recomendado)

Execute o script `copiar-app.sh` que está na raiz do projeto:

```bash
cd /home/luizmassa/PROJETOS/iap-apps/apps/manutencoes/front
chmod +x ../copiar-app.sh
../copiar-app.sh
```

Isso criará um arquivo `manutencoes-front-backup.tar.gz` pronto para transferir.

## 📋 Método 2: Manual com tar (Linux/Mac)

### Passo 1: Criar arquivo compactado

```bash
cd /home/luizmassa/PROJETOS/iap-apps/apps/manutencoes/front

# Criar backup excluindo node_modules, dist, cache, etc
tar -czf ../manutencoes-front-backup.tar.gz \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.vite' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='coverage' \
  --exclude='.nyc_output' \
  src/ \
  public/ \
  package.json \
  package-lock.json \
  vite.config.ts \
  tsconfig.json \
  tsconfig.node.json \
  index.html \
  *.md \
  .env* 2>/dev/null || true
```

### Passo 2: Transferir para outro computador

**Opção A - USB/Pen Drive:**
```bash
# Copiar para USB (ajuste o caminho)
cp ../manutencoes-front-backup.tar.gz /media/usb/
```

**Opção B - Rede (SCP):**
```bash
# Para outro Linux/Mac na rede
scp ../manutencoes-front-backup.tar.gz usuario@outro-pc:/caminho/destino/

# Exemplo:
scp ../manutencoes-front-backup.tar.gz luiz@192.168.1.100:~/Downloads/
```

**Opção C - Compartilhamento de rede:**
```bash
# Copiar para pasta compartilhada
cp ../manutencoes-front-backup.tar.gz /caminho/compartilhado/
```

## 💻 No Computador Destino

### Passo 1: Extrair arquivos

```bash
# Criar diretório do projeto
mkdir -p ~/PROJETOS/iap-apps/apps/manutencoes/front
cd ~/PROJETOS/iap-apps/apps/manutencoes/front

# Extrair arquivos
tar -xzf ~/Downloads/manutencoes-front-backup.tar.gz
```

### Passo 2: Instalar dependências

```bash
# Certifique-se de ter Node.js instalado (versão 18+)
node --version

# Instalar dependências
npm install
```

### Passo 3: Configurar variáveis de ambiente (se necessário)

```bash
# Criar arquivo .env se não existir
cat > .env << EOF
VITE_API_URL=https://iap-gateway.applications.hml.superlogica.tech
EOF
```

### Passo 4: Rodar o app

```bash
npm run dev
```

## 📦 Método 3: Usando Git (Se o projeto estiver versionado)

### No computador origem:

```bash
cd /home/luizmassa/PROJETOS/iap-apps/apps/manutencoes/front
git add .
git commit -m "Backup antes de copiar"
git push  # Se tiver repositório remoto
```

### No computador destino:

```bash
git clone <url-do-repositorio>
cd manutencoes/front
npm install
npm run dev
```

## 🔧 Verificações no Computador Destino

### 1. Verificar Node.js instalado

```bash
node --version  # Deve ser 18 ou superior
npm --version
```

### 2. Verificar se todos os arquivos foram copiados

```bash
ls -la
# Deve ter: src/, package.json, vite.config.ts, index.html
```

### 3. Verificar dependências instaladas

```bash
npm list --depth=0
```

### 4. Testar build

```bash
npm run build
```

## ⚠️ Problemas Comuns

### Erro: "Cannot find module"
**Solução**: Execute `npm install` novamente

### Erro: "Port 5173 already in use"
**Solução**: 
```bash
# Matar processo na porta 5173
lsof -ti:5173 | xargs kill -9
# Ou usar outra porta
npm run dev -- --port 5174
```

### Erro: "Token file not found"
**Solução**: Execute `./iap auth` no diretório raiz do projeto

### Arquivos faltando
**Solução**: Verifique se copiou todos os arquivos listados acima

## 📝 Checklist Final

- [ ] Código fonte (`src/`) copiado
- [ ] `package.json` copiado
- [ ] `vite.config.ts` copiado
- [ ] `tsconfig.json` copiado
- [ ] `index.html` copiado
- [ ] Arquivos `.env` copiados (se existirem)
- [ ] Node.js instalado no destino (versão 18+)
- [ ] `npm install` executado
- [ ] `npm run dev` funcionando

## 🎯 Estrutura Mínima Necessária

```
manutencoes/front/
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── pages/
│   ├── components/
│   ├── contexts/
│   ├── lib/
│   └── utils/
├── public/ (se existir)
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
├── index.html
└── .env (opcional)
```

## 💡 Dica: Tamanho do Backup

O arquivo compactado deve ter aproximadamente:
- **Sem node_modules**: ~500KB - 2MB
- **Com node_modules**: ~200MB - 500MB (não recomendado)

Sempre exclua `node_modules` e reinstale no destino!

