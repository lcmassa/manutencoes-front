#!/bin/bash

# Script para criar backup do app para copiar para outro computador
# Uso: ./copiar-app.sh

set -e

# Cores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}📦 Criando backup do app para copiar para outro computador...${NC}"

# Diretório atual
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Nome do arquivo de backup
BACKUP_NAME="manutencoes-front-backup-$(date +%Y%m%d-%H%M%S).tar.gz"
BACKUP_PATH="../$BACKUP_NAME"

echo -e "${YELLOW}📁 Diretório atual: $SCRIPT_DIR${NC}"
echo -e "${YELLOW}📦 Criando: $BACKUP_PATH${NC}"

# Verificar se arquivos essenciais existem
echo -e "\n${GREEN}✅ Verificando arquivos essenciais...${NC}"

if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Erro: package.json não encontrado!${NC}"
    exit 1
fi

if [ ! -d "src" ]; then
    echo -e "${RED}❌ Erro: Diretório src/ não encontrado!${NC}"
    exit 1
fi

if [ ! -f "vite.config.ts" ]; then
    echo -e "${RED}❌ Erro: vite.config.ts não encontrado!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Todos os arquivos essenciais encontrados${NC}"

# Criar backup
echo -e "\n${GREEN}📦 Criando arquivo compactado...${NC}"

tar -czf "$BACKUP_PATH" \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='.vite' \
  --exclude='.git' \
  --exclude='*.log' \
  --exclude='.DS_Store' \
  --exclude='coverage' \
  --exclude='.nyc_output' \
  --exclude='.idea' \
  --exclude='.vscode' \
  --exclude='*.swp' \
  --exclude='*.swo' \
  --exclude='*~' \
  src/ \
  public/ 2>/dev/null || true \
  package.json \
  package-lock.json \
  vite.config.ts \
  tsconfig.json \
  tsconfig.node.json \
  index.html \
  *.md \
  .env* 2>/dev/null || true

if [ $? -eq 0 ]; then
    # Obter tamanho do arquivo
    SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    
    echo -e "\n${GREEN}✅ Backup criado com sucesso!${NC}"
    echo -e "${GREEN}📦 Arquivo: $BACKUP_PATH${NC}"
    echo -e "${GREEN}📊 Tamanho: $SIZE${NC}"
    echo -e "\n${YELLOW}📋 Próximos passos:${NC}"
    echo -e "1. Copie o arquivo para outro computador:"
    echo -e "   ${GREEN}cp $BACKUP_PATH /caminho/para/usb/ou/rede/${NC}"
    echo -e "\n2. No computador destino, extraia:"
    echo -e "   ${GREEN}tar -xzf $BACKUP_NAME${NC}"
    echo -e "\n3. Instale as dependências:"
    echo -e "   ${GREEN}npm install${NC}"
    echo -e "\n4. Execute o app:"
    echo -e "   ${GREEN}npm run dev${NC}"
else
    echo -e "${RED}❌ Erro ao criar backup!${NC}"
    exit 1
fi

