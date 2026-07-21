import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  FluxoCaixaService, FluxoResponse,
  FluxoDiarioResponse, CelulaDiaria, VencidoCategoria,
} from '../../../services/fluxocaixa.service';

interface PontoLinha { x: number; y: number; saldo: number; label: string; neg: boolean; }
interface BarraSem  { x: number; wE: number; yE: number; hE: number; yS: number; hS: number; }

type AbaFluxo = 'semanal' | 'diario';
type TipoLinha =
  | 'saldo-inicial' | 'entrada-total' | 'entrada-item'
  | 'saida-total' | 'saida-item' | 'saida-semclassif'
  | 'saldo-dia' | 'saldo-acumulado';

interface ColunaDia { data: Date; diaMes: string; diaSemana: string; iso: string; }
interface CelulaValor { previsto: number; realizado: number; }
interface LinhaMatriz {
  id: string; label: string; tipo: TipoLinha;
  celulas: CelulaValor[]; indent?: boolean; destaque?: boolean;
}

const CATEGORIAS_SAIDA = ['REVENDA', 'NAO REVENDA', 'FRETE', 'BANCO', 'IMPOSTO', 'FOLHA', 'DESPESA', 'OUTROS'];
const BALDES_ENTRADA   = ['CARTAO', 'BOLETO', 'DINHEIRO_PIX', 'OUTROS'];
const LABEL_BALDE: Record<string, string> = {
  CARTAO: 'Cartão', BOLETO: 'Boleto', DINHEIRO_PIX: 'Dinheiro/Pix', OUTROS: 'Outros',
};
const LABEL_CATEGORIA: Record<string, string> = {
  REVENDA: 'Revenda', 'NAO REVENDA': 'Não Revenda', FRETE: 'Frete', BANCO: 'Banco',
  IMPOSTO: 'Imposto', FOLHA: 'Folha', DESPESA: 'Despesa', OUTROS: 'Outros',
};

@Component({
  selector: 'app-fluxocaixa',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './fluxocaixa.component.html',
  styleUrls: ['./fluxocaixa.component.scss'],
})
export class FluxoCaixaComponent {
  private cdr = inject(ChangeDetectorRef);
  private api = inject(FluxoCaixaService);

  abaAtiva: AbaFluxo = 'semanal';
  setAba(aba: AbaFluxo) {
    this.abaAtiva = aba;
    if (aba === 'diario' && !this.dadosDiarioCarregados && !this.carregandoDiario) {
      this.buscarDiario();
    }
    this.cdr.detectChanges();
  }

  saldoInicial = 0;
  empresaFiltro = '';
  carregando = false;
  dadosCarregados = false;
  erro = '';
  dados: FluxoResponse | null = null;

  readonly W = 960; readonly H = 340; readonly PAD = 40; readonly TOP = 20; readonly BOT = 60;
  pontos: PontoLinha[] = [];
  barras: BarraSem[] = [];
  areaPath = '';
  linhaPath = '';
  zeroY = 0;
  temNegativo = false;

  constructor() {
    afterNextRender(() => { this.buscar(); this.cdr.detectChanges(); });
  }

