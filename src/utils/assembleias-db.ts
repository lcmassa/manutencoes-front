export interface AssembleiaData {
  id: string
  condominio: string
  sindico: string
  inicio: string
  fim: string
  previsao: string
  realizada: string
}

const STORAGE_KEY = 'assembleias_db'

export function gerarIdAssembleia(condominio: string, sindico: string): string {
  return `${condominio}_${sindico}`.replace(/[^a-zA-Z0-9_]/g, '_')
}

export function carregarAssembleias(): AssembleiaData[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (!data) return []
    return JSON.parse(data)
  } catch (error) {
    console.error('[AssembleiasDB] Erro ao carregar:', error)
    return []
  }
}

export function salvarAssembleias(assembleias: AssembleiaData[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(assembleias))
  } catch (error) {
    console.error('[AssembleiasDB] Erro ao salvar:', error)
  }
}

export function buscarAssembleia(id: string): AssembleiaData | null {
  const assembleias = carregarAssembleias()
  return assembleias.find(a => a.id === id) || null
}

export function salvarAssembleia(assembleia: AssembleiaData): void {
  const assembleias = carregarAssembleias()
  const index = assembleias.findIndex(a => a.id === assembleia.id)
  
  if (index >= 0) {
    assembleias[index] = assembleia
  } else {
    assembleias.push(assembleia)
  }
  
  salvarAssembleias(assembleias)
}

export function salvarAssembleiasEmBatch(assembleias: AssembleiaData[]): void {
  if (assembleias.length === 0) return
  
  const todasAssembleias = carregarAssembleias()
  const map = new Map<string, AssembleiaData>()
  
  // Criar Map de todas as assembleias existentes
  todasAssembleias.forEach(a => map.set(a.id, a))
  
  // Atualizar/inserir novas assembleias
  assembleias.forEach(assembleia => {
    map.set(assembleia.id, assembleia)
  })
  
  // Salvar tudo de uma vez
  salvarAssembleias(Array.from(map.values()))
}

export function atualizarDataRealizada(id: string, dataRealizada: string): void {
  const assembleias = carregarAssembleias()
  const index = assembleias.findIndex(a => a.id === id)
  
  if (index >= 0) {
    assembleias[index].realizada = dataRealizada
    salvarAssembleias(assembleias)
  }
}

export function criarAssembleiaInicial(
  condominio: string,
  sindico: string,
  inicio: string,
  fim: string,
  previsao: string
): AssembleiaData {
  const id = gerarIdAssembleia(condominio, sindico)
  return {
    id,
    condominio,
    sindico,
    inicio,
    fim,
    previsao,
    realizada: ''
  }
}

export function mesclarDadosMandatoComAssembleia(
  condominio: string,
  sindico: string,
  inicio: string,
  fim: string,
  previsao: string,
  assembleiasMap?: Map<string, AssembleiaData>
): AssembleiaData {
  const id = gerarIdAssembleia(condominio, sindico)
  
  // Usar Map em memória se fornecido (muito mais rápido)
  const existente = assembleiasMap?.get(id) || null
  
  if (existente) {
    return {
      ...existente,
      condominio,
      sindico,
      inicio,
      fim,
      previsao
    }
  }
  
  return criarAssembleiaInicial(condominio, sindico, inicio, fim, previsao)
}

