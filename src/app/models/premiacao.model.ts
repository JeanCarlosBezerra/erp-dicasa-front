// ─────────────────────────────────────────────────────────────────────────────
// Módulo Premiação Comercial — Models
// Regras da Diretoria (ref.: PDFs "Regras Bônus Vendedor" e "Modelo Gestores")
// ─────────────────────────────────────────────────────────────────────────────

/** Setores com regra de elegibilidade diferenciada */
export type SetorVendedor = 'PADRAO' | 'PISOS' | 'ATACADO' | 'CONCEPT';

/** Faixa de bônus do vendedor (valores absolutos definidos pela Diretoria) */
export interface FaixaBonusVendedor {
  faixa: number;          // 1..4
  valorVenda: number;     // 180000, 230000, 300000, 450000
  margemMeta: number;     // 0.31 (meta da loja)
  vlLucratividade: number;// valorVenda * margemMeta
  premiacao: number;      // 100, 150, 200, 250
}

/** Linha calculada do bônus de um vendedor */
export interface BonusVendedor {
  idVendedor: number;
  nome: string;
  loja: string;
  setor: SetorVendedor;

  vendaRealizada: number;
  lucroRealizado: number;

  faixaFaturamento: number;   // faixa atingida pelo faturamento (0 = nenhuma)
  faixaLucratividade: number; // faixa atingida pela lucratividade (0 = nenhuma)
  faixaElegivel: number;      // MIN das duas (regra da "dobradinha"), respeitando setor
  premiacao: number;          // valor final em R$
  observacao?: string;        // ex.: "Setor PISOS: elegível a partir da faixa 2"
}

/** Indicador do gestor (Faturamento / Margem / Ticket Médio) */
export interface IndicadorGestor {
  meta: number;
  atingido: number;
  percentual: number;   // atingido / meta
  premioPerc: number;   // % liberado se bateu a meta (senão 0)
}

/** Linha calculada do bônus de um gestor */
export interface BonusGestor {
  idGestor: number;
  nome: string;
  prestacaoServico: number;   // base sobre a qual o % é aplicado

  faturamento: IndicadorGestor;
  margem: IndicadorGestor;
  ticketMedio: IndicadorGestor;

  premioTotalPerc: number;    // soma dos % (teto 50%)
  premiacao: number;          // prestacaoServico * premioTotalPerc
}

/** Parâmetros editáveis pelo RH (percentuais dos indicadores do gestor) */
export interface ParametroIndicadorGestor {
  indicador: 'Faturamento' | 'Margem' | 'Ticket Médio';
  metaMinima: number;  // 1 (100%)
  premioPerc: number;  // 0.16, 0.14, 0.13
}

/** Gratificação manual lançada pelo RH (assistentes) */
export interface GratificacaoManual {
  id: number;
  nome: string;
  loja: string;
  valor: number;
  motivo: string;
}