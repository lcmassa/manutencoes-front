// src/lib/manutencoes-db.ts
// Funções para sincronizar dados de manutenções com PostgreSQL

import api from './api'

// =====================================================
// TIPOS
// =====================================================

export type TipoItemManutencaoDB = {
  id: string
  nome: string
  categoria: 'equipamento' | 'estrutura' | 'administrativo'
  periodicidade_meses: number
  obrigatorio: boolean
  descricao_padrao: string
  data_criacao?: string
  data_atualizacao?: string
  id_usuario?: string
  id_empresa?: string
}

export type ItemManutencaoDB = {
  id: string
  id_condominio: string
  nome_condominio: string
  tipo_item_id: string
  tipo_item_nome: string
  categoria: 'equipamento' | 'estrutura' | 'administrativo'
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
  status: 'em_dia' | 'proximo_vencimento' | 'vencido' | 'nao_iniciado'
  prioridade: 'baixa' | 'media' | 'alta' | 'critica'
  data_criacao?: string
  data_atualizacao?: string
  id_usuario?: string
  id_empresa: string
}

export type ItemExcluidoDB = {
  id_condominio: string
  tipo_item_id: string
  chave: string
  id_empresa: string
  id_usuario?: string
}

// =====================================================
// CONFIGURAÇÃO
// =====================================================

// URL base da API de manutenções (ajustar conforme necessário)
const API_BASE_URL = '/api/manutencoes'

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO - TIPOS
// =====================================================

/**
 * Sincronizar tipos customizados com o banco
 */
export async function sincronizarTiposCustomizados(
  tipos: TipoItemManutencaoDB[],
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`[ManutencoesDB] Sincronizando ${tipos.length} tipos customizados...`)
    
    const response = await api.post(
      `${API_BASE_URL}/tipos/sincronizar`,
      {
        tipos: tipos.map(t => ({
          ...t,
          id_empresa: companyId,
          id_usuario: userId,
        })),
      },
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Tipos sincronizados:`, response.data)
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao sincronizar tipos:', error)
    throw new Error(`Erro ao sincronizar tipos: ${error.message}`)
  }
}

/**
 * Buscar tipos customizados do banco
 */
export async function buscarTiposCustomizados(companyId: string): Promise<TipoItemManutencaoDB[]> {
  try {
    console.log(`[ManutencoesDB] Buscando tipos customizados...`)
    
    const response = await api.get<TipoItemManutencaoDB[]>(
      `${API_BASE_URL}/tipos?company_id=${companyId}`,
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ ${response.data.length} tipos encontrados`)
    return response.data
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao buscar tipos:', error)
    // Retornar array vazio em caso de erro (fallback para localStorage)
    return []
  }
}

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO - ITENS
// =====================================================

/**
 * Sincronizar itens de manutenção com o banco
 */
export async function sincronizarItensManutencao(
  itens: ItemManutencaoDB[],
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`[ManutencoesDB] Sincronizando ${itens.length} itens de manutenção...`)
    
    const response = await api.post(
      `${API_BASE_URL}/itens/sincronizar`,
      {
        itens: itens.map(item => ({
          ...item,
          id_empresa: companyId,
          id_usuario: userId,
        })),
      },
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Itens sincronizados:`, response.data)
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao sincronizar itens:', error)
    throw new Error(`Erro ao sincronizar itens: ${error.message}`)
  }
}

/**
 * Buscar itens de manutenção do banco
 */
export async function buscarItensManutencao(companyId: string, idCondominio?: string): Promise<ItemManutencaoDB[]> {
  try {
    console.log(`[ManutencoesDB] Buscando itens de manutenção...`)
    
    let url = `${API_BASE_URL}/itens?company_id=${companyId}`
    if (idCondominio) {
      url += `&id_condominio=${idCondominio}`
    }
    
    const response = await api.get<ItemManutencaoDB[]>(url, {
      headers: {
        'x-company-id': companyId,
      },
    })
    
    console.log(`[ManutencoesDB] ✅ ${response.data.length} itens encontrados`)
    return response.data
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao buscar itens:', error)
    // Retornar array vazio em caso de erro (fallback para localStorage)
    return []
  }
}

/**
 * Salvar um único item no banco
 */
export async function salvarItemManutencao(
  item: ItemManutencaoDB,
  companyId: string,
  userId?: string
): Promise<ItemManutencaoDB> {
  try {
    console.log(`[ManutencoesDB] Salvando item ${item.id}...`)
    
    const response = await api.post<ItemManutencaoDB>(
      `${API_BASE_URL}/itens`,
      {
        ...item,
        id_empresa: companyId,
        id_usuario: userId,
      },
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Item salvo`)
    return response.data
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao salvar item:', error)
    throw new Error(`Erro ao salvar item: ${error.message}`)
  }
}

/**
 * Atualizar um item no banco
 */
