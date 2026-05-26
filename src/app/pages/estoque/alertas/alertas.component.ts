import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { firstValueFrom } from 'rxjs';

const EMPRESAS_REMOVIDAS = ['CDBR', 'COJE', 'COM2', 'COM1'];

interface Empresa { IDEMPRESA: number; EMPALIAS: string; }
interface Divisao { IDDIVISAO: number; DESCRDIVISAO: string; }
interface Secao   { IDSECAO: number;   DESCRSECAO: string; }

interface ProdutoRuptura {
  IDPRODUTO: number;
  DESCRCOMPRODUTO: string;
  IDEMPRESA: number;
  IDSECAO: number;
  IDDIVISAO: number;
  SALDO: number;
  DIAS_SEM_VENDA: number;
  QTD_VENDIDA_MES: number;
  VALCUSTOMEDIO: number;
  MARCA: string;
  FLAG_INATIVO_COMPRA: string;
  FLAG_INATIVO_VENDA:  string;
}

interface ProdutoSemGiro {
  IDPRODUTO: number;
  DESCRCOMPRODUTO: string;
  IDEMPRESA: number;
  IDSECAO: number;
  IDDIVISAO: number;
  SALDO: number;
  DIAS_SEM_GIRO: number;
  CAPITAL_PARADO: number;
  QTD_VENDIDA_MES: number;
  MARCA: string;
  FLAG_INATIVO_COMPRA: string;
  FLAG_INATIVO_VENDA:  string;
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

  heatmapVisao: 'secao' | 'marca' = 'secao';
  

  // ─── Filtros obrigatórios ─────────────────────────────────────────────────
  empresas: Empresa[] = [];
  divisoes: Divisao[] = [];
  secoes:   Secao[]   = [];

  empresaFiltro = '';
  divisaoFiltro = '';
  secaoFiltro   = '';
  diasSemGiro   = 60;

  // ─── Filtros avançados (API) ──────────────────────────────────────────────
  minVendasMes    = '';
  maxVendasMes    = '';
  minCapital      = '';
  minSaldo        = '';
  maxDiasSemVenda = '';
  apenasAtivoCompra = false;
  apenasAtivoVenda  = false;  
  // ─── Filtros locais (frontend, sem nova chamada API) ──────────────────────
  filtroProduto = '';
  filtroMarca   = '';

  // ─── Dados brutos da API ──────────────────────────────────────────────────
  ruptura:  ProdutoRuptura[]  = [];
  semGiro:  ProdutoSemGiro[]  = [];

  carregandoRuptura = false;
  carregandoGiro    = false;
  dadosCarregados   = false;
  erroFiltro        = '';

  abaSelecionada: 'ruptura' | 'semgiro' | 'heatmap' = 'ruptura';

  // ─── Paginação ────────────────────────────────────────────────────────────
  paginaRuptura = 1;
  paginaGiro    = 1;
  readonly POR_PAGINA = 20;
  

  // ─── Ordenação ────────────────────────────────────────────────────────────
  sortColunaRuptura = 'DIAS_SEM_VENDA';
  sortDirRuptura:   'asc' | 'desc' = 'asc';
  sortColunaGiro    = 'DIAS_SEM_GIRO';
  sortDirGiro:      'asc' | 'desc' = 'desc';

  // ─── Filtros locais aplicados ─────────────────────────────────────────────
  get rupturaFiltrada(): ProdutoRuptura[] {
    let dados = this.ruptura;
    if (this.filtroProduto.trim()) {
      const t = this.filtroProduto.trim().toLowerCase();
      const n = Number(t);
      const ehNum = !isNaN(n) && t !== '';
      dados = dados.filter(p =>
        String(p.IDPRODUTO).includes(t) ||
        p.DESCRCOMPRODUTO.toLowerCase().includes(t)
      );
    }
    if (this.filtroMarca.trim()) {
      const t = this.filtroMarca.trim().toLowerCase();
      dados = dados.filter(p => (p.MARCA ?? '').toLowerCase().includes(t));
    }
    return this.sortArr(dados, this.sortColunaRuptura, this.sortDirRuptura);
  }

  get semGiroFiltrada(): ProdutoSemGiro[] {
    let dados = this.semGiro;
    if (this.filtroProduto.trim()) {
      const t = this.filtroProduto.trim().toLowerCase();
      const n = Number(t);
      const ehNum = !isNaN(n) && t !== '';
      dados = dados.filter(p =>
        ehNum ? p.IDPRODUTO === n : p.DESCRCOMPRODUTO.toLowerCase().includes(t)
      );
    }
    if (this.filtroMarca.trim()) {
      const t = this.filtroMarca.trim().toLowerCase();
      dados = dados.filter(p => (p.MARCA ?? '').toLowerCase().includes(t));
    }
    return this.sortArr(dados, this.sortColunaGiro, this.sortDirGiro);
  }

