import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { firstValueFrom } from 'rxjs';

// Empresas removidas do dropdown (CDBR=4, COJE=5, COM2=3)
const EMPRESAS_REMOVIDAS = ['CDBR', 'COJE', 'COM2', 'COM1'];

interface Empresa { IDEMPRESA: number; EMPALIAS: string; nome?: string; }
interface Divisao { IDDIVISAO: number; DESCRDIVISAO: string; }
interface Secao   { IDSECAO: number;   DESCRSECAO: string; }

interface ProdutoRuptura {
  IDPRODUTO: number;
  DESCRCOMPRODUTO: string;
  IDEMPRESA: number;
  IDSECAO: number;    // ← ID em vez de string
  IDDIVISAO: number;  // ← ID em vez de string
  SALDO: number;
  ULTIMA_VENDA: string;
  DIAS_SEM_VENDA: number;
  QTD_VENDIDA_MES: number;
}
 
interface ProdutoSemGiro {
  IDPRODUTO: number;
  DESCRCOMPRODUTO: string;
  IDEMPRESA: number;
  IDSECAO: number;    // ← ID em vez de string
  IDDIVISAO: number;  // ← ID em vez de string
  SALDO: number;
  ULTIMA_VENDA: string;
  DIAS_SEM_GIRO: number;
  CAPITAL_PARADO: number;
  QTD_VENDIDA_MES: number;
}

@Component({
  selector: 'app-alertas',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './alertas.component.html',
  styleUrls: ['./alertas.component.scss'],
})
export class AlertasComponent {
  private cdr  = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private api  = environment.apiUrl;

  // ─── Filtros obrigatórios ─────────────────────────────────────────────────
  empresas: Empresa[] = [];
  divisoes: Divisao[] = [];
  secoes:   Secao[]   = [];

  empresaFiltro = '';
  divisaoFiltro = '';
  secaoFiltro   = '';
  diasSemGiro   = 60;

  // ─── Novos filtros avançados ──────────────────────────────────────────────
  minVendasMes   = '';   // ruptura e sem giro: mín. vendas no mês
  maxVendasMes   = '';   // ruptura e sem giro: máx. vendas no mês
  minCapital     = '';   // sem giro: capital parado mínimo R$
  minSaldo       = '';   // sem giro: quantidade mínima em estoque
  maxDiasSemVenda = '';  // ruptura: parado há no máximo X dias

  // ─── Dados ───────────────────────────────────────────────────────────────
  totais: any = {};
  ruptura:  ProdutoRuptura[]  = [];
  semGiro:  ProdutoSemGiro[]  = [];

  carregandoTotais  = false;
  carregandoRuptura = false;
  carregandoGiro    = false;
  dadosCarregados   = false;
  erroFiltro        = '';

  abaSelecionada: 'ruptura' | 'semgiro' | 'heatmap' = 'ruptura';

  // ─── Paginação ────────────────────────────────────────────────────────────
  paginaRuptura = 1;
  paginaGiro    = 1;
  readonly POR_PAGINA = 20;

  nomeDivisao(id: number): string {
    return this.divisoes.find(d => d.IDDIVISAO === id)?.DESCRDIVISAO ?? String(id);
  }
  
  nomeSecao(id: number): string {
    return this.secoes.find(s => s.IDSECAO === id)?.DESCRSECAO ?? String(id);
  }

  get rupturaExibida() {
    const ini = (this.paginaRuptura - 1) * this.POR_PAGINA;
    return this.ruptura.slice(ini, ini + this.POR_PAGINA);
  }
  get giroExibido() {
    const ini = (this.paginaGiro - 1) * this.POR_PAGINA;
    return this.semGiro.slice(ini, ini + this.POR_PAGINA);
  }
  get totalPaginasRuptura() { return Math.ceil(this.ruptura.length / this.POR_PAGINA); }
  get totalPaginasGiro()    { return Math.ceil(this.semGiro.length  / this.POR_PAGINA); }

  get capitalParadoTotal(): number {
    return this.semGiro.reduce((s, p) => s + Number(p.CAPITAL_PARADO || 0), 0);
  }

  // ─── Heatmap ──────────────────────────────────────────────────────────────
get heatmapDados() {
  const mapa = new Map<number, {
    secao: string; divisao: string;
    ruptura: number; semGiro: number; capital: number;
  }>();
 
  this.ruptura.forEach(p => {
    if (!mapa.has(p.IDSECAO)) {
      mapa.set(p.IDSECAO, {
        secao:   this.nomeSecao(p.IDSECAO),
        divisao: this.nomeDivisao(p.IDDIVISAO),
        ruptura: 0, semGiro: 0, capital: 0,
      });
    }
    mapa.get(p.IDSECAO)!.ruptura++;
  });
 
  this.semGiro.forEach(p => {
    if (!mapa.has(p.IDSECAO)) {
      mapa.set(p.IDSECAO, {
        secao:   this.nomeSecao(p.IDSECAO),
        divisao: this.nomeDivisao(p.IDDIVISAO),
        ruptura: 0, semGiro: 0, capital: 0,
      });
    }
    mapa.get(p.IDSECAO)!.semGiro++;
    mapa.get(p.IDSECAO)!.capital += Number(p.CAPITAL_PARADO || 0);
  });
 
  return Array.from(mapa.values())
    .sort((a, b) => (b.ruptura + b.semGiro) - (a.ruptura + a.semGiro));
}

