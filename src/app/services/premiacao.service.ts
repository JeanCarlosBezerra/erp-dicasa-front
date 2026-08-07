import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  BonusVendedor,
  BonusGestor,
  FaixaBonusVendedor,
  ParametroIndicadorGestor,
} from '../models/premiacao.model';

// ─────────────────────────────────────────────────────────────────────────────
// PremiacaoService
//
// ⚠️ MOCK — dados fake para o protótipo de apresentação.
// Quando o backend estiver pronto, trocar os `of(...)` por chamadas HttpClient
// para /comercial/premiacao/vendedor e /comercial/premiacao/gestor.
// Os números abaixo vieram das planilhas reais de Junho/26 para dar realismo.
// ─────────────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class PremiacaoService {

  /** Faixas oficiais do bônus do vendedor (Regras da Diretoria) */
  private readonly faixasVendedor: FaixaBonusVendedor[] = [
    { faixa: 1, valorVenda: 180000, margemMeta: 0.31, vlLucratividade: 55800,  premiacao: 100 },
    { faixa: 2, valorVenda: 230000, margemMeta: 0.31, vlLucratividade: 71300,  premiacao: 150 },
    { faixa: 3, valorVenda: 300000, margemMeta: 0.31, vlLucratividade: 93000,  premiacao: 200 },
    { faixa: 4, valorVenda: 450000, margemMeta: 0.31, vlLucratividade: 139500, premiacao: 250 },
  ];

  /** Percentuais dos indicadores do gestor (editável pelo RH) */
  private readonly parametrosGestor: ParametroIndicadorGestor[] = [
    { indicador: 'Faturamento',  metaMinima: 1, premioPerc: 0.16 },
    { indicador: 'Margem',       metaMinima: 1, premioPerc: 0.14 },
    { indicador: 'Ticket Médio', metaMinima: 1, premioPerc: 0.13 },
  ];

  getFaixasVendedor(): FaixaBonusVendedor[] {
    return this.faixasVendedor;
  }

  getParametrosGestor(): ParametroIndicadorGestor[] {
    return this.parametrosGestor;
  }

  // ── VENDEDORES (mock com dados reais de Junho/26) ──
  getBonusVendedores(): Observable<BonusVendedor[]> {
    const dados: BonusVendedor[] = [
      { idVendedor: 116995, nome: 'MAURICIO CRISTIANO FONSECA PINHEIRO', loja: 'HCAB', setor: 'PADRAO',
        vendaRealizada: 363163.98, lucroRealizado: 105811.29,
        faixaFaturamento: 3, faixaLucratividade: 3, faixaElegivel: 3, premiacao: 200 },
      { idVendedor: 1796, nome: 'ALESSANDRA DA SILVA BARBOZA', loja: 'HCAB', setor: 'PADRAO',
        vendaRealizada: 269129.04, lucroRealizado: 81369.97,
        faixaFaturamento: 2, faixaLucratividade: 2, faixaElegivel: 2, premiacao: 150 },
      { idVendedor: 1813, nome: 'ANTONIO ELIAS ALVES CONCEICAO', loja: 'HCAB', setor: 'PADRAO',
        vendaRealizada: 263517.86, lucroRealizado: 73940.35,
        faixaFaturamento: 2, faixaLucratividade: 2, faixaElegivel: 2, premiacao: 150 },
      { idVendedor: 125953, nome: 'RENATO DA CONCEICAO COSTA', loja: 'HCAB', setor: 'PADRAO',
        vendaRealizada: 236331.87, lucroRealizado: 54501.45,
        faixaFaturamento: 2, faixaLucratividade: 1, faixaElegivel: 1, premiacao: 100,
        observacao: 'Dobradinha: faturamento faixa 2, lucratividade faixa 1 → prevalece faixa 1' },
      { idVendedor: 1099860, nome: 'WANDERSON NASCIMENTO DE SOUZA', loja: 'HCVR', setor: 'PADRAO',
        vendaRealizada: 314431.78, lucroRealizado: 82555.79,
        faixaFaturamento: 3, faixaLucratividade: 2, faixaElegivel: 2, premiacao: 150,
        observacao: 'Dobradinha: faturamento faixa 3, lucratividade faixa 2 → prevalece faixa 2' },
      { idVendedor: 223344, nome: 'FRANCIVALDO JUNIOR DE AVIZ ARAUJO', loja: 'HCVR', setor: 'PADRAO',
        vendaRealizada: 203525.08, lucroRealizado: 64112.23,
        faixaFaturamento: 1, faixaLucratividade: 1, faixaElegivel: 1, premiacao: 100 },
      { idVendedor: 149889, nome: 'BRENO DE CASSIO SOUZA ROSARIO', loja: 'HCAM', setor: 'PADRAO',
        vendaRealizada: 327915.48, lucroRealizado: 87605.67,
        faixaFaturamento: 3, faixaLucratividade: 2, faixaElegivel: 2, premiacao: 150,
        observacao: 'Dobradinha: faturamento faixa 3, lucratividade faixa 2 → prevalece faixa 2' },
      { idVendedor: 1015684, nome: 'ALEX GLEDSON DOS SANTOS BRITO', loja: 'ATACADO', setor: 'ATACADO',
        vendaRealizada: 497458.28, lucroRealizado: 140497.68,
        faixaFaturamento: 4, faixaLucratividade: 4, faixaElegivel: 4, premiacao: 250 },
      { idVendedor: 176467, nome: 'CRISTIAN DA COSTA AWE', loja: 'ATACADO', setor: 'ATACADO',
        vendaRealizada: 359691.91, lucroRealizado: 104151.43,
        faixaFaturamento: 3, faixaLucratividade: 3, faixaElegivel: 3, premiacao: 200 },
      // Exemplo de bloqueio por setor (fictício p/ ilustrar a regra):
      { idVendedor: 999001, nome: 'EXEMPLO VENDEDOR PISOS (faixa 1)', loja: 'CONCEPT', setor: 'PISOS',
        vendaRealizada: 195000, lucroRealizado: 60000,
        faixaFaturamento: 1, faixaLucratividade: 1, faixaElegivel: 0, premiacao: 0,
        observacao: 'Setor PISOS/Atacado/Concept: elegível somente a partir da faixa 2 (230K)' },
    ];
    return of(dados).pipe(delay(300)); // simula latência de rede
  }

  // ── GESTORES (mock com dados reais do Excel de premiação) ──
  getBonusGestores(): Observable<BonusGestor[]> {
    const dados: BonusGestor[] = [
      this.montaGestor(1, 'Pedro Daltro',       4900000, 3591440.69, 1519000, 1017985.64, 535,  471.38,  120000),
      this.montaGestor(2, 'Cinthia Diniz',      4900000, 3591440.69, 1519000, 1017985.64, 535,  471.38,  120000),
      this.montaGestor(3, 'Dynahina Pinheiro',  3100000, 2151882.80, 961000,  645349.65,  545,  576.14,  90000),
      this.montaGestor(4, 'Natália Coeli',      3100000, 2151882.80, 961000,  645349.65,  545,  576.14,  90000),
      this.montaGestor(5, 'Elizabeth Furtado',  1500000, 1251397.02, 465000,  325988.92,  425,  536.39,  70000),
      this.montaGestor(6, 'Luiz Fernando',      1500000, 1251397.02, 465000,  325988.92,  425,  536.39,  70000),
      this.montaGestor(7, 'Andrea Furtado',     1900000, 1923587.67, 627000,  536873.32,  4900, 5622.83, 80000),
      this.montaGestor(8, 'Silvana Leão',       1900000, 1923587.67, 627000,  536873.32,  4900, 5622.83, 80000),
      this.montaGestor(9, 'Cíntia Santos',      400000,  219124.01,  124000,  68695.38,   128.52, 144.26, 30000),
    ];
    return of(dados).pipe(delay(300));
  }

  /** Monta um gestor aplicando as regras dos 3 indicadores + teto 50% */
  private montaGestor(
    id: number, nome: string,
    metaFat: number, atingFat: number,
    metaMg: number, atingMg: number,
    metaTm: number, atingTm: number,
    prestacao: number,
  ): BonusGestor {
    const p = this.parametrosGestor;
    const ind = (meta: number, ating: number, perc: number) => {
      const percentual = meta ? ating / meta : 0;
      return { meta, atingido: ating, percentual, premioPerc: percentual >= 1 ? perc : 0 };
    };
    const faturamento = ind(metaFat, atingFat, p[0].premioPerc);
    const margem      = ind(metaMg,  atingMg,  p[1].premioPerc);
    const ticketMedio = ind(metaTm,  atingTm,  p[2].premioPerc);

    let total = faturamento.premioPerc + margem.premioPerc + ticketMedio.premioPerc;
    if (total > 0.5) total = 0.5; // teto de 50%

    return {
      idGestor: id, nome, prestacaoServico: prestacao,
      faturamento, margem, ticketMedio,
      premioTotalPerc: total,
      premiacao: prestacao * total,
    };
  }
}