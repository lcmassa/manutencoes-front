# Arquitetura de Banco de Dados - Manutenções

Este documento descreve a arquitetura de banco de dados PostgreSQL para arquivamento dos dados de manutenções.

## 📋 Estrutura

### Schema: `manutencoes`

O schema PostgreSQL contém 3 tabelas principais:

1. **`tipos_itens_customizados`** - Tipos de itens customizados criados pelos usuários
2. **`itens_manutencao`** - Registros de manutenção por condomínio
3. **`itens_excluidos`** - Registro de itens excluídos permanentemente

### Views

- **`vw_estatisticas_condominio`** - Estatísticas agregadas por condomínio
- **`vw_alertas_vencimento`** - Alertas de itens próximos do vencimento ou vencidos

## 🚀 Instalação

### 1. Criar o Schema

Execute o arquivo SQL no PostgreSQL:

```bash
psql -U seu_usuario -d seu_banco -f database/schema.sql
```

Ou via interface gráfica (pgAdmin, DBeaver, etc.) execute o conteúdo de `schema.sql`.

### 2. Configurar Variáveis de Ambiente

No backend, configure as variáveis de conexão:

```env
DATABASE_URL=postgresql://usuario:senha@localhost:5432/nome_banco
DB_SCHEMA=manutencoes
```

## 🔌 Integração com Backend

### Endpoints Necessários

O frontend espera os seguintes endpoints na API:

#### Tipos Customizados

- `POST /api/manutencoes/tipos/sincronizar` - Sincronizar múltiplos tipos
- `GET /api/manutencoes/tipos?company_id={id}` - Buscar tipos por empresa

#### Itens de Manutenção

- `POST /api/manutencoes/itens/sincronizar` - Sincronizar múltiplos itens
- `GET /api/manutencoes/itens?company_id={id}&id_condominio={id}` - Buscar itens
- `POST /api/manutencoes/itens` - Criar item
- `PUT /api/manutencoes/itens/{id}` - Atualizar item
- `DELETE /api/manutencoes/itens/{id}` - Excluir item

#### Itens Excluídos

- `POST /api/manutencoes/excluidos/sincronizar` - Sincronizar lista de excluídos
- `GET /api/manutencoes/excluidos?company_id={id}` - Buscar itens excluídos
- `POST /api/manutencoes/excluidos` - Registrar item excluído

### Exemplo de Controller (Node.js/Express)

