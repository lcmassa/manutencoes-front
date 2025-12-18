// src/lib/manutencoes-db.ts
// Funções para interagir com o banco de dados de manutenções

import api from './api'

// =====================================================
// TIPOS DO BANCO DE DADOS
// =====================================================

export type CategoriaItemDB = 'equipamento' | 'estrutura' | 'administrativo'
export type StatusManutencaoDB = 'em_dia' | 'proximo_vencimento' | 'vencido' | 'nao_iniciado'
export type PrioridadeDB = 'baixa' | 'media' | 'alta' | 'critica'

export interface TipoItemManutencaoDB {
  id: string
  nome: string
  categoria: CategoriaItemDB
  periodicidade_meses: number
  obrigatorio: boolean
  descricao_padrao: string
  id_empresa?: string
}

export interface ItemManutencaoDB {
  id: string
  id_condominio: string
  nome_condominio: string
  tipo_item_id: string
  tipo_item_nome: string
  categoria: CategoriaItemDB
  data_ultima_manutencao: string | null
  data_proxima_manutencao: string | null
  data_vencimento_garantia: string | null
  periodicidade_meses: number
  fornecedor: string
  telefone_contato: string
  email_contato: string
  numero_contrato: string
  valor_contrato: number
  laudo_tecnico: string
  certificado: string
  observacoes: string
  status: StatusManutencaoDB
  prioridade: PrioridadeDB
  id_empresa: string
  data_criacao?: string
  data_atualizacao?: string
}

export interface DadosCompletosDB {
  tipos: TipoItemManutencaoDB[]
  itens: ItemManutencaoDB[]
  excluidos: string[]
}

// =====================================================
// FUNÇÕES DE API
// =====================================================

/**
 * Busca todos os dados de manutenções do banco de dados
 */
export async function buscarTodosDados(idEmpresa: string): Promise<DadosCompletosDB> {
  try {
    console.log('[ManutencoesDB] Buscando todos os dados do banco...')
    
    const response = await api.get<DadosCompletosDB>(
      `/api/manutencoes/empresa/${idEmpresa}`
    )
    
    console.log('[ManutencoesDB] ✅ Dados recebidos do banco:', {
      tipos: response.data.tipos?.length || 0,
      itens: response.data.itens?.length || 0,
      excluidos: response.data.excluidos?.length || 0,
    })
    
    return {
      tipos: response.data.tipos || [],
      itens: response.data.itens || [],
      excluidos: response.data.excluidos || [],
    }
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao buscar dados:', error)
    
    // Se o endpoint não existir (404) ou não estiver implementado (501), retornar vazio
    const status = error?.response?.status
    if (status === 404 || status === 501) {
      console.log('[ManutencoesDB] Endpoint não disponível, retornando dados vazios')
      return { tipos: [], itens: [], excluidos: [] }
    }
    
    throw error
  }
}

/**
 * Sincroniza todos os dados de manutenções com o banco de dados
 */
export async function sincronizarTodosDados(
  tipos: TipoItemManutencaoDB[],
  itens: ItemManutencaoDB[],
  excluidos: string[],
  idEmpresa: string
): Promise<void> {
  try {
    console.log('[ManutencoesDB] Sincronizando dados com o banco...', {
      tipos: tipos.length,
      itens: itens.length,
      excluidos: excluidos.length,
    })
    
    const payload = {
      tipos,
      itens,
      excluidos,
      id_empresa: idEmpresa,
    }
    
    await api.post(
      `/api/manutencoes/empresa/${idEmpresa}/sincronizar`,
      payload
    )
    
    console.log('[ManutencoesDB] ✅ Sincronização concluída com sucesso')
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao sincronizar:', error)
    
    // Se o endpoint não existir (404) ou não estiver implementado (501), apenas logar
    const status = error?.response?.status
    if (status === 404 || status === 501) {
      console.log('[ManutencoesDB] Endpoint não disponível, ignorando sincronização')
      return
    }
    
    throw error
  }
}

/**
 * Registra um item excluído no banco de dados
 */
export async function registrarItemExcluido(
  idCondominio: string,
  tipoItemId: string,
  idEmpresa: string
): Promise<void> {
  try {
    console.log('[ManutencoesDB] Registrando item excluído...', {
      idCondominio,
      tipoItemId,
    })
    
    await api.post(
      `/api/manutencoes/empresa/${idEmpresa}/excluidos`,
      {
        id_condominio: idCondominio,
        tipo_item_id: tipoItemId,
        id_empresa: idEmpresa,
      }
    )
    
    console.log('[ManutencoesDB] ✅ Item excluído registrado')
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao registrar item excluído:', error)
    
    // Se o endpoint não existir (404) ou não estiver implementado (501), apenas logar
    const status = error?.response?.status
    if (status === 404 || status === 501) {
      console.log('[ManutencoesDB] Endpoint não disponível, ignorando registro')
      return
    }
    
    throw error
  }
}

/**
 * Verifica se já existem dados no banco para uma empresa
 */
export async function verificarDadosExistentes(idEmpresa: string): Promise<boolean> {
  try {
    const dados = await buscarTodosDados(idEmpresa)
    return dados.itens.length > 0 || dados.tipos.length > 0
  } catch (error: any) {
    const status = error?.response?.status
    if (status === 404 || status === 501) {
      return false
    }
    throw error
  }
}
