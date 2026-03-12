import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import {
  ResumoExecutivoService
} from '../../../services/resumo-executivo.service';

type AbaResumoExecutivo =
  | 'visao-geral'
  | 'matriz-kraljic'
  | 'pareto'
  | 'top10'
  | 'alertas';

interface ResumoExecutivoBaseItem {
  idProduto: number;
  idSubproduto: number;
  descricaoProduto: string;
  subgrupo: string | null;
  marca: string | null;
  valVendMesAtual: number;
  valVendMesAnterior: number;
  lucratividadeGerencial: number;
  estoqueAtualGeral: number;
  fornecedorPrincipalId: number | null;
  fornecedorPrincipalNome: string | null;
  valorCompradoPeriodo: number;
  qtdPedidosPeriodo: number;
}

interface FornecedorResumo {
  fornecedorId: number | null;
  fornecedorNome: string;
  vendasTotais: number;
  valorCompradoPeriodo: number;
  qtdPedidosPeriodo: number;
  subgrupos: Set<string>;
  riscoScore: number;
  impactoScore: number;
  categoriaKraljic: 'Estratégico' | 'Alavancagem' | 'Gargalo' | 'Não-Crítico';
}

interface KpiResumo {
  titulo: string;
  valor: string;
  detalhe: string;
  tipo: 'estrategico' | 'alavancagem' | 'gargalo' | 'alertas';
}
interface FornecedorOption {
  id: number;
  nome: string;
}



@Component({
  selector: 'app-resumo-executivo',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './resumo-executivo.component.html',
  styleUrl: './resumo-executivo.component.scss'
})
export class ResumoExecutivoComponent implements OnInit {
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  // compatibilidade com HTML antigo
  lojas: EmpresaLite[] = [];
  lojaSelecionada: number[] = [];

  dataInicio!: Date;
  dataFim!: Date;

  fornecedorId: number | null = null;
  fornecedorSelecionado: number | null = null;

  subgrupo: string | null = null;

  carregando = false;
  abaAtiva: AbaResumoExecutivo = 'visao-geral';

  baseItems: ResumoExecutivoBaseItem[] = [];
  fornecedores: FornecedorOption[] = [];

    fornecedoresAgrupadosCache: FornecedorResumo[] = [];
    fornecedoresClassificadosCache: FornecedorResumo[] = [];

    kpisCache = {
      estrategicos: { titulo: 'Estratégicos', valor: '0', descricao: '0,0% das vendas' },
      alavancagem: { titulo: 'Alavancagem', valor: '0', descricao: '0,0% das vendas' },
      gargalo: { titulo: 'Gargalo', valor: '0', descricao: '0,0% das vendas' },
      alertasCriticos: { titulo: 'Alertas Críticos', valor: '0', descricao: '0 ação prioritária' }
    };

    matrizKraljicCache: Array<{
      categoria: string;
      qtdFornec: number;
      vendasTotaisTexto: string;
      percTotalTexto: string;
    }> = [];

    paretoCache: Array<{
      classificacao: string;
      qtdFornec: number;
      percVendas: string;
    }> = [];

    topFornecedoresCache: Array<{
      rank: number;
      fornecedor: string;
      score: number;
      vendas: string;
      margem: string;
      otif: string;
      kraljic: string;
      pareto: string;
    }> = [];

    alertasCache: Array<{
      alerta: string;
      quantidade: number;
      acao: string;
    }> = [];

  constructor(
    private empresaService: EmpresaService,
    private resumoExecutivoService: ResumoExecutivoService
  ) {}

    ngOnInit(): void {
      const hoje = new Date();
      this.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      this.dataFim = hoje;

      this.empresaService.getEmpresas().subscribe({
        next: (empresas) => {
          this.empresas = empresas;
          this.lojas = empresas;

          const primeiraLoja = empresas.length ? [empresas[0].id] : [];
          this.empresasSelecionadas = primeiraLoja;
          this.lojaSelecionada = [...primeiraLoja];

          // NÃO chamar aplicarFiltros aqui
        },
        error: (err) => {
          console.error('Erro ao carregar empresas', err);
        }
      });
    }

