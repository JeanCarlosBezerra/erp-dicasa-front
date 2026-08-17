import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { EmpresaService } from '../../../services/empresa.service';

interface VendedorDados {
  idVendedor: number;
  nome: string;
  qtdvenda: number;
  faturamento: number;
  lucro: number;
  margem: number;
  devolucoes: number;
  descontoValor: number;
  descontoPerc: number;
}

interface EmpresaLite {
  id: number;
  apelido: string;
}

@Component({
  selector: 'app-meu-painel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './meu-painel.component.html',
  styleUrls: ['./meu-painel.component.scss'],
})
export class MeuPainelComponent {
    private cdr  = inject(ChangeDetectorRef);
    private http = inject(HttpClient);
    private api  = environment.apiUrl;

  // ─── Perfil detectado do JWT ──────────────────────────────────────────────
  isAdmin       = false;
  isGestor      = false;   // tem COM_EMPRESA mas não é o próprio vendedor
  nomeUsuario   = '';
  empresasPermitidas: number[] = [];

  // ─── Filtros ──────────────────────────────────────────────────────────────
  empresas: EmpresaLite[] = [];
  empresaSelecionada = '';
  periodoLabel = 'Hoje';
  mostrarDataCustom = false;
  dataInicioCustom = '';
  dataFimCustom = '';

  dataInicio: string = this.hoje();
  dataFim:    string = this.hoje();

  readonly periodos = [
    { label: 'Hoje',         dias: 0 },
    { label: 'Esta semana',  dias: 7 },
    { label: 'Este mês',     dias: 30 },
    { label: 'Mês anterior', dias: -1 },
  ];

  // ─── Dados ────────────────────────────────────────────────────────────────
  todosVendedores: VendedorDados[] = [];
  meusDados:       VendedorDados | null = null;
  carregando = false;
  dadosCarregados = false;
  erroMsg = '';

  // ─── Visão gestor ─────────────────────────────────────────────────────────
  buscaVendedor = '';
  vendedorSelecionado: VendedorDados | null = null;



  // ─── Bota-Fora (MOCK — validar fonte: DIVISAO 23) ─────────────────────────
  // Quando ligar no backend: vendedor = só dele; gestor = SUM de todos da empresa
  private botaForaBase = {
    secoes: [
      { nome: 'Ferramentas Bota-Fora', valor: 4200, pct: 100 },
      { nome: 'Pintura Bota-Fora',     valor: 3100, pct: 74 },
      { nome: 'Ferragens Bota-Fora',   valor: 2600, pct: 62 },
      { nome: 'Automotivo Bota-Fora',  valor: 1580, pct: 38 },
      { nome: 'Banheiro Bota-Fora',    valor: 1000, pct: 24 },
    ],
  };

  get botaForaMock() {
    // Gestor: simula soma da equipe (multiplica o mock pra parecer agregado)
    // Vendedor: valor individual
    const fator = this.isGestor ? this.vendedoresFiltrados.length || 1 : 1;
    const secoes = this.botaForaBase.secoes.map(s => ({
      ...s, valor: s.valor * fator,
    }));
    const vendido = secoes.reduce((acc, s) => acc + s.valor, 0);
    const meta = this.isGestor ? 18000 * fator : 18000;
    const pctMeta = meta ? Math.round((vendido / meta) * 100) : 0;
    return { vendido, meta, pctMeta, secoes };
  } 

  get vendedoresFiltrados(): VendedorDados[] {
    const q = this.buscaVendedor.toLowerCase();
    return this.todosVendedores
      .filter(v => !v.nome.includes('-DEV(Reentrega)'))
      .filter(v => !q || v.nome.toLowerCase().includes(q))
      .sort((a, b) => b.faturamento - a.faturamento);
  }

  get dadosExibidos(): VendedorDados | null {
    return this.vendedorSelecionado ?? this.meusDados;
  }

  // ─── KPIs calculados ──────────────────────────────────────────────────────
  get totalEquipe(): number {
    return this.todosVendedores
      .filter(v => !v.nome.includes('-DEV(Reentrega)'))
      .reduce((s, v) => s + v.faturamento, 0);
  }

  get mediaFaturamento(): number {
    const v = this.vendedoresFiltrados;
    if (!v.length) return 0;
    return v.reduce((s, x) => s + x.faturamento, 0) / v.length;
  }

  get rankingPosicao(): number {
    if (!this.meusDados) return 0;
    const sorted = [...this.vendedoresFiltrados].sort((a, b) => b.faturamento - a.faturamento);
    return sorted.findIndex(v => v.idVendedor === this.meusDados!.idVendedor) + 1;
  }