  get maxRuptura(): number { return Math.max(...this.heatmapDados.map(h => h.ruptura), 1); }
  get maxSemGiro(): number { return Math.max(...this.heatmapDados.map(h => h.semGiro), 1); }

  intensidade(val: number, max: number): string {
    const pct = val / max;
    if (pct === 0)    return 'zero';
    if (pct <= 0.25)  return 'baixo';
    if (pct <= 0.5)   return 'medio';
    if (pct <= 0.75)  return 'alto';
    return 'critico';
  }

  constructor() {
    afterNextRender(() => {
      this.carregarEmpresas();
      this.carregarDivisoes();
    });
  }

  // ─── Buscar — empresa E divisão obrigatórias ──────────────────────────────
  buscar() {
    if (!this.empresaFiltro) {
      this.erroFiltro = 'Selecione uma empresa para buscar.';
      return;
    }
    if (!this.divisaoFiltro) {
      this.erroFiltro = 'Selecione uma divisão para buscar.';
      return;
    }
    this.erroFiltro = '';
    this.dadosCarregados = true;
    this.carregarTudo();
  }

  // ─── Monta query string com todos os filtros ──────────────────────────────
  private get params(): string {
    const p: string[] = ['limite=500'];
    if (this.empresaFiltro)  p.push(`empresa=${this.empresaFiltro}`);
    if (this.divisaoFiltro)  p.push(`divisao=${this.divisaoFiltro}`);
    if (this.secaoFiltro)    p.push(`secao=${this.secaoFiltro}`);
    if (this.minVendasMes)   p.push(`minVendasMes=${this.minVendasMes}`);
    if (this.maxVendasMes)   p.push(`maxVendasMes=${this.maxVendasMes}`);
    if (this.minCapital)     p.push(`minCapital=${this.minCapital}`);
    if (this.minSaldo)       p.push(`minSaldo=${this.minSaldo}`);
    if (this.maxDiasSemVenda) p.push(`maxDiasSemVenda=${this.maxDiasSemVenda}`);
    return '?' + p.join('&');
  }

  getUltimaVenda(diasAtras: number): string {
     if (!diasAtras && diasAtras !== 0) return '—';
     const d = new Date();
     d.setDate(d.getDate() - diasAtras);
     return d.toLocaleDateString('pt-BR');
   }

  // ─── Carrega empresas — remove CDBR, COJE, COM2 ──────────────────────────
  carregarEmpresas() {
    this.http.get<Empresa[]>(`${this.api}/empresas`).subscribe({
      next: e => {
        this.empresas = e.filter(x =>
          x.IDEMPRESA <= 10 &&
          !EMPRESAS_REMOVIDAS.includes((x.EMPALIAS ?? '').trim().toUpperCase())
        );
        this.cdr.detectChanges();
      }
    });
  }

  carregarDivisoes() {
    this.http.get<Divisao[]>(`${this.api}/estoque/alertas/divisoes`).subscribe({
      next: d => { this.divisoes = d; this.cdr.detectChanges(); }
    });
  }

  onDivisaoChange() {
    this.secaoFiltro = '';
    this.secoes = [];
    if (!this.divisaoFiltro) return;
    this.http.get<Secao[]>(`${this.api}/estoque/alertas/secoes?divisao=${this.divisaoFiltro}`).subscribe({
      next: s => { this.secoes = s; this.cdr.detectChanges(); }
    });
  }

  // ─── Carrega tudo sequencialmente ────────────────────────────────────────
  async carregarTudo() {
    this.carregandoTotais  = true;
    this.carregandoRuptura = true;
    this.carregandoGiro    = true;

    await firstValueFrom(
      this.http.get<any>(`${this.api}/estoque/alertas/totais${this.params}`)
    ).then(t => {
      this.totais = t;
      this.carregandoTotais = false;
      this.cdr.detectChanges();
    }).catch(() => { this.carregandoTotais = false; });

    await firstValueFrom(
      this.http.get<ProdutoRuptura[]>(`${this.api}/estoque/alertas/ruptura${this.params}`)
    ).then(r => {
      this.ruptura = r;
      this.paginaRuptura = 1;
      this.carregandoRuptura = false;
      this.cdr.detectChanges();
    }).catch(() => { this.carregandoRuptura = false; });

    await firstValueFrom(
      this.http.get<ProdutoSemGiro[]>(
        `${this.api}/estoque/alertas/sem-giro${this.params}&dias=${this.diasSemGiro}`
      )
    ).then(g => {
      this.semGiro = g;
      this.paginaGiro = 1;
      this.carregandoGiro = false;
      this.cdr.detectChanges();
    }).catch(() => { this.carregandoGiro = false; });
  }

  aplicarFiltros() { this.carregarTudo(); }

  limparFiltros() {
    this.empresaFiltro  = '';
    this.divisaoFiltro  = '';
    this.secaoFiltro    = '';
    this.diasSemGiro    = 60;
    this.minVendasMes   = '';
    this.maxVendasMes   = '';
    this.minCapital     = '';
    this.minSaldo       = '';
    this.maxDiasSemVenda = '';
    this.secoes         = [];
    this.dadosCarregados = false;
    this.ruptura        = [];
    this.semGiro        = [];
    this.totais         = {};
    this.cdr.detectChanges();
  }

  nomeEmpresa(id: number): string {
    return this.empresas.find(e => e.IDEMPRESA === id)?.EMPALIAS ?? String(id);
  }

  moeda(v: number): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  corDias(dias: number): string {
    if (dias <= 7)  return 'urgente';
    if (dias <= 30) return 'alerta';
    return 'normal';
  }
}