  aplicarFiltros(): void {
    this.empresasSelecionadas = [...this.lojaSelecionada];
    this.fornecedorId = this.fornecedorSelecionado;

    if (!this.empresasSelecionadas.length) {
      return;
    }

    this.carregando = true;

    this.resumoExecutivoService.buscarBase({
      empresas: this.empresasSelecionadas,
      dataInicio: this.toIsoDate(this.dataInicio),
      dataFim: this.toIsoDate(this.dataFim),
      fornecedorId: this.fornecedorId,
      subgrupo: this.subgrupo
    }).subscribe({
      next: (dados) => {
        this.baseItems = dados as ResumoExecutivoBaseItem[];
        this.montarFornecedores(this.baseItems);
        this.processarResumoExecutivo();
        console.log('Base resumo executivo:', this.baseItems);
      },
      error: (err: unknown) => {
        console.error('Erro ao buscar resumo executivo', err);
      },
      complete: () => {
        this.carregando = false;
      }
    });
  }

     selecionarAba(aba: AbaResumoExecutivo): void {
      this.abaAtiva = aba;
    }


private processarResumoExecutivo(): void {
  this.fornecedoresAgrupadosCache = this.calcularFornecedoresAgrupados();
  this.fornecedoresClassificadosCache = this.calcularFornecedoresClassificados();
  this.matrizKraljicCache = this.calcularMatrizKraljic();
  this.kpisCache = this.calcularKpis();
  this.paretoCache = this.calcularPareto();
  this.topFornecedoresCache = this.calcularTopFornecedores();
  this.alertasCache = this.calcularAlertas();
}

private calcularFornecedoresAgrupados(): FornecedorResumo[] {
  if (!this.baseItems.length) return [];

  const mapa = new Map<string, FornecedorResumo>();

  for (const item of this.baseItems) {
    const fornecedorId = item.fornecedorPrincipalId ?? null;
    const fornecedorNome = item.fornecedorPrincipalNome?.trim() || 'SEM FORNECEDOR';
    const chave = `${fornecedorId ?? 'null'}-${fornecedorNome}`;

    if (!mapa.has(chave)) {
      mapa.set(chave, {
        fornecedorId,
        fornecedorNome,
        vendasTotais: 0,
        valorCompradoPeriodo: 0,
        qtdPedidosPeriodo: 0,
        subgrupos: new Set<string>(),
        riscoScore: 0,
        impactoScore: 0,
        categoriaKraljic: 'Não-Crítico'
      });
    }

    const atual = mapa.get(chave)!;
    atual.vendasTotais += Number(item.valVendMesAtual || 0);
    atual.valorCompradoPeriodo += Number(item.valorCompradoPeriodo || 0);
    atual.qtdPedidosPeriodo += Number(item.qtdPedidosPeriodo || 0);

    if (item.subgrupo) {
      atual.subgrupos.add(item.subgrupo);
    }
  }

  return Array.from(mapa.values());
}


private calcularRiscoPorFornecedor(fornecedorNome: string): number {
  if (!this.baseItems.length) return 0;

  const itensDoFornecedor = this.baseItems.filter(
    x => (x.fornecedorPrincipalNome?.trim() || 'SEM FORNECEDOR') === fornecedorNome
  );

  if (!itensDoFornecedor.length) return 0;

  const totalVendasFornecedor = itensDoFornecedor.reduce(
    (soma, item) => soma + Number(item.valVendMesAtual || 0),
    0
  );

  if (!totalVendasFornecedor) return 0;

  const vendasPorSubgrupo = new Map<string, number>();
  const totalSubgrupo = new Map<string, number>();

  for (const item of this.baseItems) {
    const subgrupo = item.subgrupo || 'SEM SUBGRUPO';
    totalSubgrupo.set(
      subgrupo,
      (totalSubgrupo.get(subgrupo) || 0) + Number(item.valVendMesAtual || 0)
    );
  }

  for (const item of itensDoFornecedor) {
    const subgrupo = item.subgrupo || 'SEM SUBGRUPO';
    vendasPorSubgrupo.set(
      subgrupo,
      (vendasPorSubgrupo.get(subgrupo) || 0) + Number(item.valVendMesAtual || 0)
    );
  }

  let somaPonderada = 0;

  for (const [subgrupo, vendaFornecedorNoSubgrupo] of vendasPorSubgrupo.entries()) {
    const vendaTotalDoSubgrupo = totalSubgrupo.get(subgrupo) || 0;
    if (!vendaTotalDoSubgrupo) continue;

    const participacao = vendaFornecedorNoSubgrupo / vendaTotalDoSubgrupo;
    somaPonderada += participacao * vendaFornecedorNoSubgrupo;
  }

  return somaPonderada / totalVendasFornecedor;
}

private calcularFornecedoresClassificados(): FornecedorResumo[] {
  const fornecedores: FornecedorResumo[] = this.fornecedoresAgrupadosCache.map((f: FornecedorResumo) => ({
    ...f,
    impactoScore: f.vendasTotais,
    riscoScore: this.calcularRiscoPorFornecedor(f.fornecedorNome)
  }));

  if (!fornecedores.length) return [];

  const impactos = fornecedores.map((f: FornecedorResumo) => f.impactoScore);
  const riscos = fornecedores.map((f: FornecedorResumo) => f.riscoScore);

  const impactoMin = Math.min(...impactos);
  const impactoMax = Math.max(...impactos);
  const riscoMin = Math.min(...riscos);
  const riscoMax = Math.max(...riscos);

  const corteImpacto = impactoMin + ((impactoMax - impactoMin) / 2);
  const corteRisco = riscoMin + ((riscoMax - riscoMin) / 2);

  return fornecedores.map((f: FornecedorResumo) => {
    const altoImpacto = f.impactoScore >= corteImpacto;
    const altoRisco = f.riscoScore >= corteRisco;

    let categoria: FornecedorResumo['categoriaKraljic'];

    if (altoImpacto && altoRisco) {
      categoria = 'Estratégico';
    } else if (altoImpacto && !altoRisco) {
      categoria = 'Alavancagem';
    } else if (!altoImpacto && altoRisco) {
      categoria = 'Gargalo';
    } else {
      categoria = 'Não-Crítico';
    }

    return {
      ...f,
      categoriaKraljic: categoria
    };
  });
}

