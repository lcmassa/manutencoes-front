# Guia de Relatórios - API Condomínios

## 📋 Conteúdo do Postman Collection

O arquivo `postman-api-condominios-relatorios.json` contém os seguintes endpoints:

### 1. **W011A - Demonstrativo de receitas e despesas anual**
- **Endpoint**: `/api/condominios/superlogica/balancetes/index`
- **Método**: `GET`
- **Parâmetros**:
  - `idCondominio`: ID do condomínio
  - `dtInicio`: Data inicial (formato: `DD/MM/YYYY`)
  - `dtFim`: Data final (formato: `DD/MM/YYYY`)
  - `agrupadoPorMes`: `1` para agrupar por mês, `0` para não agrupar
- **Exemplo**: 
  ```
  /api/condominios/superlogica/balancetes/index?idCondominio=28&dtInicio=01/01/2017&dtFim=12/31/2018&agrupadoPorMes=1
  ```

### 2. **W025A - Previsão orçamentária mensal**
- **Endpoint**: `/api/condominios/superlogica/relatorios/id/025A`
- **Método**: `GET`
- **Parâmetros**:
  - `ID_CONDOMINIO_COND`: ID do condomínio
  - `MES_INICIAL`: Mês inicial (0 = todos)
  - `MES_INICIAL_INICIO`: Data de início do mês inicial (opcional)
  - `COM_SALDO`: `1` para incluir saldo, `0` para não incluir
  - `COM_COMPLEMENTO`: `1` para incluir complemento, `0` para não incluir
  - `render`: `pdf` ou `html` (opcional)
  - `getId`: `1` para retornar apenas o ID da impressão na fila
- **Exemplo**:
  ```
  /api/condominios/superlogica/relatorios/id/025A?ID_CONDOMINIO_COND=80&MES_INICIAL=0&MES_INICIAL_INICIO=&COM_SALDO=1&COM_COMPLEMENTO=0&render=pdf&getId=1
  ```

### 3. **W046A - Previsão orçamentária**
- **Endpoint**: `/api/condominios/superlogica/relatorios/id/046A`
- **Método**: `GET`
- **Parâmetros**:
  - `ID_CONDOMINIO_COND`: ID do condomínio
  - `MES_INICIAL`: Mês inicial
  - `MAIS_COLUNAS`: `1` para mais colunas, `0` para não
  - `COM_FRACOES`: `1` para incluir frações, `0` para não
  - `COM_MEDIA`: `1` para incluir média, `0` para não
  - `AGRUPAR_VALORES`: `1` para agrupar valores, `0` para não
  - `render`: `pdf` ou `html` (opcional)
  - `getId`: `1` para retornar apenas o ID da impressão na fila
- **Exemplo**:
  ```
  /api/condominios/superlogica/relatorios/id/046A?ID_CONDOMINIO_COND=80&MES_INICIAL=0&MAIS_COLUNAS=0&COM_FRACOES=0&COM_MEDIA=0&AGRUPAR_VALORES=0&render=pdf&getId=1
  ```

### 4. **Fila de Impressão**
- **Endpoint**: `/api/condominios/superlogica/impressoes/post`
- **Método**: `GET`
- **Parâmetros**:
  - `ID_IMPRESSAO_FIMP`: ID da impressão na fila
  - `FL_COMPARTILHAR`: `1` para compartilhar, `0` para não compartilhar
- **Uso**: Verificar status de uma impressão gerada anteriormente
- **Exemplo**:
  ```
  /api/condominios/superlogica/impressoes/post?FL_COMPARTILHAR=1&ID_IMPRESSAO_FIMP=4629
  ```

## 🔧 Como Gerar Relatório de Inadimplência

### Opção 1: Usando a função utilitária (Recomendado)

```typescript
import { gerarRelatorioInadimplencia } from '../utils/relatorios'

// Gerar PDF de inadimplência
const resultado = await gerarRelatorioInadimplencia(token, {
  idCondominio: '28',
  posicaoEm: '16/11/2025', // Data de referência (DD/MM/YYYY)
  comValoresAtualizados: false,
  apenasResumoInad: false,
  cobrancaDoTipo: 'normal', // 'normal' | 'INADIMPLENTE' | 'ACORDO' | 'EXTRA'
  semAcordo: true,
  semProcesso: false,
  idUnidade: '', // Opcional: ID específico da unidade
  render: 'pdf', // 'pdf' | 'html' | 'json'
  getId: true // Se true, retorna ID da fila de impressão
})

if (resultado.idImpressao) {
  console.log('Relatório na fila:', resultado.idImpressao)
  // Verificar status depois com obterStatusImpressao()
} else if (resultado.url) {
  window.open(resultado.url, '_blank')
}
```