  get diasUteis(): number {
    const hoje = new Date();
    const fim  = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
    let util = 0;
    const cur = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    while (cur <= fim) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) util++;
      cur.setDate(cur.getDate() + 1);
    }
    return util;
  }

  get diasUteisPassados(): number {
    const hoje = new Date();
    let util = 0;
    const cur = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    while (cur <= hoje) {
      const d = cur.getDay();
      if (d !== 0 && d !== 6) util++;
      cur.setDate(cur.getDate() + 1);
    }
    return util;
  }

  get diasUteisRestantes(): number {
    return Math.max(0, this.diasUteis - this.diasUteisPassados);
  }

  get mediadiaria(): number {
    if (!this.dadosExibidos || !this.diasUteisPassados) return 0;
    return this.dadosExibidos.faturamento / this.diasUteisPassados;
  }

  constructor(private empresaService: EmpresaService) {
    afterNextRender(() => {
      this.detectarPerfil();
      this.carregarEmpresas();
    });
  }

  // ─── Detecção de perfil via JWT ───────────────────────────────────────────
  private detectarPerfil() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = (payload.roles || '')
        .split(',').map((r: string) => r.trim()).filter(Boolean);

      this.nomeUsuario = payload.username || '';
      this.isAdmin = roles.includes('ADMIN');

      this.empresasPermitidas = roles
        .filter(r => r.startsWith('COM_EMPRESA_'))
        .map(r => parseInt(r.replace('COM_EMPRESA_', ''), 10))
        .filter(n => !isNaN(n));

      const temColaborador = roles.includes('COM_COLABORADOR');

      // Gestor = admin OU tem COM_COLABORADOR. COM_EMPRESA_X é só escopo de loja.
      this.isGestor = this.isAdmin || temColaborador;

      this.cdr.detectChanges();
    } catch { }
  }

  // ─── Empresas ─────────────────────────────────────────────────────────────
carregarEmpresas() {
  this.empresaService.getEmpresas().subscribe({
    next: lista => {
      if (this.isAdmin) {
        // Admin vê tudo
        this.empresas = lista.filter(e => e.id <= 10);
      } else if (this.empresasPermitidas.length > 0) {
        // Gestor — filtra pelas empresas permitidas
        this.empresas = lista.filter(e => this.empresasPermitidas.includes(e.id));
      } else {
        // Vendedor — sem COM_EMPRESA_X, pega todas pra buscar os dados
        // O backend já filtra pelo idVendedor via comercial_vendedores
        this.empresas = lista.filter(e => e.id <= 10);
      }

      if (this.empresas.length) {
        this.empresaSelecionada = String(this.empresas[0].id);
        this.carregar();
      }
      this.cdr.detectChanges();
    }
  });
}

  // ─── Período ──────────────────────────────────────────────────────────────
  selecionarPeriodo(p: { label: string; dias: number }) {
    this.periodoLabel = p.label;
    const hoje = new Date();

    if (p.dias === 0) {
      // Hoje
      this.dataInicio = this.dataFim = this.hoje();
    } else if (p.dias === -1) {
      // Mês anterior
      const m = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
      this.dataInicio = m.toISOString().slice(0, 10);
      this.dataFim    = new Date(hoje.getFullYear(), hoje.getMonth(), 0).toISOString().slice(0, 10);
    } else {
      // Últimos N dias
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - p.dias + 1);
      this.dataInicio = ini.toISOString().slice(0, 10);
      this.dataFim    = this.hoje();
    }

    this.carregar();
  }

  aplicarDataCustom() {
    if (!this.dataInicioCustom || !this.dataFimCustom) return;
    this.periodoLabel = 'Personalizado';
    this.dataInicio = this.dataInicioCustom;
    this.dataFim    = this.dataFimCustom;
    this.mostrarDataCustom = false;
    this.carregar();
  }

  // ─── Carregar dados ───────────────────────────────────────────────────────
  carregar() {
  if (!this.empresaSelecionada) return;
  this.carregando = true;
  this.erroMsg = '';
  this.vendedorSelecionado = null;
  this.cdr.detectChanges();

  // Vendedor sem empresa definida busca em todas
  const empresasParaBuscar = (!this.isAdmin && this.empresasPermitidas.length === 0)
    ? this.empresas.map(e => e.id).join(',')
    : this.empresaSelecionada;

  const url = `${this.api}/comercial/colaborador/produtividade`
    + `?idempresa=${empresasParaBuscar}`
    + `&dataInicio=${this.dataInicio}&dataFim=${this.dataFim}`;

  this.http.get<VendedorDados[]>(url).subscribe({
    next: dados => {
      this.todosVendedores = dados;
      this.dadosCarregados = true;
      this.carregando = false;
      if (!this.isGestor) {
        // Backend já devolveu SÓ o vendedor logado. Pega a linha principal (sem -DEV).
        this.meusDados = dados.find(v => !v.nome.includes('-DEV(Reentrega)')) ?? dados[0] ?? null;
      }
      this.cdr.detectChanges();
    },
    error: () => {
      this.erroMsg = 'Erro ao carregar dados. Tente novamente.';
      this.carregando = false;
      this.cdr.detectChanges();
    }
  });
}


  selecionarVendedor(v: VendedorDados) {
    this.vendedorSelecionado = v;
    this.cdr.detectChanges();
  }

  voltarParaLista() {
    this.vendedorSelecionado = null;
    this.cdr.detectChanges();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  private hoje(): string { return new Date().toISOString().slice(0, 10); }

  iniciais(nome: string): string {
    return nome.split(' ').filter(Boolean).slice(0, 2)
      .map(n => n[0]).join('').toUpperCase();
  }

  moeda(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  moedaK(v: number): string {
    if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1) + 'k';
    return 'R$ ' + this.moeda(v);
  }

  corMargem(m: number): string {
    if (m >= 20) return 'ok';
    if (m >= 10) return 'warn';
    return 'danger';
  }

  corDesconto(d: number): string {
    if (d <= 3) return 'ok';
    if (d <= 5) return 'warn';
    return 'danger';
  }

  barraVendedor(v: VendedorDados): number {
    const max = Math.max(...this.vendedoresFiltrados.map(x => x.faturamento), 1);
    return Math.round((v.faturamento / max) * 100);
  }

  nomeEmpresa(id: string): string {
    return this.empresas.find(e => String(e.id) === id)?.apelido ?? id;
  }

  abs(n: number): number { return Math.abs(n); }
}