export async function atualizarItemManutencao(
  item: ItemManutencaoDB,
  companyId: string,
  userId?: string
): Promise<ItemManutencaoDB> {
  try {
    console.log(`[ManutencoesDB] Atualizando item ${item.id}...`)
    
    const response = await api.put<ItemManutencaoDB>(
      `${API_BASE_URL}/itens/${item.id}`,
      {
        ...item,
        id_empresa: companyId,
        id_usuario: userId,
      },
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Item atualizado`)
    return response.data
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao atualizar item:', error)
    throw new Error(`Erro ao atualizar item: ${error.message}`)
  }
}

/**
 * Excluir um item do banco
 */
export async function excluirItemManutencao(
  id: string,
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`[ManutencoesDB] Excluindo item ${id}...`)
    
    await api.delete(
      `${API_BASE_URL}/itens/${id}`,
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Item excluído`)
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao excluir item:', error)
    throw new Error(`Erro ao excluir item: ${error.message}`)
  }
}

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO - EXCLUÍDOS
// =====================================================

/**
 * Sincronizar lista de itens excluídos com o banco
 */
export async function sincronizarItensExcluidos(
  excluidos: ItemExcluidoDB[],
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`[ManutencoesDB] Sincronizando ${excluidos.length} itens excluídos...`)
    
    const response = await api.post(
      `${API_BASE_URL}/excluidos/sincronizar`,
      {
        excluidos: excluidos.map(e => ({
          ...e,
          id_empresa: companyId,
          id_usuario: userId,
        })),
      },
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Itens excluídos sincronizados`)
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao sincronizar excluídos:', error)
    throw new Error(`Erro ao sincronizar excluídos: ${error.message}`)
  }
}

/**
 * Buscar lista de itens excluídos do banco
 */
export async function buscarItensExcluidos(companyId: string): Promise<string[]> {
  try {
    console.log(`[ManutencoesDB] Buscando itens excluídos...`)
    
    const response = await api.get<{ chave: string }[]>(
      `${API_BASE_URL}/excluidos?company_id=${companyId}`,
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    const chaves = response.data.map(e => e.chave)
    console.log(`[ManutencoesDB] ✅ ${chaves.length} itens excluídos encontrados`)
    return chaves
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao buscar excluídos:', error)
    // Retornar array vazio em caso de erro (fallback para localStorage)
    return []
  }
}

/**
 * Registrar item como excluído no banco
 */
export async function registrarItemExcluido(
  idCondominio: string,
  tipoItemId: string,
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`[ManutencoesDB] Registrando item excluído: ${idCondominio}_${tipoItemId}...`)
    
    await api.post(
      `${API_BASE_URL}/excluidos`,
      {
        id_condominio: idCondominio,
        tipo_item_id: tipoItemId,
        chave: `${idCondominio}_${tipoItemId}`,
        id_empresa: companyId,
        id_usuario: userId,
      },
      {
        headers: {
          'x-company-id': companyId,
        },
      }
    )
    
    console.log(`[ManutencoesDB] ✅ Item excluído registrado`)
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao registrar excluído:', error)
    throw new Error(`Erro ao registrar item excluído: ${error.message}`)
  }
}

// =====================================================
// FUNÇÕES DE SINCRONIZAÇÃO COMPLETA
// =====================================================

/**
 * Sincronizar todos os dados (tipos, itens, excluídos) com o banco
 */
export async function sincronizarTodosDados(
  tipos: TipoItemManutencaoDB[],
  itens: ItemManutencaoDB[],
  excluidos: string[],
  companyId: string,
  userId?: string
): Promise<void> {
  try {
    console.log(`[ManutencoesDB] ========== SINCRONIZAÇÃO COMPLETA ==========`)
    console.log(`[ManutencoesDB] Tipos: ${tipos.length}`)
    console.log(`[ManutencoesDB] Itens: ${itens.length}`)
    console.log(`[ManutencoesDB] Excluídos: ${excluidos.length}`)
    
    // Sincronizar em paralelo
    await Promise.all([
      sincronizarTiposCustomizados(tipos, companyId, userId),
      sincronizarItensManutencao(itens, companyId, userId),
      sincronizarItensExcluidos(
        excluidos.map(chave => {
          const [idCondominio, tipoItemId] = chave.split('_')
          return {
            id_condominio: idCondominio,
            tipo_item_id: tipoItemId,
            chave,
            id_empresa: companyId,
            id_usuario: userId,
          }
        }),
        companyId,
        userId
      ),
    ])
    
    console.log(`[ManutencoesDB] ✅ Sincronização completa concluída`)
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro na sincronização completa:', error)
    throw error
  }
}

/**
 * Buscar todos os dados do banco
 */
export async function buscarTodosDados(companyId: string): Promise<{
  tipos: TipoItemManutencaoDB[]
  itens: ItemManutencaoDB[]
  excluidos: string[]
}> {
  try {
    console.log(`[ManutencoesDB] ========== BUSCANDO TODOS OS DADOS ==========`)
    
    const [tipos, itens, excluidos] = await Promise.all([
      buscarTiposCustomizados(companyId),
      buscarItensManutencao(companyId),
      buscarItensExcluidos(companyId),
    ])
    
    console.log(`[ManutencoesDB] ✅ Dados carregados:`)
    console.log(`[ManutencoesDB]   - Tipos: ${tipos.length}`)
    console.log(`[ManutencoesDB]   - Itens: ${itens.length}`)
    console.log(`[ManutencoesDB]   - Excluídos: ${excluidos.length}`)
    
    return { tipos, itens, excluidos }
  } catch (error: any) {
    console.error('[ManutencoesDB] ❌ Erro ao buscar dados:', error)
    throw error
  }
}
