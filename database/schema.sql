-- =====================================================
-- SCHEMA POSTGRESQL PARA ARQUIVAMENTO DE DADOS DE MANUTENÇÕES
-- =====================================================

-- Schema para isolamento dos dados
CREATE SCHEMA IF NOT EXISTS manutencoes;

-- Tabela de tipos de itens customizados
CREATE TABLE IF NOT EXISTS manutencoes.tipos_itens_customizados (
    id VARCHAR(255) PRIMARY KEY,
    nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('equipamento', 'estrutura', 'administrativo')),
    periodicidade_meses INTEGER NOT NULL DEFAULT 6,
    obrigatorio BOOLEAN NOT NULL DEFAULT false,
    descricao_padrao TEXT,
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_usuario VARCHAR(255), -- ID do usuário que criou
    id_empresa VARCHAR(255)  -- ID da empresa/company
);

-- Tabela de itens de manutenção
CREATE TABLE IF NOT EXISTS manutencoes.itens_manutencao (
    id VARCHAR(255) PRIMARY KEY,
    id_condominio VARCHAR(255) NOT NULL,
    nome_condominio VARCHAR(255) NOT NULL,
    tipo_item_id VARCHAR(255) NOT NULL,
    tipo_item_nome VARCHAR(255) NOT NULL,
    categoria VARCHAR(50) NOT NULL CHECK (categoria IN ('equipamento', 'estrutura', 'administrativo')),
    
    -- Datas
    data_ultima_manutencao DATE,
    data_proxima_manutencao DATE,
    data_vencimento_garantia DATE,
    periodicidade_meses INTEGER NOT NULL DEFAULT 6,
    
    -- Fornecedor/Contrato
    fornecedor VARCHAR(255),
    telefone_contato VARCHAR(50),
    email_contato VARCHAR(255),
    numero_contrato VARCHAR(100),
    valor_contrato DECIMAL(12, 2) DEFAULT 0,
    
    -- Documentação
    laudo_tecnico TEXT,
    certificado TEXT,
    observacoes TEXT,
    
    -- Status
    status VARCHAR(50) NOT NULL CHECK (status IN ('em_dia', 'proximo_vencimento', 'vencido', 'nao_iniciado')),
    prioridade VARCHAR(50) NOT NULL DEFAULT 'media' CHECK (prioridade IN ('baixa', 'media', 'alta', 'critica')),
    
    -- Metadados
    data_criacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    data_atualizacao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_usuario VARCHAR(255), -- ID do usuário que criou/editou
    id_empresa VARCHAR(255) NOT NULL, -- ID da empresa/company
    
    -- Índices para performance
    CONSTRAINT fk_tipo_item FOREIGN KEY (tipo_item_id) 
        REFERENCES manutencoes.tipos_itens_customizados(id) ON DELETE SET NULL
);

-- Tabela de itens excluídos permanentemente
CREATE TABLE IF NOT EXISTS manutencoes.itens_excluidos (
    id SERIAL PRIMARY KEY,
    id_condominio VARCHAR(255) NOT NULL,
    tipo_item_id VARCHAR(255) NOT NULL,
    chave VARCHAR(255) NOT NULL UNIQUE, -- idCondominio_tipoItemId
    data_exclusao TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    id_usuario VARCHAR(255),
    id_empresa VARCHAR(255) NOT NULL,
    
    -- Índice único para evitar duplicatas
    CONSTRAINT uk_condominio_tipo UNIQUE (id_condominio, tipo_item_id, id_empresa)
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_itens_condominio ON manutencoes.itens_manutencao(id_condominio);
CREATE INDEX IF NOT EXISTS idx_itens_empresa ON manutencoes.itens_manutencao(id_empresa);
CREATE INDEX IF NOT EXISTS idx_itens_status ON manutencoes.itens_manutencao(status);
CREATE INDEX IF NOT EXISTS idx_itens_proxima_manutencao ON manutencoes.itens_manutencao(data_proxima_manutencao);
CREATE INDEX IF NOT EXISTS idx_tipos_empresa ON manutencoes.tipos_itens_customizados(id_empresa);
CREATE INDEX IF NOT EXISTS idx_excluidos_empresa ON manutencoes.itens_excluidos(id_empresa);
CREATE INDEX IF NOT EXISTS idx_excluidos_chave ON manutencoes.itens_excluidos(chave);

-- Função para atualizar data_atualizacao automaticamente
CREATE OR REPLACE FUNCTION manutencoes.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.data_atualizacao = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar data_atualizacao
CREATE TRIGGER update_tipos_updated_at
    BEFORE UPDATE ON manutencoes.tipos_itens_customizados
    FOR EACH ROW
    EXECUTE FUNCTION manutencoes.update_updated_at_column();

CREATE TRIGGER update_itens_updated_at
    BEFORE UPDATE ON manutencoes.itens_manutencao
    FOR EACH ROW
    EXECUTE FUNCTION manutencoes.update_updated_at_column();

-- View para estatísticas por condomínio
CREATE OR REPLACE VIEW manutencoes.vw_estatisticas_condominio AS
SELECT 
    id_empresa,
    id_condominio,
    nome_condominio,
    COUNT(*) as total_itens,
    COUNT(*) FILTER (WHERE status = 'em_dia') as em_dia,
    COUNT(*) FILTER (WHERE status = 'proximo_vencimento') as proximo_vencimento,
    COUNT(*) FILTER (WHERE status = 'vencido') as vencidos,
    COUNT(*) FILTER (WHERE status = 'nao_iniciado') as nao_iniciados,
    COUNT(*) FILTER (WHERE data_proxima_manutencao < CURRENT_DATE) as vencidos_por_data
FROM manutencoes.itens_manutencao
GROUP BY id_empresa, id_condominio, nome_condominio;

-- View para alertas de vencimento
CREATE OR REPLACE VIEW manutencoes.vw_alertas_vencimento AS
SELECT 
    id,
    id_condominio,
    nome_condominio,
    tipo_item_nome,
    data_proxima_manutencao,
    data_vencimento_garantia,
    status,
    CASE 
        WHEN data_proxima_manutencao < CURRENT_DATE THEN 'vencido'
        WHEN data_proxima_manutencao <= CURRENT_DATE + INTERVAL '30 days' THEN 'proximo_vencimento'
        ELSE 'em_dia'
    END as alerta_status,
    CURRENT_DATE - data_proxima_manutencao as dias_vencido
FROM manutencoes.itens_manutencao
WHERE data_proxima_manutencao IS NOT NULL
    AND (data_proxima_manutencao < CURRENT_DATE OR data_proxima_manutencao <= CURRENT_DATE + INTERVAL '30 days')
ORDER BY data_proxima_manutencao ASC;

-- Comentários nas tabelas
COMMENT ON SCHEMA manutencoes IS 'Schema para armazenamento de dados de controle de manutenções de condomínios';
COMMENT ON TABLE manutencoes.tipos_itens_customizados IS 'Tipos de itens de manutenção customizados criados pelos usuários';
COMMENT ON TABLE manutencoes.itens_manutencao IS 'Registros de manutenção por condomínio';
COMMENT ON TABLE manutencoes.itens_excluidos IS 'Registro de itens excluídos permanentemente para evitar recriação';
COMMENT ON VIEW manutencoes.vw_estatisticas_condominio IS 'Estatísticas agregadas por condomínio';
COMMENT ON VIEW manutencoes.vw_alertas_vencimento IS 'Alertas de itens próximos do vencimento ou vencidos';