```typescript
import { Router } from 'express'
import { pool } from './db' // Sua conexão PostgreSQL

const router = Router()

// Sincronizar tipos customizados
router.post('/tipos/sincronizar', async (req, res) => {
  const { tipos } = req.body
  const companyId = req.headers['x-company-id'] as string
  
  try {
    // Upsert (insert ou update) para cada tipo
    for (const tipo of tipos) {
      await pool.query(`
        INSERT INTO manutencoes.tipos_itens_customizados 
        (id, nome, categoria, periodicidade_meses, obrigatorio, descricao_padrao, id_empresa, id_usuario)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) 
        DO UPDATE SET
          nome = EXCLUDED.nome,
          categoria = EXCLUDED.categoria,
          periodicidade_meses = EXCLUDED.periodicidade_meses,
          obrigatorio = EXCLUDED.obrigatorio,
          descricao_padrao = EXCLUDED.descricao_padrao,
          data_atualizacao = CURRENT_TIMESTAMP
      `, [
        tipo.id, tipo.nome, tipo.categoria, tipo.periodicidade_meses,
        tipo.obrigatorio, tipo.descricao_padrao, companyId, tipo.id_usuario
      ])
    }
    
    res.json({ success: true, count: tipos.length })
  } catch (error) {
    console.error('Erro ao sincronizar tipos:', error)
    res.status(500).json({ error: 'Erro ao sincronizar tipos' })
  }
})

// Buscar tipos customizados
router.get('/tipos', async (req, res) => {
  const companyId = req.query.company_id as string
  
  try {
    const result = await pool.query(
      'SELECT * FROM manutencoes.tipos_itens_customizados WHERE id_empresa = $1',
      [companyId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar tipos:', error)
    res.status(500).json({ error: 'Erro ao buscar tipos' })
  }
})

// Sincronizar itens de manutenção
router.post('/itens/sincronizar', async (req, res) => {
  const { itens } = req.body
  const companyId = req.headers['x-company-id'] as string
  
  try {
    for (const item of itens) {
      await pool.query(`
        INSERT INTO manutencoes.itens_manutencao (
          id, id_condominio, nome_condominio, tipo_item_id, tipo_item_nome,
          categoria, data_ultima_manutencao, data_proxima_manutencao,
          data_vencimento_garantia, periodicidade_meses, fornecedor,
          telefone_contato, email_contato, numero_contrato, valor_contrato,
          laudo_tecnico, certificado, observacoes, status, prioridade,
          id_empresa, id_usuario
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (id)
        DO UPDATE SET
          id_condominio = EXCLUDED.id_condominio,
          nome_condominio = EXCLUDED.nome_condominio,
          tipo_item_id = EXCLUDED.tipo_item_id,
          tipo_item_nome = EXCLUDED.tipo_item_nome,
          categoria = EXCLUDED.categoria,
          data_ultima_manutencao = EXCLUDED.data_ultima_manutencao,
          data_proxima_manutencao = EXCLUDED.data_proxima_manutencao,
          data_vencimento_garantia = EXCLUDED.data_vencimento_garantia,
          periodicidade_meses = EXCLUDED.periodicidade_meses,
          fornecedor = EXCLUDED.fornecedor,
          telefone_contato = EXCLUDED.telefone_contato,
          email_contato = EXCLUDED.email_contato,
          numero_contrato = EXCLUDED.numero_contrato,
          valor_contrato = EXCLUDED.valor_contrato,
          laudo_tecnico = EXCLUDED.laudo_tecnico,
          certificado = EXCLUDED.certificado,
          observacoes = EXCLUDED.observacoes,
          status = EXCLUDED.status,
          prioridade = EXCLUDED.prioridade,
          data_atualizacao = CURRENT_TIMESTAMP
      `, [
        item.id, item.id_condominio, item.nome_condominio, item.tipo_item_id,
        item.tipo_item_nome, item.categoria, item.data_ultima_manutencao,
        item.data_proxima_manutencao, item.data_vencimento_garantia,
        item.periodicidade_meses, item.fornecedor, item.telefone_contato,
        item.email_contato, item.numero_contrato, item.valor_contrato,
        item.laudo_tecnico, item.certificado, item.observacoes,
        item.status, item.prioridade, companyId, item.id_usuario
      ])
    }
    
    res.json({ success: true, count: itens.length })
  } catch (error) {
    console.error('Erro ao sincronizar itens:', error)
    res.status(500).json({ error: 'Erro ao sincronizar itens' })
  }
})

// Buscar itens de manutenção
router.get('/itens', async (req, res) => {
  const companyId = req.query.company_id as string
  const idCondominio = req.query.id_condominio as string | undefined
  
  try {
    let query = 'SELECT * FROM manutencoes.itens_manutencao WHERE id_empresa = $1'
    const params: any[] = [companyId]
    
    if (idCondominio) {
      query += ' AND id_condominio = $2'
      params.push(idCondominio)
    }
    
    query += ' ORDER BY nome_condominio, tipo_item_nome'
    
    const result = await pool.query(query, params)
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar itens:', error)
    res.status(500).json({ error: 'Erro ao buscar itens' })
  }
})

// Sincronizar itens excluídos
router.post('/excluidos/sincronizar', async (req, res) => {
  const { excluidos } = req.body
  const companyId = req.headers['x-company-id'] as string
  
  try {
    for (const excluido of excluidos) {
      await pool.query(`
        INSERT INTO manutencoes.itens_excluidos 
        (id_condominio, tipo_item_id, chave, id_empresa, id_usuario)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (id_condominio, tipo_item_id, id_empresa)
        DO NOTHING
      `, [
        excluido.id_condominio, excluido.tipo_item_id, excluido.chave,
        companyId, excluido.id_usuario
      ])
    }
    
    res.json({ success: true, count: excluidos.length })
  } catch (error) {
    console.error('Erro ao sincronizar excluídos:', error)
    res.status(500).json({ error: 'Erro ao sincronizar excluídos' })
  }
})

// Buscar itens excluídos
router.get('/excluidos', async (req, res) => {
  const companyId = req.query.company_id as string
  
  try {
    const result = await pool.query(
      'SELECT chave FROM manutencoes.itens_excluidos WHERE id_empresa = $1',
      [companyId]
    )
    res.json(result.rows)
  } catch (error) {
    console.error('Erro ao buscar excluídos:', error)
    res.status(500).json({ error: 'Erro ao buscar excluídos' })
  }
})

export default router
```

## 🔄 Estratégia de Sincronização

### Modo Híbrido (Recomendado)

1. **LocalStorage como cache primário** - Dados são salvos localmente primeiro
2. **Sincronização em background** - Dados são enviados ao banco periodicamente
3. **Fallback** - Se o banco falhar, usar localStorage

### Sincronização Automática

- Ao salvar/editar/excluir item → Salvar no localStorage + Enviar ao banco
- Ao carregar página → Buscar do banco primeiro, fallback para localStorage
- Sincronização periódica → A cada 5 minutos ou ao fechar a página

## 📊 Queries Úteis

### Estatísticas por Condomínio

```sql
SELECT * FROM manutencoes.vw_estatisticas_condominio 
WHERE id_empresa = 'seu_company_id'
ORDER BY vencidos DESC, proximo_vencimento DESC;
```

### Alertas de Vencimento

```sql
SELECT * FROM manutencoes.vw_alertas_vencimento 
WHERE id_empresa = 'seu_company_id'
ORDER BY data_proxima_manutencao ASC;
```

### Itens por Categoria

```sql
SELECT 
    categoria,
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE status = 'vencido') as vencidos
FROM manutencoes.itens_manutencao
WHERE id_empresa = 'seu_company_id'
GROUP BY categoria;
```

## 🔒 Segurança

- Todos os endpoints devem validar `x-company-id` no header
- Usar autenticação JWT para validar usuário
- Implementar rate limiting para evitar abuso
- Validar todos os dados antes de inserir no banco
- Usar prepared statements para prevenir SQL injection

## 📝 Notas

- O schema usa `VARCHAR` para IDs pois podem vir do sistema externo (Superlógica)
- As datas são armazenadas como `DATE` ou `TIMESTAMP WITH TIME ZONE`
- Os valores monetários usam `DECIMAL(12, 2)` para precisão
- Os índices foram criados para otimizar consultas frequentes
