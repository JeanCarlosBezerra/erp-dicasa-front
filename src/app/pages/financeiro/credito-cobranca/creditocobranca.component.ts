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
  totalTitulos: number;
  valorTotal: number;
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
  totalPago: number;
  inadimplencia: number;
  pctInadimplencia: number;
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

  carregandoPainel    = false;
  carregandoRelatorio = false;
  dadosCarregados     = false;
  erroFiltro          = '';

  resumo:  ResumoConsolidado | null = null;
  titulos: PaginacaoTitulos  | null = null;

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
  get subTotalAVencer():  number { return this.linhasAVencer.reduce((s,l)  => s + l.valorTotal, 0); }
  get subTotalVencido():  number { return this.linhasVencido.reduce((s,l)  => s + l.valorTotal, 0); }
  get subTotalJuridico(): number { return this.linhasJuridico.reduce((s,l) => s + l.valorTotal, 0); }
  get subTotalPago():     number { return this.linhasPago.reduce((s,l)     => s + l.valorTotal, 0); }

  get variacaoCarteira(): number { return this.resumo?.anterior ? this.resumo.totalCarteira - this.resumo.anterior.totalCarteira : 0; }
  get variacaoPct():      number { return this.resumo?.anterior ? this.resumo.pctInadimplencia - this.resumo.anterior.pctInadimplencia : 0; }
  get totalPaginas():     number { return Math.ceil((this.titulos?.total ?? 0) / this.POR_PAGINA); }

  abs(n: number): number { return Math.abs(n); }

  constructor() {
    afterNextRender(() => { this.cdr.detectChanges(); });
  }

  // ─── MOCK DATA ────────────────────────────────────────────────────────────
  private carregarDadosMock() {
    this.resumo = {
      totalCarteira:    12_467_303,
      totalPago:         8_069_329,
      inadimplencia:     8_070_479,
      pctInadimplencia:  33,
      aProtestar:        1_222_141,
      retornoCobranca:   13,
      emGarantia:          842_190,
      qtdGarantia:             34,
      anterior: {
        totalCarteira:   12_284_000,
        inadimplencia:    7_920_000,
        pctInadimplencia: 31.8,
      },
      linhas: [
        { situacao: 'A_VENCER', status: 'A vencer',        totalTitulos: 1_240, valorTotal: 5_219_509 },
        { situacao: 'A_VENCER', status: 'Cliente especial',totalTitulos:   87,  valorTotal:   154_334 },
        { situacao: 'A_VENCER', status: 'Leal Moreira',    totalTitulos:   12,  valorTotal:     2_746 },
        { situacao: 'A_VENCER', status: 'Condicionado',    totalTitulos:   54,  valorTotal:    12_068 },
        { situacao: 'VENCIDO',  status: 'Cobrança interna',totalTitulos:  312,  valorTotal:   901_292 },
        { situacao: 'VENCIDO',  status: 'Protestado',      totalTitulos:   98,  valorTotal:   252_842 },
        { situacao: 'VENCIDO',  status: 'Cliente especial',totalTitulos:  143,  valorTotal:   315_757 },
        { situacao: 'VENCIDO',  status: 'Leal Moreira',    totalTitulos:   31,  valorTotal:    17_369 },
        { situacao: 'VENCIDO',  status: 'Condicionado',    totalTitulos:   67,  valorTotal:   156_280 },
        { situacao: 'VENCIDO',  status: 'Marco Antonio',   totalTitulos:   28,  valorTotal:    64_289 },
        { situacao: 'JURIDICO', status: 'Mendes',          totalTitulos:  589,  valorTotal: 3_124_122 },
        { situacao: 'JURIDICO', status: 'Jailton',         totalTitulos:  258,  valorTotal: 1_272_701 },
        { situacao: 'PAGO',     status: 'Cobrança interna',totalTitulos:  421,  valorTotal: 1_050_966 },
        { situacao: 'PAGO',     status: 'Protestado',      totalTitulos:   87,  valorTotal:    92_410 },
        { situacao: 'PAGO',     status: 'Cliente especial',totalTitulos:  156,  valorTotal:   185_861 },
        { situacao: 'PAGO',     status: 'Leal Moreira',    totalTitulos:   23,  valorTotal:    16_807 },
        { situacao: 'PAGO',     status: 'Condicionado',    totalTitulos:  892,  valorTotal: 6_294_245 },
        { situacao: 'PAGO',     status: 'Marco Antonio',   totalTitulos:   41,  valorTotal:    37_092 },
      ],
      faixas: [
        { label: 'Até 7 dias — vencido recente', diasMin: 0,   diasMax: 7,   valor:   324_180, qtd: 187, acao: 'Cobrança interna', nivel: 'recente' },
        { label: '8 a 15 dias — aviso Serasa',   diasMin: 8,   diasMax: 15,  valor:   489_230, qtd: 203, acao: 'Notificação preventiva', nivel: 'aviso' },
        { label: '16 a 30 dias',                 diasMin: 16,  diasMax: 30,  valor:   732_941, qtd: 318, acao: 'Protestar', nivel: 'medio' },
        { label: '31 a 90 dias — 3 meses',       diasMin: 31,  diasMax: 90,  valor: 1_134_882, qtd: 421, acao: 'Cobrança ativa', nivel: 'critico' },
        { label: '91 a 180 dias — 6 meses',      diasMin: 91,  diasMax: 180, valor:   892_470, qtd: 289, acao: 'Negociação / acordo', nivel: 'grave' },
        { label: 'Mais de 180 dias — jurídico',  diasMin: 181, diasMax: null,valor: 4_396_824, qtd: 847, acao: 'Mendes / Jailton', nivel: 'juridico' },
      ],
      evolucao: [
        { data: '2026-04-16', pctInadimplencia: 29.1, valorCarteira: 11_800_000 },
        { data: '2026-04-17', pctInadimplencia: 29.4, valorCarteira: 11_850_000 },
        { data: '2026-04-18', pctInadimplencia: 29.8, valorCarteira: 11_900_000 },
        { data: '2026-04-21', pctInadimplencia: 30.1, valorCarteira: 11_980_000 },
        { data: '2026-04-22', pctInadimplencia: 30.5, valorCarteira: 12_050_000 },
        { data: '2026-04-23', pctInadimplencia: 30.9, valorCarteira: 12_100_000 },
        { data: '2026-04-24', pctInadimplencia: 31.2, valorCarteira: 12_150_000 },
        { data: '2026-04-25', pctInadimplencia: 31.0, valorCarteira: 12_120_000 },
        { data: '2026-04-28', pctInadimplencia: 31.4, valorCarteira: 12_180_000 },
        { data: '2026-04-29', pctInadimplencia: 31.8, valorCarteira: 12_220_000 },
        { data: '2026-04-30', pctInadimplencia: 31.5, valorCarteira: 12_200_000 },
        { data: '2026-05-02', pctInadimplencia: 32.0, valorCarteira: 12_280_000 },
        { data: '2026-05-05', pctInadimplencia: 32.4, valorCarteira: 12_310_000 },
        { data: '2026-05-06', pctInadimplencia: 32.9, valorCarteira: 12_380_000 },
        { data: '2026-05-07', pctInadimplencia: 32.6, valorCarteira: 12_350_000 },
        { data: '2026-05-08', pctInadimplencia: 33.0, valorCarteira: 12_420_000 },
        { data: '2026-05-09', pctInadimplencia: 33.0, valorCarteira: 12_467_303 },
      ],
      retornoPorCobrador: [
        { cobrador: 'Condicionado',    valor: 6_294_245, pct: 78 },
        { cobrador: 'Cobrança interna',valor: 1_050_966, pct: 54 },
        { cobrador: 'Cliente especial',valor:   185_861, pct: 37 },
        { cobrador: 'Protestado',      valor:    92_410, pct: 27 },
        { cobrador: 'Leal Moreira',    valor:    16_807, pct: 49 },
        { cobrador: 'Marco Antonio',   valor:    37_092, pct: 37 },
      ],
    };

    this.titulos = {
      total:       2_847,
      valorTotal:  12_467_303,
      pagina:      1,
      porPagina:   this.POR_PAGINA,
      dados: [
        { idEmpresa:1, empresaAlias:'HCAB', idClifor:107454, nomeCliente:'Carolina Azevedo',              idTitulo:577420,  digitoTitulo:'1', valTitulo:608.85,    valLiquido:608.85,    sumPagamento:0,        valDesconto:null,    dtMovimento:'2017-11-24', dtVencimento:'2017-11-25', situacao:'JURIDICO', status:'Perda',           emGarantia:true,  banco:'Banco do Brasil', diasVencido:3087 },
        { idEmpresa:2, empresaAlias:'SHRM', idClifor:227780, nomeCliente:'Livia Santana Marques',         idTitulo:208082,  digitoTitulo:'4', valTitulo:2985.14,   valLiquido:2985.14,   sumPagamento:2190.39,  valDesconto:null,    dtMovimento:'2019-05-30', dtVencimento:'2019-09-27', situacao:'VENCIDO',  status:'Cliente especial',emGarantia:false, banco:'Banco do Brasil', diasVencido:2415 },
        { idEmpresa:1, empresaAlias:'HCAB', idClifor:128852, nomeCliente:'Thiago Vidal',                  idTitulo:4376,    digitoTitulo:'10',valTitulo:565.48,    valLiquido:565.48,    sumPagamento:533.39,   valDesconto:null,    dtMovimento:'2020-04-09', dtVencimento:'2021-02-03', situacao:'VENCIDO',  status:'Cob. interna',    emGarantia:false, banco:'Banco do Brasil', diasVencido:1918 },
        { idEmpresa:1, empresaAlias:'HCAB', idClifor:1017405,nomeCliente:'Verena Azevedo Ferreira de',    idTitulo:6562,    digitoTitulo:'1', valTitulo:1258.00,   valLiquido:1258.00,   sumPagamento:0,        valDesconto:null,    dtMovimento:'2020-10-23', dtVencimento:'2020-11-22', situacao:'VENCIDO',  status:'Cliente especial',emGarantia:true,  banco:'Banco do Brasil', diasVencido:1994 },
        { idEmpresa:1, empresaAlias:'HCAB', idClifor:1035849,nomeCliente:'S.C Chady Serviços e Construção',idTitulo:955712, digitoTitulo:'1', valTitulo:729.10,    valLiquido:4690.15,   sumPagamento:0,        valDesconto:null,    dtMovimento:'2021-03-05', dtVencimento:'2021-04-04', situacao:'VENCIDO',  status:'Cliente especial',emGarantia:false, banco:null,             diasVencido:1856 },
        { idEmpresa:2, empresaAlias:'SHRM', idClifor:88341,  nomeCliente:'Ana Paula Ferreira Lima',       idTitulo:771209,  digitoTitulo:'3', valTitulo:3420.00,   valLiquido:3420.00,   sumPagamento:0,        valDesconto:null,    dtMovimento:'2026-03-15', dtVencimento:'2026-06-15', situacao:'A_VENCER', status:'Condicionado',    emGarantia:true,  banco:'Bradesco',        diasVencido:0 },
        { idEmpresa:1, empresaAlias:'HCAB', idClifor:55129,  nomeCliente:'Construções Belém LTDA',        idTitulo:884512,  digitoTitulo:'2', valTitulo:8750.00,   valLiquido:8750.00,   sumPagamento:0,        valDesconto:null,    dtMovimento:'2026-04-01', dtVencimento:'2026-07-01', situacao:'A_VENCER', status:'A vencer',        emGarantia:false, banco:null,             diasVencido:0 },
        { idEmpresa:6, empresaAlias:'HCVR', idClifor:73310,  nomeCliente:'Roberto Figueiredo Santos',     idTitulo:334780,  digitoTitulo:'5', valTitulo:1890.50,   valLiquido:1620.30,   sumPagamento:1620.30,  valDesconto:270.20,  dtMovimento:'2026-03-20', dtVencimento:'2026-05-05', situacao:'PAGO',     status:'Cobrança interna',emGarantia:false, banco:null,             diasVencido:0 },
        { idEmpresa:1, empresaAlias:'HCAB', idClifor:91402,  nomeCliente:'Maria das Graças Oliveira',     idTitulo:118994,  digitoTitulo:'1', valTitulo:435.00,    valLiquido:435.00,    sumPagamento:0,        valDesconto:null,    dtMovimento:'2026-04-20', dtVencimento:'2026-05-01', situacao:'VENCIDO',  status:'Cobrança interna',emGarantia:false, banco:null,             diasVencido:8 },
        { idEmpresa:7, empresaAlias:'HCAM', idClifor:48821,  nomeCliente:'Distribuidora Norte LTDA',      idTitulo:662341,  digitoTitulo:'3', valTitulo:15_400.00, valLiquido:15_400.00, sumPagamento:0,        valDesconto:null,    dtMovimento:'2025-11-10', dtVencimento:'2026-02-10', situacao:'VENCIDO',  status:'Protestado',      emGarantia:true,  banco:'Caixa',           diasVencido:88 },
      ],
    };
  }

  // ─── Buscar ───────────────────────────────────────────────────────────────
  buscarPainel() {
    if (!this.dataInicio) { this.erroFiltro = 'Selecione ao menos a data inicial.'; return; }
    this.erroFiltro = '';
    this.dadosCarregados = true;
    this.carregandoPainel = true;
    this.cdr.detectChanges();

    // TODO: substituir pelo endpoint real quando o SQL chegar
    // this.http.get<ResumoConsolidado>(`${this.api}/financeiro/credito-cobranca/resumo?${this.buildParams()}`)
    setTimeout(() => {
      this.carregarDadosMock();
      this.carregandoPainel = false;
      this.cdr.detectChanges();
      if (this.abaSelecionada === 'graficos') {
        setTimeout(() => this.desenharGraficos(), 100);
      }
    }, 600);
  }

  buscarRelatorio(pagina = 1) {
    if (!this.dataInicio) { this.erroFiltro = 'Selecione ao menos a data inicial.'; return; }
    this.erroFiltro = '';
    this.dadosCarregados = true;
    this.paginaAtual = pagina;
    this.carregandoRelatorio = true;
    this.cdr.detectChanges();

    setTimeout(() => {
      if (!this.titulos) this.carregarDadosMock();
      this.carregandoRelatorio = false;
      this.cdr.detectChanges();
    }, 400);
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
    alert('Exportação será habilitada quando o backend estiver conectado.');
  }

  limpar() {
    this.dataInicio = this.hoje();
    this.dataFim = this.empresaFiltro = '';
    this.filtroSituacao = this.filtroStatus = this.filtroFaixa = this.filtroGarantia = '';
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
    return p.join('&');
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