  buscar() {
    this.carregando = true; this.erro = ''; this.cdr.detectChanges();
    this.api.getProjecao(this.saldoInicial, this.empresaFiltro || undefined).subscribe({
      next: (r: FluxoResponse) => {
        this.dados = r;
        this.montarGrafico(r);
        this.carregando = false;
        this.dadosCarregados = true;
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        console.error('Erro ao carregar Fluxo de Caixa', e);
        this.erro = 'Não foi possível carregar a projeção.';
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }

  limpar() {
    this.saldoInicial = 0; this.empresaFiltro = '';
    this.dadosCarregados = false; this.dados = null;
    this.cdr.detectChanges();
  }

  private montarGrafico(r: FluxoResponse) {
    const s = r.semanas;
    if (!s.length) return;
    const saldos = s.map(x => x.saldoAcumulado);
    const movs = s.flatMap(x => [x.entrada, x.saida]);
    const maxSaldo = Math.max(r.saldoInicial, ...saldos, 0);
    const minSaldo = Math.min(r.saldoInicial, ...saldos, 0);
    const maxMov = Math.max(1, ...movs);
    const innerW = this.W - this.PAD * 2;
    const innerH = this.H - this.TOP - this.BOT;
    const stepX = innerW / s.length;
    const yOf = (v: number) => {
      if (maxSaldo === minSaldo) return this.TOP + innerH / 2;
      return this.TOP + innerH - ((v - minSaldo) / (maxSaldo - minSaldo)) * innerH;
    };
    this.zeroY = yOf(0);
    this.temNegativo = minSaldo < 0;
    const baseBar = this.H - this.BOT + 38;
    const altMaxBar = 26;
    this.barras = s.map((w, i) => {
      const cx = this.PAD + stepX * i + stepX / 2;
      const hE = (w.entrada / maxMov) * altMaxBar;
      const hS = (w.saida / maxMov) * altMaxBar;
      const bw = Math.min(10, stepX * 0.22);
      return { x: cx, wE: bw, yE: baseBar - hE, hE, yS: baseBar - hS, hS };
    });
    this.pontos = s.map((w, i) => {
      const x = this.PAD + stepX * i + stepX / 2;
      const y = yOf(w.saldoAcumulado);
      return { x, y, saldo: w.saldoAcumulado, label: w.label, neg: w.saldoAcumulado < 0 };
    });
    this.linhaPath = this.pontos.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    const x0 = this.pontos[0].x, xN = this.pontos[this.pontos.length - 1].x;
    this.areaPath = `M${x0},${this.zeroY.toFixed(1)} ` +
      this.pontos.map(p => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ') +
      ` L${xN},${this.zeroY.toFixed(1)} Z`;
  }

  get saldoFinal(): number { return this.dados?.saldoFinal ?? 0; }
  get menorSaldo(): number { return this.dados?.menorSaldo ?? 0; }
  get net30(): number { return (this.dados?.entra30 ?? 0) - (this.dados?.sai30 ?? 0); }
  get apertoLabel(): string {
    if (!this.dados) return '';
    const w = this.dados.semanas[this.dados.semanaMenorSaldo];
    return w ? `${w.label} (${w.periodo})` : '';
  }

  dataInicioDiario = this.formatarDataInput(new Date());
  dataFimDiario = this.formatarDataInput(this.somarDias(new Date(), 13));
  saldoInicialDiario = 0;
  empresaFiltroDiario = '';
  vencidoCorteDias = 90;

  carregandoDiario = false;
  dadosDiarioCarregados = false;
  erroDiario = '';

  respostaDiario: FluxoDiarioResponse | null = null;
  colunasDias: ColunaDia[] = [];
  linhasMatriz: LinhaMatriz[] = [];

  saldoFinalDiarioPrevisto = 0;
  saldoFinalDiarioRealizado = 0;
  menorSaldoDiarioRealizado = 0;
  menorSaldoDiarioLabel = '';
  totalEntradaPrevisto = 0;
  totalSaidaPrevisto = 0;
  totalEntradaRealizado = 0;
  totalSaidaRealizado = 0;
  resultadoRealizado = 0;
  coberturaEntrada = 0;
  vencidoTotal = 0;

  buscarDiario() {
    this.erroDiario = '';
    const ini = this.parseDataInput(this.dataInicioDiario);
    const fim = this.parseDataInput(this.dataFimDiario);
    if (!ini || !fim || fim < ini) {
      this.erroDiario = 'Verifique o intervalo de datas (fim deve ser maior ou igual ao início).';
      this.cdr.detectChanges();
      return;
    }
    const diffDias = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
    if (diffDias > 62) {
      this.erroDiario = 'Selecione um intervalo de até 62 dias por vez.';
      this.cdr.detectChanges();
      return;
    }

    this.carregandoDiario = true;
    this.cdr.detectChanges();

    this.api.getDiario(
      this.dataInicioDiario,
      this.dataFimDiario,
      this.empresaFiltroDiario || undefined,
      this.vencidoCorteDias,
    ).subscribe({
      next: (r: FluxoDiarioResponse) => {
        this.respostaDiario = r;
        this.montarMatriz(r);
        this.carregandoDiario = false;
        this.dadosDiarioCarregados = true;
        this.cdr.detectChanges();
      },
      error: (e: any) => {
        console.error('Erro ao carregar Fluxo Diário', e);
        this.erroDiario = 'Não foi possível carregar a visão diária.';
        this.carregandoDiario = false;
        this.cdr.detectChanges();
      },
    });
  }

  private montarMatriz(r: FluxoDiarioResponse) {
    const ini = this.parseDataInput(r.dataInicio)!;
    const fim = this.parseDataInput(r.dataFim)!;
    const diffDias = Math.round((fim.getTime() - ini.getTime()) / 86400000) + 1;
    const diasSemana = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    this.colunasDias = [];
    for (let i = 0; i < diffDias; i++) {
      const d = this.somarDias(ini, i);
      this.colunasDias.push({
        data: d,
        diaMes: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        diaSemana: diasSemana[d.getDay()],
        iso: this.formatarDataInput(d),
      });
    }

    const idxEntrada = this.indexar(r.entradas);
    const idxSaida = this.indexar(r.saidas);

    const celDe = (idx: Map<string, Map<string, CelulaValor>>, chave: string): CelulaValor[] =>
      this.colunasDias.map((c: ColunaDia) => idx.get(chave)?.get(c.iso) ?? { previsto: 0, realizado: 0 });

    const entradaItens: LinhaMatriz[] = BALDES_ENTRADA
      .filter((b: string) => idxEntrada.has(b))
      .map((b: string) => ({
        id: `entrada-${b}`, label: LABEL_BALDE[b] ?? b, tipo: 'entrada-item' as TipoLinha,
        indent: true, celulas: celDe(idxEntrada, b),
      }));
    const entradaTotal: LinhaMatriz = {
      id: 'entrada-total', label: 'Entrada', tipo: 'entrada-total', destaque: true,
      celulas: this.colunasDias.map((_: ColunaDia, di: number) => ({
        previsto: entradaItens.reduce((s: number, l: LinhaMatriz) => s + l.celulas[di].previsto, 0),
        realizado: entradaItens.reduce((s: number, l: LinhaMatriz) => s + l.celulas[di].realizado, 0),
      })),
    };

    const chavesSaida = new Set(r.saidas.map((s: CelulaDiaria) => s.chave));
    const saidaItens: LinhaMatriz[] = CATEGORIAS_SAIDA
      .filter((c: string) => chavesSaida.has(c))
      .map((c: string) => ({
        id: `saida-${c}`, label: LABEL_CATEGORIA[c] ?? c, tipo: 'saida-item' as TipoLinha,
        indent: true, celulas: celDe(idxSaida, c),
      }));
    const temSemClassif = chavesSaida.has('SEM CLASSIF');
    const saidaSemClassif: LinhaMatriz | null = temSemClassif ? {
      id: 'saida-semclassif', label: 'Sem classificação', tipo: 'saida-semclassif',
      indent: true, celulas: celDe(idxSaida, 'SEM CLASSIF'),
    } : null;

    const todasLinhasSaida: LinhaMatriz[] = saidaSemClassif ? [...saidaItens, saidaSemClassif] : saidaItens;
    const saidaTotal: LinhaMatriz = {
      id: 'saida-total', label: 'Saída', tipo: 'saida-total', destaque: true,
      celulas: this.colunasDias.map((_: ColunaDia, di: number) => ({
        previsto: todasLinhasSaida.reduce((s: number, l: LinhaMatriz) => s + l.celulas[di].previsto, 0),
        realizado: todasLinhasSaida.reduce((s: number, l: LinhaMatriz) => s + l.celulas[di].realizado, 0),
      })),
    };

    const saldoDia: LinhaMatriz = {
      id: 'saldo-dia', label: 'Saldo do Dia', tipo: 'saldo-dia', destaque: true,
      celulas: this.colunasDias.map((_: ColunaDia, di: number) => ({
        previsto: entradaTotal.celulas[di].previsto - saidaTotal.celulas[di].previsto,
        realizado: entradaTotal.celulas[di].realizado - saidaTotal.celulas[di].realizado,
      })),
    };
    const saldoAcumulado: LinhaMatriz = {
      id: 'saldo-acumulado', label: 'Saldo Acumulado', tipo: 'saldo-acumulado', destaque: true, celulas: [],
    };
    let accP = this.saldoInicialDiario, accR = this.saldoInicialDiario;
    for (let di = 0; di < this.colunasDias.length; di++) {
      accP += saldoDia.celulas[di].previsto;
      accR += saldoDia.celulas[di].realizado;
      saldoAcumulado.celulas.push({ previsto: accP, realizado: accR });
    }
    const saldoInicialLinha: LinhaMatriz = {
      id: 'saldo-inicial', label: 'Saldo Inicial', tipo: 'saldo-inicial', destaque: true,
      celulas: this.colunasDias.map((_: ColunaDia, di: number) => ({
        previsto: di === 0 ? this.saldoInicialDiario : saldoAcumulado.celulas[di - 1].previsto,
        realizado: di === 0 ? this.saldoInicialDiario : saldoAcumulado.celulas[di - 1].realizado,
      })),
    };

    this.linhasMatriz = [
      saldoInicialLinha,
      entradaTotal, ...entradaItens,
      saidaTotal, ...todasLinhasSaida,
      saldoDia, saldoAcumulado,
    ];

    const ult = this.colunasDias.length - 1;
    this.saldoFinalDiarioPrevisto = saldoAcumulado.celulas[ult]?.previsto ?? 0;
    this.saldoFinalDiarioRealizado = saldoAcumulado.celulas[ult]?.realizado ?? 0;
    let menor = Infinity, menorIdx = 0;
    saldoAcumulado.celulas.forEach((c: CelulaValor, i: number) => { if (c.realizado < menor) { menor = c.realizado; menorIdx = i; } });
    this.menorSaldoDiarioRealizado = menor === Infinity ? 0 : menor;
    this.menorSaldoDiarioLabel = this.colunasDias[menorIdx]?.diaMes ?? '';
    this.totalEntradaPrevisto = entradaTotal.celulas.reduce((s: number, c: CelulaValor) => s + c.previsto, 0);
    this.totalSaidaPrevisto = saidaTotal.celulas.reduce((s: number, c: CelulaValor) => s + c.previsto, 0);
    this.totalEntradaRealizado = entradaTotal.celulas.reduce((s: number, c: CelulaValor) => s + c.realizado, 0);
    this.totalSaidaRealizado = saidaTotal.celulas.reduce((s: number, c: CelulaValor) => s + c.realizado, 0);
    this.resultadoRealizado = this.totalEntradaRealizado - this.totalSaidaRealizado;
    this.coberturaEntrada = this.totalSaidaPrevisto > 0
      ? (this.totalEntradaPrevisto / this.totalSaidaPrevisto) * 100 : 0;
    this.vencidoTotal = (r.vencido || []).reduce((s: number, v: VencidoCategoria) => s + v.valor, 0);
  }

  private indexar(cels: CelulaDiaria[]): Map<string, Map<string, CelulaValor>> {
    const m = new Map<string, Map<string, CelulaValor>>();
    for (const c of cels) {
      if (!m.has(c.chave)) m.set(c.chave, new Map());
      m.get(c.chave)!.set(c.dia, { previsto: c.previsto, realizado: c.realizado });
    }
    return m;
  }

  recarregarComCorte() {
    if (this.dadosDiarioCarregados) this.buscarDiario();
  }

  limparDiario() {
    this.saldoInicialDiario = 0;
    this.empresaFiltroDiario = '';
    this.vencidoCorteDias = 90;
    this.dataInicioDiario = this.formatarDataInput(new Date());
    this.dataFimDiario = this.formatarDataInput(this.somarDias(new Date(), 13));
    this.dadosDiarioCarregados = false;
    this.linhasMatriz = [];
    this.colunasDias = [];
    this.respostaDiario = null;
    this.cdr.detectChanges();
  }

  classeLinha(l: LinhaMatriz): string {
    const base = [`linha-${l.tipo}`];
    if (l.indent) base.push('linha-indent');
    if (l.destaque) base.push('linha-destaque');
    return base.join(' ');
  }
  classeValor(v: number): string { return v < 0 ? 'val-neg' : v > 0 ? 'val-pos' : 'val-zero'; }

  get vencidoLista(): VencidoCategoria[] { return this.respostaDiario?.vencido ?? []; }

  private formatarDataInput(d: Date): string {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  private parseDataInput(s: string): Date | null {
    if (!s) return null;
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  }
  private somarDias(d: Date, n: number): Date {
    const nd = new Date(d); nd.setDate(nd.getDate() + n); return nd;
  }

  moeda(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  moedaCurta(v: number | null | undefined): string {
    const n = Number(v || 0);
    if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mi';
    if (Math.abs(n) >= 1_000) return (n / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) + ' mil';
    return n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
  }
  classeSaldo(v: number): string { return v < 0 ? 'val-neg' : 'val-pos'; }
}