### Opção 2: Usando endpoint direto (se houver código específico)

Se a API tiver um código específico para relatório de inadimplência (ex: `WXXX` ou `INAD`):

```typescript
import { gerarRelatorioPorCodigo } from '../utils/relatorios'

const resultado = await gerarRelatorioPorCodigo(
  token,
  'WXXX', // Código do relatório (a ser verificado na API)
  '28', // ID do condomínio
  {
    // Parâmetros adicionais específicos do relatório
    POSICAO_EM: '16/11/2025',
    COBRANCA_DO_TIPO: 'normal'
  },
  'pdf', // render
  true // getId
)
```

### Opção 3: Endpoint direto de inadimplência

```typescript
// Usando o endpoint de inadimplência com render=pdf
const url = `/api/condominios/superlogica/inadimplencia/index?` +
  `idCondominio=28&` +
  `posicaoEm=16/11/2025&` +
  `comValoresAtualizados=0&` +
  `apenasResumoInad=0&` +
  `cobrancaDoTipo=normal&` +
  `semAcordo=1&` +
  `semProcesso=0&` +
  `render=pdf&` +
  `getId=1`

const response = await api.get(url)
```

## 📝 Exemplos de Uso

### Exemplo 1: Gerar PDF e abrir em nova aba

```typescript
const resultado = await gerarRelatorioInadimplencia(token, {
  idCondominio: condominioSelecionado,
  posicaoEm: new Date().toLocaleDateString('pt-BR'),
  render: 'pdf',
  getId: false // Retorna URL direta
})

if (resultado.url) {
  window.open(resultado.url, '_blank')
}
```

### Exemplo 2: Gerar na fila e verificar status

```typescript
// Gerar relatório na fila
const resultado = await gerarRelatorioInadimplencia(token, {
  idCondominio: condominioSelecionado,
  render: 'pdf',
  getId: true
})

if (resultado.idImpressao) {
  // Aguardar alguns segundos e verificar status
  setTimeout(async () => {
    const status = await obterStatusImpressao(token, resultado.idImpressao)
    if (status.url) {
      window.open(status.url, '_blank')
    }
  }, 5000)
}
```

### Exemplo 3: Gerar relatório de balanço

```typescript
import { gerarRelatorioBalanco } from '../utils/relatorios'

const dados = await gerarRelatorioBalanco(
  token,
  '28', // ID condomínio
  '01/01/2025', // Data início
  '31/12/2025', // Data fim
  true // Agrupado por mês
)
```

## 🎯 Padrão dos Relatórios

Todos os relatórios seguem um padrão similar:

1. **Endpoint base**: `/api/condominios/superlogica/relatorios/id/{CODIGO}`
2. **Parâmetros obrigatórios**: `ID_CONDOMINIO_COND`
3. **Parâmetros opcionais**: Específicos de cada relatório
4. **Renderização**: 
   - `render=pdf` → Gera PDF
   - `render=html` → Gera HTML
   - Sem `render` → Retorna JSON
5. **Fila de impressão**: 
   - `getId=1` → Retorna apenas `id_impressao_fimp`
   - Use `obterStatusImpressao()` para verificar quando estiver pronto

## ⚠️ Notas Importantes

1. **Formato de data**: Sempre use `DD/MM/YYYY` (ex: `16/11/2025`)
2. **Códigos de relatório**: Os códigos como `W025A`, `W046A` são específicos da API Superlógica
3. **Fila de impressão**: Relatórios grandes podem demorar alguns segundos para processar
4. **Token**: Sempre use um token válido no header `Authorization: Bearer {token}`
5. **Company ID**: O header `x-company-id` é necessário (geralmente configurado automaticamente)

## 🔍 Verificando Códigos de Relatórios Disponíveis

Para descobrir códigos de relatórios de inadimplência disponíveis, você pode:

1. Consultar a documentação da API Superlógica
2. Verificar no sistema web quais relatórios estão disponíveis
3. Tentar códigos comuns como: `W001`, `W002`, `INAD`, `INADIMPLENCIA`

## 📚 Funções Disponíveis

Todas as funções estão em `src/utils/relatorios.ts`:

- `gerarRelatorioInadimplencia()` - Gera relatório de inadimplência
- `gerarRelatorioPorCodigo()` - Gera relatório por código específico
- `gerarRelatorioBalanco()` - Gera relatório de balanço (W011A)
- `obterStatusImpressao()` - Verifica status de impressão na fila