  private sortArr<T>(arr: T[], col: string, dir: 'asc' | 'desc'): T[] {
  return [...arr].sort((a: any, b: any) => {
    let va: any;
    let vb: any;

    // Custo rep. é calculado — ordena pelo valor real exibido
    if (col === 'VALCUSTOMEDIO') {
      va = (a.VALCUSTOMEDIO ?? 0) * (a.QTD_VENDIDA_MES ?? 0);
      vb = (b.VALCUSTOMEDIO ?? 0) * (b.QTD_VENDIDA_MES ?? 0);
    } else {
      va = a[col] ?? '';
      vb = b[col] ?? '';
    }

    const cmp = typeof va === 'number'
      ? va - vb
      : String(va).localeCompare(String(vb), 'pt-BR');

    return dir === 'asc' ? cmp : -cmp;
  });
}

  sortByRuptura(col: string) {
    if (this.sortColunaRuptura === col) {
      this.sortDirRuptura = this.sortDirRuptura === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColunaRuptura = col;
      this.sortDirRuptura = 'asc';
    }
    this.paginaRuptura = 1;
    this.cdr.detectChanges();
  }

  sortByGiro(col: string) {
    if (this.sortColunaGiro === col) {
      this.sortDirGiro = this.sortDirGiro === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortColunaGiro = col;
      this.sortDirGiro = 'asc';
    }
    this.paginaGiro = 1;
    this.cdr.detectChanges();
  }

