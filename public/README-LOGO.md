# 📋 Instruções para o Logotipo AB

## ✅ Status Atual

- ✅ Código configurado no `Shell.tsx`
- ✅ Pasta `public` criada
- ⏳ Aguardando arquivo do logotipo

## 📁 Onde colocar o arquivo

Coloque (ou renomeie) o arquivo do logotipo como:

```
/home/luizmassa/PROJETOS/iap-apps/apps/manutencoes/front/public/logo-ab.png
```

## ⚠️ Importante

- O nome deve ser **exatamente** `logo-ab.png`
- O diretório `/public` é o lugar certo, pois o React/Vite serve esses arquivos diretamente
- Formatos suportados: PNG, JPG, SVG

## 🎨 Características do Logotipo

- **Altura**: 40px
- **Largura**: Automática (mantém proporção)
- **Posição**: À esquerda do texto "Administradora de Condomínios"
- **Espaçamento**: 12px entre logotipo e texto
- **Responsivo**: Ajusta automaticamente em telas menores

## 🔄 Fallback

Se o arquivo não carregar, será exibido um placeholder com as letras "AB" em um fundo cinza.

## ✅ Resultado Esperado

Assim que o arquivo `logo-ab.png` estiver em `/public`, o cabeçalho exibirá:

```
[Logo AB] 12px [Texto: "Administradora de Condomínios"]
```

## 🚀 Como testar

1. Coloque o arquivo `logo-ab.png` na pasta `public`
2. Recarregue a página (Ctrl+Shift+R ou F5)
3. O logotipo deve aparecer ao lado esquerdo do texto

