import { Component, inject, ChangeDetectorRef, afterNextRender, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';

export interface ResumoSituacao {
  situacao: 'A_VENCER' | 'VENCIDO' | 'JURIDICO' | 'PAGO';
  status: string;
  juridico?: boolean;
  totalTitulos: number;
  valorTotal: number;
  valorBruto?: number;        // ← NOVO
}

export interface FaixaVencimento {
  label: string;
  diasMin: number;
  diasMax: number | null;
  valor: number;
  qtd: number;
  acao: string;
  nivel: 'recente' | 'aviso' | 'medio' | 'critico' | 'grave' | 'juridico';
}

export interface ResumoConsolidado {
  totalCarteira: number;
  totalCarteiraBruto: number;       // ← NOVO
  totalPago: number;
  totalPagoOperacional: number;
  totalPagoJuridico: number;
  inadimplencia: number;
  pctInadimplencia: number;
  carteiraJuridica: number;
  carteiraJuridicaBruto: number;    // ← NOVO
  atrasoProlongado: number;
  aProtestar: number;
  retornoCobranca: number;
  emGarantia: number;
  qtdGarantia: number;
  linhas: ResumoSituacao[];
  faixas: FaixaVencimento[];
  evolucao: { data: string; pctInadimplencia: number; valorCarteira: number }[];
  retornoPorCobrador: { cobrador: string; valor: number; pct: number }[];
  anterior?: { totalCarteira: number; inadimplencia: number; pctInadimplencia: number; };
}

export interface Titulo {
  idEmpresa: number;
  empresaAlias: string;
  idClifor: number;
  nomeCliente: string;
  idTitulo: number;
  digitoTitulo: string;
  valTitulo: number;
  valLiquido: number;
  sumPagamento: number;
  valDesconto: number | null;
  dtMovimento: string;
  dtVencimento: string;
  situacao: 'A_VENCER' | 'VENCIDO' | 'PAGO' | 'JURIDICO';
  status: string;
  emGarantia: boolean;
  banco: string | null;
  diasVencido: number;
}

export interface PaginacaoTitulos {
  total: number;
  valorTotal: number;
  valorSaldoTotal: number;          // ← NOVO
  pagina: number;
  porPagina: number;
  dados: Titulo[];
}

@Component({
  selector: 'app-creditocobranca',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './creditocobranca.component.html',
  styleUrls: ['./creditocobranca.component.scss'],
})
export class CreditoCobrancaComponent {
  private cdr  = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  @ViewChild('canvasDonut')    canvasDonut!:    ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasBarra')    canvasBarra!:    ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasEvolucao') canvasEvolucao!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasCobrador') canvasCobrador!: ElementRef<HTMLCanvasElement>;

  abaSelecionada: 'painel' | 'relatorio' | 'graficos' = 'painel';

  dataInicio: string    = this.hoje();
  dataFim: string       = '';
  empresaFiltro: string = '';

  filtroSituacao:  string = '';
  filtroStatus:    string = '';
  filtroFaixa:     string = '';
  filtroGarantia:  string = '';
  paginaAtual:     number = 1;
  readonly POR_PAGINA = 50;
  filtroCliente: string = '';
  filtroForma:   string = '';
  formasPagamento: { id: number; descricao: string }[] = [];   // ← pro select

  carregandoPainel    = false;
  carregandoRelatorio = false;
  dadosCarregados     = false;
  erroFiltro          = '';
  filtroVencimentoDe:  string = '';
  filtroVencimentoAte: string = '';

  resumo:  ResumoConsolidado | null = null;
  titulos: PaginacaoTitulos  | null = null;
  agrupar: 'situacao' | 'forma' = 'situacao';   // ← seletor

  // ─── Modo de data ─────────────────────────────────────────────────────────
  get modoComparativo(): boolean { return !this.dataFim || this.dataFim === this.dataInicio; }

  get labelPeriodo(): string {
    if (this.modoComparativo) {
      const d = new Date(this.dataInicio + 'T00:00:00');
      const ant = new Date(d); ant.setDate(ant.getDate() - 1);
      return `${this.fmtDate(ant.toISOString().slice(0,10))} vs ${this.fmtDate(this.dataInicio)}`;
    }
    return `${this.fmtDate(this.dataInicio)} a ${this.fmtDate(this.dataFim)}`;
  }

  // ─── Grupos ───────────────────────────────────────────────────────────────
  get linhasAVencer():  ResumoSituacao[] { return this.resumo?.linhas.filter(l => l.situacao === 'A_VENCER')  ?? []; }
  get linhasVencido():  ResumoSituacao[] { return this.resumo?.linhas.filter(l => l.situacao === 'VENCIDO')   ?? []; }
  get linhasJuridico(): ResumoSituacao[] { return this.resumo?.linhas.filter(l => l.situacao === 'JURIDICO')  ?? []; }
  get linhasPago():     ResumoSituacao[] { return this.resumo?.linhas.filter(l => l.situacao === 'PAGO')      ?? []; }
  get linhasPagoOperacional(): ResumoSituacao[] {
    return this.resumo?.linhas.filter(l => l.situacao === 'PAGO' && !l.juridico) ?? [];
  }
  get linhasPagoJuridico(): ResumoSituacao[] {
    return this.resumo?.linhas.filter(l => l.situacao === 'PAGO' && l.juridico) ?? [];
  }

  get subTotalAVencerBruto():  number { return this.linhasAVencer.reduce((s,l)  => s + (l.valorBruto ?? 0), 0); }
  get subTotalVencidoBruto():  number { return this.linhasVencido.reduce((s,l)  => s + (l.valorBruto ?? 0), 0); }
  get subTotalJuridicoBruto(): number { return this.linhasJuridico.reduce((s,l) => s + (l.valorBruto ?? 0), 0); }
  get subTotalAVencer():  number { return this.linhasAVencer.reduce((s,l)  => s + l.valorTotal, 0); }
  get subTotalVencido():  number { return this.linhasVencido.reduce((s,l)  => s + l.valorTotal, 0); }
  get subTotalJuridico(): number { return this.linhasJuridico.reduce((s,l) => s + l.valorTotal, 0); }
  get subTotalPago():     number { return this.linhasPago.reduce((s,l)     => s + l.valorTotal, 0); }

  get variacaoCarteira(): number { return this.resumo?.anterior ? this.resumo.totalCarteira - this.resumo.anterior.totalCarteira : 0; }
  get variacaoPct():      number { return this.resumo?.anterior ? this.resumo.pctInadimplencia - this.resumo.anterior.pctInadimplencia : 0; }
  get totalPaginas():     number { return Math.ceil((this.titulos?.total ?? 0) / this.POR_PAGINA); }

  abs(n: number): number { return Math.abs(n); }

  constructor() {
    afterNextRender(() => {
      this.carregarFormas();
      this.cdr.detectChanges();
    });
  }

  private carregarFormas() {
    this.http.get<{ id: number; descricao: string }[]>(
      `${this.api}/financeiro/credito-cobranca/formas-pagamento`
    ).subscribe({
      next: data => { this.formasPagamento = data; this.cdr.detectChanges(); },
      error: () => { /* silencioso — select fica vazio se falhar */ },
    });
  }

  // blindagem de data corrompida (ex: ano 0230)
  fmtDateSafe(s: string | null | undefined): string {
    if (!s || s.length < 10) return '—';
    const [y, m, d] = s.slice(0, 10).split('-');
    const ano = Number(y);
    if (!ano || ano < 1990 || ano > 2100) return '⚠ data inválida';
    return `${d}/${m}/${y}`;
  }

  // ─── Buscar ───────────────────────────────────────────────────────────────
  buscarPainel() {
  if (!this.dataInicio) { this.erroFiltro = 'Selecione ao menos a data inicial.'; return; }
  this.erroFiltro = '';
  this.dadosCarregados = true;
  this.carregandoPainel = true;
  this.cdr.detectChanges();

  this.http.get<ResumoConsolidado>(
    `${this.api}/financeiro/credito-cobranca/resumo?${this.buildParams()}`
  ).subscribe({
    next: data => {
      this.resumo = data;
      this.carregandoPainel = false;
      this.cdr.detectChanges();
      if (this.abaSelecionada === 'graficos') {
        setTimeout(() => this.desenharGraficos(), 100);
      }
    },
    error: () => {
      this.erroFiltro = 'Erro ao carregar dados financeiros.';
      this.carregandoPainel = false;
      this.cdr.detectChanges();
    },
  });
}

buscarRelatorio(pagina = 1) {
  if (!this.dataInicio) { this.erroFiltro = 'Selecione ao menos a data inicial.'; return; }
  this.erroFiltro = '';
  this.dadosCarregados = true;
  this.paginaAtual = pagina;
  this.carregandoRelatorio = true;
  this.cdr.detectChanges();

  const extra = [
    this.filtroSituacao ? `situacao=${this.filtroSituacao}` : '',
    this.filtroStatus   ? `status=${this.filtroStatus}`     : '',
    this.filtroFaixa    ? `faixa=${this.filtroFaixa}`       : '',
    this.filtroGarantia ? `garantia=${this.filtroGarantia}` : '',
    this.filtroCliente  ? `cliente=${encodeURIComponent(this.filtroCliente)}` : '',
    this.filtroForma    ? `forma=${encodeURIComponent(this.filtroForma)}`     : '',
    this.filtroVencimentoDe  ? `vencimentoDe=${this.filtroVencimentoDe}`   : '',
    this.filtroVencimentoAte ? `vencimentoAte=${this.filtroVencimentoAte}` : '',
    `pagina=${pagina}`,
    `limite=${this.POR_PAGINA}`,
  ].filter(Boolean).join('&');

  this.http.get<PaginacaoTitulos>(
    `${this.api}/financeiro/credito-cobranca/titulos?${this.buildParams()}&${extra}`
  ).subscribe({
    next: data => {
      this.titulos = data;
      this.carregandoRelatorio = false;
      this.cdr.detectChanges();
    },
    error: () => {
      this.erroFiltro = 'Erro ao carregar títulos.';
      this.carregandoRelatorio = false;
      this.cdr.detectChanges();
    },
  });
}

  buscar() {
    if (this.abaSelecionada === 'painel' || this.abaSelecionada === 'graficos') this.buscarPainel();
    else this.buscarRelatorio(1);
  }

  mudarAba(aba: 'painel' | 'relatorio' | 'graficos') {
    this.abaSelecionada = aba;
    if (!this.dadosCarregados) { this.cdr.detectChanges(); return; }
    if (aba === 'relatorio' && !this.titulos) { this.buscarRelatorio(1); return; }
    if (aba === 'graficos' && this.resumo) {
      setTimeout(() => this.desenharGraficos(), 100);
    }
    this.cdr.detectChanges();
  }

  exportar() {
    if (!this.dataInicio) { this.erroFiltro = 'Selecione ao menos a data inicial.'; return; }
    const extra = [
      this.filtroSituacao ? `situacao=${this.filtroSituacao}` : '',
      this.filtroStatus   ? `status=${this.filtroStatus}`     : '',
      this.filtroFaixa    ? `faixa=${this.filtroFaixa}`       : '',
      this.filtroGarantia ? `garantia=${this.filtroGarantia}` : '',
    ].filter(Boolean).join('&');
    const url = `${this.api}/financeiro/credito-cobranca/exportar?${this.buildParams()}${extra ? '&' + extra : ''}`;

    this.http.get(url, { responseType: 'blob' }).subscribe({
      next: blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `credito_cobranca_${new Date().toISOString().slice(0,10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(a.href);
        this.cdr.detectChanges();
      },
      error: () => { this.erroFiltro = 'Erro ao gerar o Excel.'; this.cdr.detectChanges(); },
    });
  }

  limpar() {
    this.dataInicio = this.hoje();
    this.dataFim = this.empresaFiltro = '';
    this.filtroSituacao = this.filtroStatus = this.filtroFaixa = this.filtroGarantia = '';
    this.filtroCliente = this.filtroForma = '';
    this.filtroVencimentoDe = this.filtroVencimentoAte = '';
    this.dadosCarregados = false;
    this.resumo = null; this.titulos = null;
    this.erroFiltro = '';
    this.cdr.detectChanges();
  }

  proximaPagina()  { if (this.paginaAtual < this.totalPaginas) this.buscarRelatorio(this.paginaAtual + 1); }
  paginaAnterior() { if (this.paginaAtual > 1)                 this.buscarRelatorio(this.paginaAtual - 1); }

  // ─── GRÁFICOS ─────────────────────────────────────────────────────────────
  desenharGraficos() {
    if (!this.resumo) return;
    this.desenharDonut();
    this.desenharBarra();
    this.desenharEvolucao();
    this.desenharCobrador();
  }

  private ctx(ref: ElementRef<HTMLCanvasElement>): CanvasRenderingContext2D | null {
    return ref?.nativeElement?.getContext('2d') ?? null;
  }

  private desenharDonut() {
    const c = this.ctx(this.canvasDonut); if (!c) return;
  
    const avencer  = this.subTotalAVencer;
    const vencido  = this.subTotalVencido;
    const juridico = this.subTotalJuridico;
    const total    = avencer + vencido + juridico;
    if (!total) return;
  
    const slices = [
      { label: 'A vencer', val: avencer,  color: '#378ADD' },
      { label: 'Vencido',  val: vencido,  color: '#EF9F27' },
      { label: 'Jurídico', val: juridico, color: '#888780' },
    ];
  
    const cx = 110, cy = 110, r2 = 80, inner = 48;
    c.canvas.width = 220; c.canvas.height = 220;
    c.clearRect(0, 0, 220, 220);
  
    let ang = -Math.PI / 2;
    slices.forEach(s => {
      const slice = (s.val / total) * Math.PI * 2;
      c.beginPath(); c.moveTo(cx, cy);
      c.arc(cx, cy, r2, ang, ang + slice); c.closePath();
      c.fillStyle = s.color; c.fill();
      ang += slice;
    });
  
    c.beginPath(); c.arc(cx, cy, inner, 0, Math.PI * 2);
    c.fillStyle = '#fff'; c.fill();
    c.fillStyle = '#1e1e2f'; c.font = '500 13px sans-serif'; c.textAlign = 'center';
    c.fillText('Carteira', cx, cy - 6);
    c.font = '600 11px sans-serif'; c.fillStyle = '#6b7280';
    c.fillText('em aberto', cx, cy + 10);
  }

  private desenharBarra() {
    const c = this.ctx(this.canvasBarra); if (!c || !this.resumo) return;
    const faixas = this.resumo.faixas;
    const maxVal = Math.max(...faixas.map(f => f.valor));
    const W = 520, H = 220, pad = 16, barH = 24, gap = 10;
    c.canvas.width = W; c.canvas.height = H;
    c.clearRect(0,0,W,H);
    const cores = ['#378ADD','#EF9F27','#D85A30','#E24B4A','#A32D2D','#888780'];
    faixas.forEach((f, i) => {
      const y = pad + i * (barH + gap);
      const barW = Math.max(4, (f.valor / maxVal) * (W - 200));
      c.fillStyle = cores[i] + '22';
      c.fillRect(160, y, W - 200, barH);
      c.fillStyle = cores[i];
      c.fillRect(160, y, barW, barH);
      c.fillStyle = '#6b7280'; c.font = '11px sans-serif'; c.textAlign = 'right';
      c.fillText(f.label.split(' — ')[0], 154, y + 16);
      c.fillStyle = '#1e1e2f'; c.font = '600 11px sans-serif'; c.textAlign = 'left';
      c.fillText('R$ ' + this.moeda(f.valor), 160 + barW + 6, y + 16);
    });
  }

  private desenharEvolucao() {
    const c = this.ctx(this.canvasEvolucao); if (!c || !this.resumo) return;
    const dados = this.resumo.evolucao;
    const W = 560, H = 180, padL = 40, padB = 30, padR = 20, padT = 16;
    c.canvas.width = W; c.canvas.height = H;
    c.clearRect(0,0,W,H);
    const vals = dados.map(d => d.pctInadimplencia);
    const minV = Math.min(...vals) - 1, maxV = Math.max(...vals) + 1;
    const xScale = (W - padL - padR) / (dados.length - 1);
    const yScale = (H - padT - padB) / (maxV - minV);
    const px = (i: number) => padL + i * xScale;
    const py = (v: number) => H - padB - (v - minV) * yScale;

    // grade
    [30, 31, 32, 33, 34].forEach(v => {
      const y = py(v);
      c.strokeStyle = '#f3f4f6'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(W - padR, y); c.stroke();
      c.fillStyle = '#9ca3af'; c.font = '10px sans-serif'; c.textAlign = 'right';
      c.fillText(v + '%', padL - 4, y + 4);
    });

    // área
    c.beginPath(); c.moveTo(px(0), py(vals[0]));
    dados.forEach((d, i) => c.lineTo(px(i), py(d.pctInadimplencia)));
    c.lineTo(px(dados.length - 1), H - padB);
    c.lineTo(px(0), H - padB); c.closePath();
    c.fillStyle = 'rgba(162,45,45,0.08)'; c.fill();

    // linha
    c.beginPath(); c.moveTo(px(0), py(vals[0]));
    dados.forEach((d, i) => c.lineTo(px(i), py(d.pctInadimplencia)));
    c.strokeStyle = '#A32D2D'; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();

    // labels eixo X (a cada 4)
    dados.forEach((d, i) => {
      if (i % 4 === 0) {
        const [,m,dia] = d.data.split('-');
        c.fillStyle = '#9ca3af'; c.font = '10px sans-serif'; c.textAlign = 'center';
        c.fillText(`${dia}/${m}`, px(i), H - 10);
      }
    });
  }

  private desenharCobrador() {
    const c = this.ctx(this.canvasCobrador); if (!c || !this.resumo) return;
    const dados = this.resumo.retornoPorCobrador;
    const W = 480, H = 200, padL = 140, padB = 20, barH = 22, gap = 8;
    c.canvas.width = W; c.canvas.height = H;
    c.clearRect(0,0,W,H);
    const maxPct = 100;
    dados.forEach((d, i) => {
      const y = padB + i * (barH + gap);
      const barW = (d.pct / maxPct) * (W - padL - 20);
      const cor = d.pct >= 60 ? '#3B6D11' : d.pct >= 40 ? '#854F0B' : '#A32D2D';
      c.fillStyle = cor + '22'; c.fillRect(padL, y, W - padL - 20, barH);
      c.fillStyle = cor;       c.fillRect(padL, y, barW, barH);
      c.fillStyle = '#6b7280'; c.font = '11px sans-serif'; c.textAlign = 'right';
      c.fillText(d.cobrador, padL - 6, y + 15);
      c.fillStyle = '#1e1e2f'; c.font = '600 11px sans-serif'; c.textAlign = 'left';
      c.fillText(d.pct + '%', padL + barW + 6, y + 15);
    });
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
 private buildParams(): string {
    const p: string[] = [`dataInicio=${this.dataInicio}`];
    if (this.dataFim && this.dataFim !== this.dataInicio) p.push(`dataFim=${this.dataFim}`);
    if (this.empresaFiltro) p.push(`empresa=${this.empresaFiltro}`);
    p.push(`agrupar=${this.agrupar}`);
    return p.join('&');
  }

  // troca a visão e recarrega
  mudarAgrupamento(modo: 'situacao' | 'forma') {
    this.agrupar = modo;
    if (this.dadosCarregados) this.buscar();
  }

  // título dinâmico do bloco Pagos
  get tituloPagos(): string {
    return this.modoComparativo ? `Pagos em ${this.fmtDate(this.dataInicio)}` : 'Pagos no período';
  }

  private hoje(): string { return new Date().toISOString().slice(0, 10); }

  fmtDate(s: string | null | undefined): string {
    if (!s || s.length < 10) return '—';
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  moeda(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  pct(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  situacaoLabel(s: string): string {
    const m: Record<string,string> = { A_VENCER:'A vencer', VENCIDO:'Vencido', PAGO:'Pago', JURIDICO:'Jurídico' };
    return m[s] ?? s;
  }
  situacaoClass(s: string): string {
    const m: Record<string,string> = { A_VENCER:'badge-vencer', VENCIDO:'badge-vencido', PAGO:'badge-pago', JURIDICO:'badge-juridico' };
    return m[s] ?? '';
  }
  nivelClass(n: string): string {
    const m: Record<string,string> = { recente:'faixa-recente', aviso:'faixa-aviso', medio:'faixa-medio', critico:'faixa-critico', grave:'faixa-grave', juridico:'faixa-juridico' };
    return m[n] ?? '';
  }
  variacaoSinal(v: number): string { return v > 0 ? '▲' : v < 0 ? '▼' : '—'; }
  variacaoClass(v: number, menorMelhor = false): string {
    if (v === 0) return '';
    return (menorMelhor ? v > 0 : v < 0) ? 'variacao-ruim' : 'variacao-boa';
  }
}