  sortIconRuptura(col: string): string {
    if (this.sortColunaRuptura !== col) return 'unfold_more';
    return this.sortDirRuptura === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  sortIconGiro(col: string): string {
    if (this.sortColunaGiro !== col) return 'unfold_more';
    return this.sortDirGiro === 'asc' ? 'arrow_upward' : 'arrow_downward';
  }

  onFiltroProdutoChange() {
    this.paginaRuptura = 1;
    this.paginaGiro = 1;
    this.cdr.detectChanges();
  }

  onFiltroMarcaChange() {
    this.paginaRuptura = 1;
    this.paginaGiro = 1;
    this.cdr.detectChanges();
  }

  limparFiltrosLocais() {
    this.filtroProduto = '';
    this.filtroMarca   = '';
    this.paginaRuptura = 1;
    this.paginaGiro    = 1;
    this.cdr.detectChanges();
  }

  get totalEmRuptura(): number  { return this.ruptura.length; }
  get totalCritico(): number    { return this.semGiro.filter(p => p.DIAS_SEM_GIRO >= 30 && p.DIAS_SEM_GIRO < 60).length; }
  get totalSemGiro60(): number  { return this.semGiro.filter(p => p.DIAS_SEM_GIRO >= 60).length; }
get atingiuLimiteRuptura(): boolean { return this.ruptura.length >= 500; }
get atingiuLimiteGiro(): boolean    { return this.semGiro.length >= 150; }

  // ─── Faixas de ruptura ────────────────────────────────────────────────────
  get ruptura0_15():  ProdutoRuptura[] { return this.rupturaFiltrada.filter(p => p.DIAS_SEM_VENDA <= 15); }
  get ruptura15_30(): ProdutoRuptura[] { return this.rupturaFiltrada.filter(p => p.DIAS_SEM_VENDA > 15 && p.DIAS_SEM_VENDA <= 30); }
  get ruptura30_60(): ProdutoRuptura[] { return this.rupturaFiltrada.filter(p => p.DIAS_SEM_VENDA > 30 && p.DIAS_SEM_VENDA <= 60); }
  get ruptura60plus():ProdutoRuptura[] { return this.rupturaFiltrada.filter(p => p.DIAS_SEM_VENDA > 60); }

  custoReposicao(items: ProdutoRuptura[]): number {
    return items.reduce((s, p) => s + (Number(p.VALCUSTOMEDIO || 0) * Number(p.QTD_VENDIDA_MES || 0)), 0);
  }

  // ─── Faixas de sem giro ───────────────────────────────────────────────────
  get semgiro30_60():  ProdutoSemGiro[] { return this.semGiroFiltrada.filter(p => p.DIAS_SEM_GIRO >= 30  && p.DIAS_SEM_GIRO < 60); }
  get semgiro60_90():  ProdutoSemGiro[] { return this.semGiroFiltrada.filter(p => p.DIAS_SEM_GIRO >= 60  && p.DIAS_SEM_GIRO < 90); }
  get semgiro90_180(): ProdutoSemGiro[] { return this.semGiroFiltrada.filter(p => p.DIAS_SEM_GIRO >= 90  && p.DIAS_SEM_GIRO < 180); }
  get semgiro180plus():ProdutoSemGiro[] { return this.semGiroFiltrada.filter(p => p.DIAS_SEM_GIRO >= 180); }

  capitalFaixa(items: ProdutoSemGiro[]): number {
    return items.reduce((s, p) => s + Number(p.CAPITAL_PARADO || 0), 0);
  }

  // ─── Cor Vnd/mês ──────────────────────────────────────────────────────────
  corVendasRuptura(qtd: number): string {
    if (qtd > 10) return 'vnd-alto';
    if (qtd >= 3) return 'vnd-medio';
    if (qtd >= 1) return 'vnd-baixo';
    return 'vnd-zero';
  }

  corVendasGiro(qtd: number): string {
    if (qtd === 0) return 'vnd-zero';
    if (qtd < 1)   return 'vnd-baixo';
    if (qtd < 5)   return 'vnd-medio';
    return 'vnd-alto';
  }

  // ─── Paginação ────────────────────────────────────────────────────────────
  get rupturaExibida(): ProdutoRuptura[] {
    const ini = (this.paginaRuptura - 1) * this.POR_PAGINA;
    return this.rupturaFiltrada.slice(ini, ini + this.POR_PAGINA);
  }
  get giroExibido(): ProdutoSemGiro[] {
    const ini = (this.paginaGiro - 1) * this.POR_PAGINA;
    return this.semGiroFiltrada.slice(ini, ini + this.POR_PAGINA);
  }
  get totalPaginasRuptura() { return Math.ceil(this.rupturaFiltrada.length / this.POR_PAGINA); }
  get totalPaginasGiro()    { return Math.ceil(this.semGiroFiltrada.length  / this.POR_PAGINA); }

  get capitalParadoTotal(): number {
    return this.semGiroFiltrada.reduce((s, p) => s + Number(p.CAPITAL_PARADO || 0), 0);
  }

  get custoReposicaoTotal(): number {
    return this.custoReposicao(this.rupturaFiltrada);
  }

  // ─── Heatmap ──────────────────────────────────────────────────────────────
  get heatmapDados() {
    const mapa = new Map<number, { secao: string; divisao: string; ruptura: number; semGiro: number; capital: number; }>();

    this.rupturaFiltrada.forEach(p => {
      if (!mapa.has(p.IDSECAO)) mapa.set(p.IDSECAO, { secao: this.nomeSecao(p.IDSECAO), divisao: this.nomeDivisao(p.IDDIVISAO), ruptura: 0, semGiro: 0, capital: 0 });
      mapa.get(p.IDSECAO)!.ruptura++;
    });

    this.semGiroFiltrada.forEach(p => {
      if (!mapa.has(p.IDSECAO)) mapa.set(p.IDSECAO, { secao: this.nomeSecao(p.IDSECAO), divisao: this.nomeDivisao(p.IDDIVISAO), ruptura: 0, semGiro: 0, capital: 0 });
      mapa.get(p.IDSECAO)!.semGiro++;
      mapa.get(p.IDSECAO)!.capital += Number(p.CAPITAL_PARADO || 0);
    });

    return Array.from(mapa.values()).sort((a, b) => (b.ruptura + b.semGiro) - (a.ruptura + a.semGiro));
  }

  get heatmapDadosMarca() {
  const mapa = new Map<string, { marca: string; ruptura: number; custoRep: number; }>();

  this.rupturaFiltrada.forEach(p => {
    const marca = (p.MARCA || '—').trim();
    if (!mapa.has(marca)) mapa.set(marca, { marca, ruptura: 0, custoRep: 0 });
    const entry = mapa.get(marca)!;
    entry.ruptura++;
    entry.custoRep += Number(p.VALCUSTOMEDIO || 0) * Number(p.QTD_VENDIDA_MES || 0);
  });

  return Array.from(mapa.values())
    .sort((a, b) => b.ruptura - a.ruptura);
}

get maxRupturaMarca(): number {
  return Math.max(...this.heatmapDadosMarca.map(h => h.ruptura), 1);
}

  get maxRuptura(): number { return Math.max(...this.heatmapDados.map(h => h.ruptura), 1); }
  get maxSemGiro(): number { return Math.max(...this.heatmapDados.map(h => h.semGiro), 1); }

  intensidade(val: number, max: number): string {
    const pct = val / max;
    if (pct === 0)   return 'zero';
    if (pct <= 0.25) return 'baixo';
    if (pct <= 0.5)  return 'medio';
    if (pct <= 0.75) return 'alto';
    return 'critico';
  }

  // ─── Helpers de nome ──────────────────────────────────────────────────────
  nomeDivisao(id: number): string { return this.divisoes.find(d => d.IDDIVISAO === id)?.DESCRDIVISAO ?? String(id); }
  nomeSecao(id: number): string   { return this.secoes.find(s => s.IDSECAO === id)?.DESCRSECAO ?? String(id); }
  nomeEmpresa(id: number): string { return this.empresas.find(e => e.IDEMPRESA === id)?.EMPALIAS ?? String(id); }

  constructor() {
    afterNextRender(() => {
      this.carregarEmpresas();
      this.carregarDivisoes();
    });
  }

  buscar() {
    if (!this.empresaFiltro) { this.erroFiltro = 'Selecione uma empresa para buscar.'; return; }
    if (!this.divisaoFiltro) { this.erroFiltro = 'Selecione uma divisão para buscar.'; return; }
    this.erroFiltro = '';
    this.dadosCarregados = true;
    this.filtroProduto = '';
    this.filtroMarca   = '';
    this.carregarTudo();
  }

  private get params(): string {
    const p: string[] = ['limite=500'];
    if (this.empresaFiltro)    p.push(`empresa=${this.empresaFiltro}`);
    if (this.divisaoFiltro)    p.push(`divisao=${this.divisaoFiltro}`);
    if (this.secaoFiltro)      p.push(`secao=${this.secaoFiltro}`);
    if (this.minVendasMes)     p.push(`minVendasMes=${this.minVendasMes}`);
    if (this.maxVendasMes)     p.push(`maxVendasMes=${this.maxVendasMes}`);
    if (this.minCapital)       p.push(`minCapital=${this.minCapital}`);
    if (this.minSaldo)         p.push(`minSaldo=${this.minSaldo}`);
    if (this.maxDiasSemVenda)  p.push(`maxDiasSemVenda=${this.maxDiasSemVenda}`);
    if (this.apenasAtivoCompra) p.push(`apenasAtivoCompra=true`);
    if (this.apenasAtivoVenda)  p.push(`apenasAtivoVenda=true`);
    return '?' + p.join('&');
  }

  getUltimaVenda(diasAtras: number): string {
    if (!diasAtras && diasAtras !== 0) return '—';
    const d = new Date();
    d.setDate(d.getDate() - diasAtras);
    return d.toLocaleDateString('pt-BR');
  }

  carregarEmpresas() {
    this.http.get<Empresa[]>(`${this.api}/empresas`).subscribe({
      next: e => {
        this.empresas = e.filter(x => x.IDEMPRESA <= 10 && !EMPRESAS_REMOVIDAS.includes((x.EMPALIAS ?? '').trim().toUpperCase()));
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

  async carregarTudo() {
    this.carregandoRuptura = this.carregandoGiro = true;
  
    await firstValueFrom(
      this.http.get<ProdutoRuptura[]>(`${this.api}/estoque/alertas/ruptura${this.params}`)
    ).then(r => {
      this.ruptura = r;
      this.paginaRuptura = 1;
      this.carregandoRuptura = false;
      this.cdr.detectChanges();
    }).catch(() => { this.carregandoRuptura = false; });
    const limiteSemGiro = this.secaoFiltro ? 500 : 150;
    await firstValueFrom(
      this.http.get<ProdutoSemGiro[]>(
        `${this.api}/estoque/alertas/sem-giro${this.params}&dias=${this.diasSemGiro}&limite=${limiteSemGiro}`
      )
    ).then(g => {
      this.semGiro = g;
      this.paginaGiro = 1;
      this.carregandoGiro = false;
      this.cdr.detectChanges();
    }).catch(() => { this.carregandoGiro = false; });
  }

  limparFiltros() {
    this.empresaFiltro = this.divisaoFiltro = this.secaoFiltro = '';
    this.diasSemGiro = 60;
    this.minVendasMes = this.maxVendasMes = this.minCapital = this.minSaldo = this.maxDiasSemVenda = '';
    this.filtroProduto = this.filtroMarca = '';
    this.secoes = [];
    this.dadosCarregados = false;
    this.ruptura = []; this.semGiro = []; 
    this.apenasAtivoCompra = false;
    this.apenasAtivoVenda  = false;
    this.cdr.detectChanges();
  }

  moeda(v: number): string { return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  corDias(dias: number): string { if (dias <= 7) return 'urgente'; if (dias <= 30) return 'alerta'; return 'normal'; }
}