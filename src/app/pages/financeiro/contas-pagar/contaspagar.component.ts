import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ContasPagarService, PainelPagar, LinhaPagar, LinhaPago, FaixaPagar, FornecedorTop } from '../../../services/contaspagar.service';

@Component({
  selector: 'app-contaspagar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './contaspagar.component.html',
  styleUrls: ['./contaspagar.component.scss'],   // copie o creditocobranca.component.scss
})
export class ContasPagarComponent {
  private cdr = inject(ChangeDetectorRef);
  private api = inject(ContasPagarService);

  dataInicio = this.primeiroDiaMes();   // abre no mês corrente (pago no período enche sozinho)
  dataFim = this.ultimoDiaMes();
  empresaFiltro = '';
  fornecedorFiltro = '';

  carregando = false;
  dadosCarregados = false;
  erro = '';

  // KPIs
  totalPagarBruto = 0; totalPagarSaldo = 0;
  aVencer = 0; vencidoAtraso = 0; vence7dias = 0; pagoPeriodo = 0;

  linhas: LinhaPagar[] = [];
  pagos: LinhaPago[] = [];
  faixas: FaixaPagar[] = [];
  topFornecedores: FornecedorTop[] = [];

  constructor() {
    afterNextRender(() => { this.buscar(); this.cdr.detectChanges(); });
  }

  buscar() {
    this.carregando = true;
    this.erro = '';
    this.cdr.detectChanges();

    this.api.getPainel(this.dataInicio, this.dataFim || undefined, this.empresaFiltro || undefined).subscribe({
      next: (p) => {
        this.totalPagarBruto = p.totalPagarBruto;
        this.totalPagarSaldo = p.totalPagarSaldo;
        this.aVencer = p.aVencer;
        this.vencidoAtraso = p.vencidoAtraso;
        this.vence7dias = p.vence7dias;
        this.pagoPeriodo = p.pagoPeriodo;
        this.linhas = p.linhas;
        this.pagos = p.pagos;
        this.faixas = p.faixas;
        this.topFornecedores = p.topFornecedores;

        this.carregando = false;
        this.dadosCarregados = true;
        this.cdr.detectChanges();
      },
      error: (e) => {
        console.error('Erro ao carregar Contas a Pagar', e);
        this.erro = 'Não foi possível carregar os dados.';
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }

  limpar() {
    this.dataInicio = this.primeiroDiaMes();
    this.dataFim = this.ultimoDiaMes();
    this.empresaFiltro = this.fornecedorFiltro = '';
    this.dadosCarregados = false;
    this.cdr.detectChanges();
  }

  // ── getters de subtotal (mesma lógica do C&C) ──
  get linhasAVencer(): LinhaPagar[] { return this.linhas.filter(l => l.situacao === 'A_VENCER'); }
  get linhasVencido(): LinhaPagar[] { return this.linhas.filter(l => l.situacao === 'VENCIDO'); }
  get subTotalAVencer(): number { return this.linhasAVencer.reduce((s, l) => s + l.valorTotal, 0); }
  get subTotalVencido(): number { return this.linhasVencido.reduce((s, l) => s + l.valorTotal, 0); }
  get totalPago(): number { return this.pagos.reduce((s, l) => s + l.valorTotal, 0); }
  get pctVencido(): number {
    const base = this.aVencer + this.vencidoAtraso;
    return base > 0 ? Math.round((this.vencidoAtraso / base) * 1000) / 10 : 0;
  }
  get labelPeriodo(): string {
    if (!this.dataFim || this.dataFim === this.dataInicio) return `Posição em ${this.fmtDate(this.dataInicio)}`;
    return `${this.fmtDate(this.dataInicio)} a ${this.fmtDate(this.dataFim)}`;
  }

  // ── helpers (iguais ao C&C) ──
  private hoje(): string { return this.fmtLocal(new Date()); }
  private primeiroDiaMes(): string { const d = new Date(); return this.fmtLocal(new Date(d.getFullYear(), d.getMonth(), 1)); }
  private ultimoDiaMes(): string { const d = new Date(); return this.fmtLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
  private fmtLocal(d: Date): string {
    const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
  moeda(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  pct(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
  }
  fmtDate(s: string | null | undefined): string {
    if (!s || s.length < 10) return '—';
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  nivelClass(n: string): string {
    const m: Record<string, string> = {
      hoje: 'faixa-critico', semana: 'faixa-grave', proximo: 'faixa-aviso',
      medio: 'faixa-medio', longo: 'faixa-recente', recente: 'faixa-recente', atraso: 'faixa-juridico',
    };
    return m[n] ?? '';
  }
}