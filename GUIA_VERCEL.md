# 🚀 Guia Passo a Passo - Conectar ao Vercel

## Passo 1: Acessar o Vercel

1. Abra seu navegador e acesse: **https://vercel.com**
2. Clique em **"Sign Up"** ou **"Log In"** (se já tiver conta)
3. Escolha **"Continue with GitHub"** para usar sua conta GitHub

## Passo 2: Adicionar Novo Projeto

1. Após fazer login, você verá o dashboard do Vercel
2. Clique no botão **"+ Add New..."** ou **"Add New Project"**
3. Você verá uma lista dos seus repositórios do GitHub

## Passo 3: Importar o Repositório

1. Procure por **"manutencoes-front"** na lista
2. Se não aparecer, clique em **"Adjust GitHub App Permissions"** e dê permissão ao Vercel
3. Clique em **"Import"** ao lado de `lcmassa/manutencoes-front`

## Passo 4: Configurar o Projeto

O Vercel detectará automaticamente:
- ✅ **Framework Preset**: Vite
- ✅ **Build Command**: `pnpm build` (ou será detectado automaticamente)
- ✅ **Output Directory**: `dist`
- ✅ **Install Command**: `pnpm install`

**Você pode deixar tudo como está!** O arquivo `vercel.json` já está configurado.

### Variáveis de Ambiente (Opcional)

Se precisar configurar variáveis de ambiente:
1. Na seção **"Environment Variables"**
2. Adicione (se necessário):
   - `VITE_API_URL` = `https://iap-gateway.applications.hml.superlogica.tech`
   - (Normalmente não precisa, pois já está no código)

## Passo 5: Fazer o Deploy

1. Clique no botão **"Deploy"** (grande botão azul)
2. Aguarde o build (geralmente 1-3 minutos)
3. Você verá o progresso em tempo real

## Passo 6: Obter o Link

Após o deploy concluir:
1. Você verá uma tela de sucesso
2. O link estará no formato: `https://manutencoes-front-xxx.vercel.app`
3. Clique no link para abrir sua aplicação!

## ✅ Pronto!

Agora, **toda vez que você fizer push na branch `main`**, o Vercel fará deploy automático!

### Links que você terá:

- **Produção**: `https://manutencoes-front.vercel.app` (ou domínio customizado)
- **Preview de PRs**: Link único para cada Pull Request

## 🔧 Personalizar Domínio (Opcional)

1. No dashboard do projeto, vá em **"Settings"**
2. Clique em **"Domains"**
3. Adicione um domínio customizado (se tiver)

## 📝 Próximos Passos

Depois de conectar ao Vercel, você pode fazer o mesmo com o Netlify seguindo o arquivo `DEPLOY.md`!

