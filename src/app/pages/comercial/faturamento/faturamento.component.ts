import { ChangeDetectorRef, Component, OnInit, inject } from '@angular/core';
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
import { isoLocal } from '../../../services/dias-venda.util';
import {
  FaturamentoService,
  FaturamentoEmpresaItem,
  FaturamentoFormaPagamentoItem
} from '../../../services/faturamento.service';

type AbaFaturamento = 'empresa' | 'forma-pagamento';

/** Formas destacadas no 4.3. Identificadas pelo nome no cadastro do CISS (FORMA_PAGREC.DESCRRECEBIMENTO). */
type Destaque = 'moradia' | 'boleto';
const DESTAQUES: { chave: Destaque; titulo: string; termo: string }[] = [
  { chave: 'moradia', titulo: 'Cheque Moradia', termo: 'MORADIA' },
  { chave: 'boleto',  titulo: 'Boleto',         termo: 'BOLETO' },
];

/** Prefixos de formas que não são venda, mesmo com MORADIA/BOLETO no nome. */
const FORMAS_IGNORADAS = ['COMPRA ', 'PAG ', 'REC ', 'REM PAG', 'BAIXA ', 'BOLETO TESTE'];

function normalizar(t: string | null | undefined): string {
  return String(t ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
}

interface ResumoDestaque {
  chave: Destaque;
  titulo: string;
  valor: number;          // venda menos CANC/DEV
  perc: number;           // sobre o total das formas
  formas: string[];       // nomes das formas que entraram
}

@Component({
  selector: 'app-faturamento',
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
  templateUrl: './faturamento.component.html',
  styleUrl: './faturamento.component.scss'
})
export class FaturamentoComponent implements OnInit {
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  dataInicio!: Date;
  dataFim!: Date;

  carregando = false;
  abaAtiva: AbaFaturamento = 'empresa';

  dadosPorEmpresa: FaturamentoEmpresaItem[] = [];
  dadosFormaPagamento: FaturamentoFormaPagamentoItem[] = [];

  // 4.3: isolar uma forma ('' = todas)
  isolar: '' | Destaque = '';
  readonly destaques = DESTAQUES;

  // 4.4: PJ em boleto (mesmo relatório, só clientes com CNPJ). Carrega ao abrir a aba.
  dadosPJ: FaturamentoFormaPagamentoItem[] | null = null;
  carregandoPJ = false;
  erroPJ = '';
  private chavePJ = '';
  private chaveAtual = '';

  private cdr = inject(ChangeDetectorRef);

  constructor(
    private empresaService: EmpresaService,
    private faturamentoService: FaturamentoService
  ) {}

  ngOnInit(): void {
    const hoje = new Date();
    this.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.dataFim = hoje;

    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.empresasSelecionadas = empresas.length ? [empresas[0].id] : [];
        this.aplicarFiltros();
      },
      error: (err) => {
        console.error('Erro ao carregar empresas', err);
      }
    });
  }

  selecionarAba(aba: AbaFaturamento): void {
    this.abaAtiva = aba;
    if (aba === 'forma-pagamento') this.carregarPJ();
    this.cdr.detectChanges();
  }

  aplicarFiltros(): void {
    if (!this.empresasSelecionadas.length) {
      return;
    }

    this.carregando = true;
    this.cdr.detectChanges();

    const filtros = {
      empresas: this.empresasSelecionadas,
      dataInicio: this.toIsoDate(this.dataInicio),
      dataFim: this.toIsoDate(this.dataFim)
    };
    this.chaveAtual = JSON.stringify(filtros);
    this.dadosPJ = null;
    this.erroPJ = '';

    this.faturamentoService.buscarPorEmpresa(filtros).subscribe({
      next: (dados) => {
        this.dadosPorEmpresa = dados;
        this.cdr.detectChanges();
        this.buscarFormaPagamento(filtros);
      },
      error: (err) => {
        console.error('Erro ao buscar faturamento por empresa', err);
        this.carregando = false;
        this.cdr.detectChanges();
      }
    });
  }

  private buscarFormaPagamento(filtros: {
    empresas: number[];
    dataInicio: string;
    dataFim: string;
  }): void {
    this.faturamentoService.buscarPorFormaPagamento(filtros).subscribe({
      next: (dados) => {
        this.dadosFormaPagamento = dados;
      },
      error: (err) => {
        console.error('Erro ao buscar faturamento por forma de pagamento', err);
        this.carregando = false;
        this.cdr.detectChanges();
      },
      complete: () => {
        this.carregando = false;
        this.cdr.detectChanges();
        // uma consulta por vez no CISS: o PJ só depois do relatório principal
        if (this.abaAtiva === 'forma-pagamento') this.carregarPJ();
      }
    });
  }

  /** 4.4: relatório de forma de pagamento só com clientes PJ (CNPJ), para as lojas e o período atuais. */
  /** Botão do cartão: recalcula mesmo que já tenha tentado (ex.: depois de um erro). */
  calcularPJ(): void {
    this.chavePJ = '';
    this.carregarPJ();
  }

  carregarPJ(): void {
    if (this.carregando || this.carregandoPJ || !this.chaveAtual || this.chavePJ === this.chaveAtual) return;
    const chave = this.chaveAtual;
    const filtros = { ...JSON.parse(chave), tipoPessoa: 'PJ' as const };
    this.carregandoPJ = true;
    this.erroPJ = '';
    this.cdr.detectChanges();
    this.faturamentoService.buscarPorFormaPagamento(filtros).subscribe({
      next: (dados) => {
        if (chave === this.chaveAtual) {
          this.dadosPJ = dados ?? [];
          this.chavePJ = chave;
        }
      },
      error: (err) => {
        console.error('Erro ao buscar PJ por forma de pagamento', err);
        this.carregandoPJ = false;
        if (chave === this.chaveAtual) {
          this.dadosPJ = null;
          this.erroPJ = 'Não foi possível calcular a venda PJ agora.';
          this.chavePJ = chave;   // não tenta de novo sozinho; o botão "Calcular" refaz
        }
        this.cdr.detectChanges();
        // erro de um período antigo (filtros trocados no meio): calcula o atual
        if (chave !== this.chaveAtual && this.abaAtiva === 'forma-pagamento') this.carregarPJ();
      },
      complete: () => {
        this.carregandoPJ = false;
        this.cdr.detectChanges();
        // filtros mudaram enquanto calculava: calcula de novo para os atuais
        if (this.abaAtiva === 'forma-pagamento' && this.chavePJ !== this.chaveAtual) this.carregarPJ();
      }
    });
  }

  // ─── 4.3: destaques e isolamento ─────────────────────────────────────────
  private destaqueDe(descricao: string): Destaque | null {
    const d = normalizar(descricao).trim();
    // formas de compra/pagamento/remessa que também têm o nome (ex.: COMPRA CHEQUE MORADIA, PAG CHEQUE MORADIA,
    // COMPRA BOLETO, REC BOLETO BRADESCO): não são venda. Conferido no cadastro FORMA_PAGREC em nov/2026.
    if (FORMAS_IGNORADAS.some(p => d.startsWith(p))) return null;
    return DESTAQUES.find(x => d.includes(x.termo))?.chave ?? null;
  }

  private totalDe(linhas: FaturamentoFormaPagamentoItem[] | null | undefined): number {
    return (linhas ?? []).reduce((s, l) => s + (Number(l.TOTALDUP) || 0), 0);
  }

  private somaDestaque(linhas: FaturamentoFormaPagamentoItem[] | null | undefined, chave: Destaque): number {
    return (linhas ?? [])
      .filter(l => this.destaqueDe(l.DESCRICAO) === chave)
      .reduce((s, l) => s + (Number(l.TOTALDUP) || 0), 0);
  }

  get totalFormas(): number {
    return this.totalDe(this.dadosFormaPagamento);
  }

  get resumoDestaques(): ResumoDestaque[] {
    const total = this.totalFormas;
    return DESTAQUES.map(d => {
      const valor = this.somaDestaque(this.dadosFormaPagamento, d.chave);
      const formas = [...new Set(this.dadosFormaPagamento
        .filter(l => this.destaqueDe(l.DESCRICAO) === d.chave && !normalizar(l.DESCRICAO).includes('CANC/DEV'))
        .map(l => l.DESCRICAO))];
      return { chave: d.chave, titulo: d.titulo, valor, perc: total ? (valor / total) * 100 : 0, formas };
    });
  }

  get linhasFormaPagamento(): FaturamentoFormaPagamentoItem[] {
    return this.isolar
      ? this.dadosFormaPagamento.filter(l => this.destaqueDe(l.DESCRICAO) === this.isolar)
      : this.dadosFormaPagamento;
  }

  get totalLinhasVisiveis(): number {
    return this.totalDe(this.linhasFormaPagamento);
  }

  percDoTotal(valor: number | null | undefined): number {
    const t = this.totalFormas;
    return t ? ((Number(valor) || 0) / t) * 100 : 0;
  }

  alternarIsolar(chave: Destaque): void {
    this.isolar = this.isolar === chave ? '' : chave;
    this.cdr.detectChanges();
  }

  // ─── 4.4: PJ em boleto ───────────────────────────────────────────────────
  get pjTotal(): number { return this.totalDe(this.dadosPJ); }
  get pjBoleto(): number { return this.somaDestaque(this.dadosPJ, 'boleto'); }
  get pjPercBoleto(): number { return this.pjTotal ? (this.pjBoleto / this.pjTotal) * 100 : 0; }
  get pjPercFaturamento(): number { return this.totalFormas ? (this.pjTotal / this.totalFormas) * 100 : 0; }

  private toIsoDate(data: Date): string {
    // data local (toISOString usa UTC e, depois das 21h em Belém, já é o dia seguinte)
    return isoLocal(data);
  }

  moeda(valor: number | null | undefined): string {
    const numero = Number(valor || 0);
    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  percentual(valor: number | null | undefined): string {
    const numero = Number(valor || 0);
    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + '%';
  }

  get totalFaturamentoLiquido(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.TOTALVENDA || 0), 0);
  }

  get totalLucroLiquido(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.LUCRO || 0), 0);
  }

  get totalDevolucoes(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.DEVOLUCOES || 0), 0);
  }

  get totalVendas(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.QTDVENDA || 0), 0);
  }
}