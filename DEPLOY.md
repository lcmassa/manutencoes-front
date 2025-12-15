# Instruções de Deploy

Este projeto está configurado para deploy automático no **Vercel** e **Netlify**.

## 🚀 Vercel

### Configuração Inicial

1. Acesse [vercel.com](https://vercel.com) e faça login com sua conta GitHub
2. Clique em "Add New Project"
3. Importe o repositório `lcmassa/manutencoes-front`
4. O Vercel detectará automaticamente as configurações do `vercel.json`
5. Configure as variáveis de ambiente (se necessário):
   - `VITE_API_URL` (opcional, padrão já configurado)

### Deploy Automático

- **Push para `main`**: Deploy automático em produção
- **Pull Requests**: Preview automático para cada PR

### Links

Após o primeiro deploy, você receberá:
- **Produção**: `https://manutencoes-front.vercel.app` (ou domínio customizado)
- **Preview**: Link único para cada PR

---

## 🌐 Netlify

### Configuração Inicial

1. Acesse [netlify.com](https://netlify.com) e faça login com sua conta GitHub
2. Clique em "Add new site" → "Import an existing project"
3. Selecione o repositório `lcmassa/manutencoes-front`
4. O Netlify detectará automaticamente as configurações do `netlify.toml`
5. Configure as variáveis de ambiente (se necessário):
   - `VITE_API_URL` (opcional, padrão já configurado)

### Deploy Automático

- **Push para `main`**: Deploy automático em produção
- **Pull Requests**: Preview automático para cada PR

### Links

Após o primeiro deploy, você receberá:
- **Produção**: `https://manutencoes-front.netlify.app` (ou domínio customizado)
- **Preview**: Link único para cada PR

---

## 📝 Notas

- Ambos os serviços fazem deploy automático a cada push na branch `main`
- Pull Requests geram previews automáticos
- As configurações estão nos arquivos `vercel.json` e `netlify.toml`
- O build usa `pnpm build` e publica o diretório `dist`

