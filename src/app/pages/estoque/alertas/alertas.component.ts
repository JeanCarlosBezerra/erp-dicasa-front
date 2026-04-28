import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { firstValueFrom } from 'rxjs';

interface Empresa { IDEMPRESA: number; EMPALIAS: string; nome?: string; }
interface Divisao { IDDIVISAO: number; DESCRDIVISAO: string; }
interface Secao   { IDSECAO: number;   DESCRSECAO: string; }

interface ProdutoRuptura {
  IDPRODUTO: number; DESCRCOMPRODUTO: string;
  IDEMPRESA: number; DESCRSECAO: string; DESCRDIVISAO: string;
  SALDO: number; ULTIMA_VENDA: string;
  DIAS_SEM_VENDA: number; QTD_VENDIDA_MES: number;
}

interface ProdutoSemGiro {
  IDPRODUTO: number; DESCRCOMPRODUTO: string;
  IDEMPRESA: number; DESCRSECAO: string; DESCRDIVISAO: string;
  SALDO: number; ULTIMA_VENDA: string;
  DIAS_SEM_GIRO: number; CAPITAL_PARADO: number;
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

  // Filtros
  empresas: Empresa[] = [];
  divisoes: Divisao[] = [];
  secoes:   Secao[]   = [];
  empresaFiltro = '';
  divisaoFiltro = '';
  secaoFiltro   = '';
  diasSemGiro   = 60;

  // Dados
  totais: any = {};
  ruptura:  ProdutoRuptura[]  = [];
  semGiro:  ProdutoSemGiro[]  = [];

  carregandoTotais  = true;
  carregandoRuptura = true;
  carregandoGiro    = true;
  dadosCarregados = false;

  abaSelecionada: 'ruptura' | 'semgiro' | 'heatmap' = 'ruptura';

  // Paginação
  paginaRuptura = 1;
  paginaGiro    = 1;
  readonly POR_PAGINA = 20;

  

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

  get heatmapDados(): { secao: string; divisao: string; ruptura: number; semGiro: number; capital: number; }[] {
  const mapa = new Map<string, { secao: string; divisao: string; ruptura: number; semGiro: number; capital: number }>();

  this.ruptura.forEach(p => {
    const key = p.DESCRSECAO;
    if (!mapa.has(key)) mapa.set(key, { secao: p.DESCRSECAO, divisao: p.DESCRDIVISAO, ruptura: 0, semGiro: 0, capital: 0 });
    mapa.get(key)!.ruptura++;
  });

  this.semGiro.forEach(p => {
    const key = p.DESCRSECAO;
    if (!mapa.has(key)) mapa.set(key, { secao: p.DESCRSECAO, divisao: p.DESCRDIVISAO, ruptura: 0, semGiro: 0, capital: 0 });
    mapa.get(key)!.semGiro++;
    mapa.get(key)!.capital += Number(p.CAPITAL_PARADO || 0);
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
      // ← remove o carregarTudo() daqui
    });
  }

  buscar() {
    if (!this.empresaFiltro) {
      this.erroFiltro = 'Selecione uma empresa para buscar.';
      return;
    }
    this.erroFiltro = '';
    this.dadosCarregados = true;
    this.carregarTudo();
  }
  erroFiltro = '';

  private get params(): string {
    const p: string[] = ['limite=500'];
    if (this.empresaFiltro) p.push(`empresa=${this.empresaFiltro}`);
    if (this.divisaoFiltro) p.push(`divisao=${this.divisaoFiltro}`);
    if (this.secaoFiltro)   p.push(`secao=${this.secaoFiltro}`);
    return p.length ? '?' + p.join('&') : '';
  }

 carregarEmpresas() {
   this.http.get<Empresa[]>(`${this.api}/empresas`).subscribe({
     next: e => { 
       this.empresas = e.filter(x => x.IDEMPRESA <= 10);
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
      // ← SEM aplicarFiltros() aqui
    }

async carregarTudo() {
  this.carregandoTotais  = true;
  this.carregandoRuptura = true;
  this.carregandoGiro    = true;

  // Sequencial — uma query de cada vez
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
    this.http.get<ProdutoSemGiro[]>(`${this.api}/estoque/alertas/sem-giro${this.params}&dias=${this.diasSemGiro}`)
  ).then(g => {
    this.semGiro = g;
    this.paginaGiro = 1;
    this.carregandoGiro = false;
    this.cdr.detectChanges();
  }).catch(() => { this.carregandoGiro = false; });
}

carregarTotais() {
  this.carregandoTotais = true;
  this.http.get<any>(`${this.api}/estoque/alertas/totais${this.params}`).subscribe({
    next: t => { this.totais = t; this.carregandoTotais = false; this.cdr.detectChanges(); },
    error: () => { this.carregandoTotais = false; this.cdr.detectChanges(); }
  });
}

  carregarRuptura() {
    this.carregandoRuptura = true;
    this.paginaRuptura = 1;
    this.http.get<ProdutoRuptura[]>(`${this.api}/estoque/alertas/ruptura${this.params}`).subscribe({
      next: r => { this.ruptura = r; this.carregandoRuptura = false; this.cdr.detectChanges(); },
      error: () => { this.carregandoRuptura = false; this.cdr.detectChanges(); }
    });
  }

  carregarSemGiro() {
    this.carregandoGiro = true;
    this.paginaGiro = 1;
    const extra = this.params ? this.params + `&dias=${this.diasSemGiro}` : `?dias=${this.diasSemGiro}`;
    this.http.get<ProdutoSemGiro[]>(`${this.api}/estoque/alertas/sem-giro${extra}`).subscribe({
      next: g => { this.semGiro = g; this.carregandoGiro = false; this.cdr.detectChanges(); },
      error: () => { this.carregandoGiro = false; this.cdr.detectChanges(); }
    });
  }

  aplicarFiltros() {
    this.carregarTudo();
  }

  limparFiltros() {
    this.empresaFiltro = '';
    this.divisaoFiltro = '';
    this.secaoFiltro   = '';
    this.diasSemGiro   = 60;
    this.secoes        = [];
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