  private montarFornecedores(dados: ResumoExecutivoBaseItem[]): void {
    const mapa = new Map<number, string>();

    for (const item of dados) {
      if (item.fornecedorPrincipalId && item.fornecedorPrincipalNome) {
        mapa.set(item.fornecedorPrincipalId, item.fornecedorPrincipalNome);
      }
    }

    this.fornecedores = Array.from(mapa.entries())
      .map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }

  private toIsoDate(data: Date): string {
    return data.toISOString().slice(0, 10);
  }

  private formatarMoeda(valor: number): string {
    return valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  private formatarPercentual(valor: number): string {
    return `${valor.toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    })}%`;
  }

private calcularKpis() {
  const matriz = this.matrizKraljicCache;

  const estrategico = matriz.find(item => item.categoria === 'Estratégico') ?? {
    categoria: 'Estratégico',
    qtdFornec: 0,
    vendasTotaisTexto: '0,00',
    percTotalTexto: '0,0% das vendas'
  };

  const alavancagem = matriz.find(item => item.categoria === 'Alavancagem') ?? {
    categoria: 'Alavancagem',
    qtdFornec: 0,
    vendasTotaisTexto: '0,00',
    percTotalTexto: '0,0% das vendas'
  };

  const gargalo = matriz.find(item => item.categoria === 'Gargalo') ?? {
    categoria: 'Gargalo',
    qtdFornec: 0,
    vendasTotaisTexto: '0,00',
    percTotalTexto: '0,0% das vendas'
  };

  const alertasCriticosQtd = (estrategico.qtdFornec || 0) + (gargalo.qtdFornec || 0);

  return {
    estrategicos: {
      titulo: 'Estratégicos',
      valor: String(estrategico.qtdFornec),
      descricao: estrategico.percTotalTexto
    },
    alavancagem: {
      titulo: 'Alavancagem',
      valor: String(alavancagem.qtdFornec),
      descricao: alavancagem.percTotalTexto
    },
    gargalo: {
      titulo: 'Gargalo',
      valor: String(gargalo.qtdFornec),
      descricao: gargalo.percTotalTexto
    },
    alertasCriticos: {
      titulo: 'Alertas Críticos',
      valor: String(alertasCriticosQtd),
      descricao: `${alertasCriticosQtd} ação prioritária`
    }
  };
}

 moeda(valor: number): string {
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}
   
private calcularMatrizKraljic() {
  const fornecedores: FornecedorResumo[] = this.fornecedoresClassificadosCache;

  const totalVendas = fornecedores.reduce(
    (soma: number, f: FornecedorResumo) => soma + f.vendasTotais,
    0
  );

  const categorias: Array<'Estratégico' | 'Alavancagem' | 'Gargalo' | 'Não-Crítico'> = [
    'Estratégico',
    'Alavancagem',
    'Gargalo',
    'Não-Crítico'
  ];

  return categorias.map((categoria) => {
    const itens = fornecedores.filter((f: FornecedorResumo) => f.categoriaKraljic === categoria);

    const vendas = itens.reduce(
      (soma: number, f: FornecedorResumo) => soma + f.vendasTotais,
      0
    );

    const percentual = totalVendas > 0 ? (vendas / totalVendas) * 100 : 0;

    return {
      categoria,
      qtdFornec: itens.length,
      vendasTotaisTexto: this.moeda(vendas),
      percTotalTexto: `${percentual.toFixed(1).replace('.', ',')}% das vendas`
    };
  });
}

private calcularPareto() {
  const agrupado = new Map<number, { nome: string; valor: number }>();

  for (const item of this.baseItems) {
    if (!item.fornecedorPrincipalId || !item.fornecedorPrincipalNome) continue;

    const atual = agrupado.get(item.fornecedorPrincipalId) || {
      nome: item.fornecedorPrincipalNome,
      valor: 0
    };

    atual.valor += item.valVendMesAtual || 0;
    agrupado.set(item.fornecedorPrincipalId, atual);
  }

  const lista = Array.from(agrupado.entries())
    .map(([id, dados]) => ({ id, nome: dados.nome, valor: dados.valor }))
    .sort((a, b) => b.valor - a.valor);

  const total = lista.reduce((acc, item) => acc + item.valor, 0);

  let acumulado = 0;
  let aTop80 = 0;
  let b15 = 0;
  let c5 = 0;

  for (const item of lista) {
    const perc = total > 0 ? (item.valor / total) * 100 : 0;
    acumulado += perc;

    if (acumulado <= 80) aTop80++;
    else if (acumulado <= 95) b15++;
    else c5++;
  }

  const calcPerc = (faixa: 'A' | 'B' | 'C') => {
    if (!lista.length || total <= 0) return 0;

    let soma = 0;
    let acc = 0;

    for (const item of lista) {
      const perc = (item.valor / total) * 100;
      acc += perc;

      const pertenceA = acc <= 80;
      const pertenceB = acc > 80 && acc <= 95;
      const pertenceC = acc > 95;

      if (
        (faixa === 'A' && pertenceA) ||
        (faixa === 'B' && pertenceB) ||
        (faixa === 'C' && pertenceC)
      ) {
        soma += perc;
      }
    }

    return soma;
  };

  return [
    {
      classificacao: 'A - Top 80%',
      qtdFornec: aTop80,
      percVendas: this.formatarPercentual(calcPerc('A'))
    },
    {
      classificacao: 'B - 15%',
      qtdFornec: b15,
      percVendas: this.formatarPercentual(calcPerc('B'))
    },
    {
      classificacao: 'C - 5%',
      qtdFornec: c5,
      percVendas: this.formatarPercentual(calcPerc('C'))
    }
  ];
}

private calcularTopFornecedores() {
  const agrupado = new Map<number, {
    fornecedor: string;
    vendas: number;
    lucratividade: number[];
    kraljic: string[];
  }>();

  for (const item of this.baseItems) {
    if (!item.fornecedorPrincipalId || !item.fornecedorPrincipalNome) continue;

    const atual = agrupado.get(item.fornecedorPrincipalId) || {
      fornecedor: item.fornecedorPrincipalNome,
      vendas: 0,
      lucratividade: [],
      kraljic: []
    };

    atual.vendas += item.valVendMesAtual || 0;
    atual.lucratividade.push(item.lucratividadeGerencial || 0);

    const categoria = this.descobrirCategoriaKraljicItem(item);
    atual.kraljic.push(categoria);

    agrupado.set(item.fornecedorPrincipalId, atual);
  }

  return Array.from(agrupado.entries())
    .map(([id, dados]) => {
      const score =
        dados.vendas * 0.00001 +
        (dados.lucratividade.reduce((a, b) => a + b, 0) / Math.max(dados.lucratividade.length, 1));

      return {
        rank: 0,
        fornecedor: dados.fornecedor,
        score: Number(score.toFixed(1)),
        vendas: this.formatarMoeda(dados.vendas),
        margem: this.formatarPercentual(
          dados.lucratividade.reduce((a, b) => a + b, 0) / Math.max(dados.lucratividade.length, 1)
        ),
        otif: this.formatarPercentual(90),
        kraljic: dados.kraljic[0] || 'Não-Crítico',
        pareto: 'A - Top 80%'
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item, idx) => ({ ...item, rank: idx + 1 }));
}

  private calcularAlertas() {
  const ruptura = this.baseItems.filter(x => (x.estoqueAtualGeral || 0) <= 0).length;
  const semVenda = this.baseItems.filter(x => (x.valVendMesAtual || 0) <= 0).length;
  const baixoGiro = this.baseItems.filter(x => (x.valVendMesAtual || 0) > 0 && (x.valVendMesAnterior || 0) <= 0).length;
  const margemBaixa = this.baseItems.filter(x => (x.lucratividadeGerencial || 0) < 15).length;

  return [
    {
      alerta: 'Produtos em Ruptura de Estoque',
      quantidade: ruptura,
      acao: 'Pedido urgente ou remanejamento'
    },
    {
      alerta: 'Produtos sem Venda no período',
      quantidade: semVenda,
      acao: 'Avaliar descontinuação ou ação comercial'
    },
    {
      alerta: 'Itens com Baixo Giro',
      quantidade: baixoGiro,
      acao: 'Revisar estoque e exposição'
    },
    {
      alerta: 'Itens com Margem Baixa',
      quantidade: margemBaixa,
      acao: 'Revisar preço, custo e mix'
    }
  ];
}

  private descobrirCategoriaKraljicItem(item: ResumoExecutivoBaseItem): string {
    const ordenados = [...this.baseItems].sort((a, b) => (b.valVendMesAtual || 0) - (a.valVendMesAtual || 0));
    const metade = ordenados.length ? Math.ceil(ordenados.length / 2) : 0;
    const posicao = ordenados.findIndex(x =>
      x.idProduto === item.idProduto && x.idSubproduto === item.idSubproduto
    );

    const impactoAlto = posicao > -1 && posicao < metade;
    const riscoAlto = (item.qtdPedidosPeriodo || 0) <= 1 || (item.valorCompradoPeriodo || 0) <= 0;

    if (impactoAlto && riscoAlto) return 'Estratégico';
    if (impactoAlto && !riscoAlto) return 'Alavancagem';
    if (!impactoAlto && riscoAlto) return 'Gargalo';
    return 'Não-Crítico';
  }
}