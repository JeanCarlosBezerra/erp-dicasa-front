// src/app/pages/comercial/dashboard/dashboard-comercial.component.ts
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { firstValueFrom } from 'rxjs';

import {
  DashboardComercialService,
  MetaEmpresaApi,
} from '../../../services/dashboard-comercial.service';
import { EmpresaService } from '../../../services/empresa.service';
import {
  ComercialSetoresService, FaturamentoSetor, MetaSetorApi,
} from '../../../services/comercial-setores.service';
import { ExcecaoDiaVenda, contarDiasVenda, isoLocal } from '../../../services/dias-venda.util';

type IndicadorCard = {
  idEmpresa: number | null;
  faturamento: number;
  lucro: number;
  devolucoes: number;
  descontoValor: number;
  descontoPerc: number;
  apelido: string;
  metaFatProp: number;  // meta proporcional ao período filtrado
  metaMargem: number;   // fração (0.30 = 30%)
  // 41646: ticket médio
  qtdVendas: number;
  ticketMedio: number;  // venda bruta ÷ qtdVendas (igual ao CISS)
  metaTicket: number;   // meta cheia do mês (não proporcional)
  // Ritmo do mês (sugestões Ana Clara 2.1 e 2.2): base = do dia 1 até ontem
  metaMes: number;         // meta cheia do mês
  realizadoMes: number;    // faturamento do dia 1 até ontem
  // Dias de venda da loja (calendário de Metas > Dias de venda)
  diasMes: number;
  diasDecorridos: number;
  diasRestantes: number;
  fatorProp: number;       // dias de venda do período ÷ dias de venda do mês (meta proporcional)
};

/** Linha de setor dentro de uma loja (faturamento por departamento do vendedor). */
type SetorLinha = {
  idDepartamento: number;
  departamento: string;
  realizado: number;
  metaMes: number;
  metaProp: number;
};
type SetoresLoja = {
  idEmpresa: number;
  apelido: string;
  linhas: SetorLinha[];
  realizado: number;
  metaProp: number;
};

/** Contexto de dias do mês de referência (calendário geral: segunda a sábado + ajustes de todas as lojas). */
type RitmoMes = {
  mes: number;
  ano: number;
  inicio: Date;            // dia 1
  corte: Date | null;      // último dia fechado considerado (ontem, ou fim do mês se já passou)
  diasMes: number;         // dias de venda no mês
  diasDecorridos: number;  // dias de venda de 1 até o corte
  diasRestantes: number;   // dias de venda depois do corte até o fim do mês
};

@Component({
  selector: 'app-dashboard-comercial',
  templateUrl: './dashboard-comercial.component.html',
  styleUrls: ['./dashboard-comercial.component.scss'],
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, MatInputModule,
    MatDatepickerModule, MatNativeDateModule, MatButtonModule,
    MatIconModule, MatTooltipModule,
  ],
})
export class DashboardComercialComponent implements OnInit {
  constructor(
    private dashSvc: DashboardComercialService,
    private empresaSvc: EmpresaService,
    private setoresSvc: ComercialSetoresService,
    private cdr: ChangeDetectorRef
  ) {}

  cards: IndicadorCard[] = [];
  ritmo: RitmoMes | null = null;
  private excecoes: ExcecaoDiaVenda[] = [];

  // Faturamento por setor (sob demanda: consulta pesada no CISS)
  setoresLojas: SetoresLoja[] | null = null;
  carregandoSetores = false;
  erroSetores = '';
  lojaSetoresAberta: number | null = null;
  private mesRef = 0;
  private anoRef = 0;
  dataInicio = new Date();
  dataFim = new Date();
  carregando = false;
  modoCompartilhamento = false;
  toggleModoCompartilhamento() { this.modoCompartilhamento = !this.modoCompartilhamento; }

  get empresasPermitidas(): number[] {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return [];
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = Array.isArray(payload.roles)
        ? payload.roles
        : (payload.roles || '').split(',').map((r: string) => r.trim());

      // ADMIN ou sem restrição de empresa → vê tudo
      if (roles.includes('ADMIN')) return [];

      // Filtra roles COM_EMPRESA_X
      const empresaRoles = roles
        .filter(r => r.startsWith('COM_EMPRESA_'))
        .map(r => Number(r.replace('COM_EMPRESA_', '')));

      return empresaRoles; // vazio = vê tudo, preenchido = filtra
    } catch { return []; }
  }

  // ── Totais ──
  get faturamentoTotal(): number   { return this.cards.reduce((s, c) => s + (c.faturamento   || 0), 0); }
  get lucroTotal(): number         { return this.cards.reduce((s, c) => s + (c.lucro         || 0), 0); }
  get devolucoesTotal(): number    { return this.cards.reduce((s, c) => s + (c.devolucoes    || 0), 0); }
  get descontoTotalValor(): number { return this.cards.reduce((s, c) => s + (c.descontoValor || 0), 0); }
  get metaFatTotalProp(): number   { return this.cards.reduce((s, c) => s + (c.metaFatProp   || 0), 0); }
  get metaMesTotal(): number       { return this.cards.reduce((s, c) => s + (c.metaMes       || 0), 0); }
  get realizadoMesTotal(): number  { return this.cards.reduce((s, c) => s + (c.realizadoMes  || 0), 0); }

  get descontoTotalPerc(): number {
    const bruto = this.faturamentoTotal + this.descontoTotalValor;
    return bruto ? this.round(this.descontoTotalValor * 100 / bruto, 2) : 0;
  }

  // ── KPIs Geral ──
  get percFatGeral(): number { return this.metaFatTotalProp ? (this.faturamentoTotal / this.metaFatTotalProp) * 100 : 0; }
  get saldoFatGeral(): number { return this.faturamentoTotal - this.metaFatTotalProp; }
  get variacaoFatGeral(): number { return this.metaFatTotalProp ? ((this.faturamentoTotal / this.metaFatTotalProp) - 1) * 100 : 0; }
  get margemRealGeralPct(): number { return this.faturamentoTotal ? (this.lucroTotal / this.faturamentoTotal) * 100 : 0; }
  get metaLucroTotalGeral(): number { return this.cards.reduce((s, c) => s + (c.metaFatProp * c.metaMargem), 0); }
  get percLucroGeralVsMeta(): number { return this.metaLucroTotalGeral ? ((this.lucroTotal / this.metaLucroTotalGeral) - 1) * 100 : 0; }
  get saldoLucroGeral(): number { return this.lucroTotal - this.metaLucroTotalGeral; }
  get metaMargemGeralPct(): number { return this.metaFatTotalProp ? (this.metaLucroTotalGeral / this.metaFatTotalProp) * 100 : 0; }
  get diffMargemGeral(): number { return this.margemRealGeralPct - this.metaMargemGeralPct; }

  trackById(_i: number, c: IndicadorCard) { return c.idEmpresa ?? c.apelido; }

  ngOnInit() { this.buscar(); }

  private dataISO(d: Date) { return d?.toISOString().slice(0, 10); }

  /** Dias de venda entre duas datas: segunda a sábado + ajustes de Metas > Dias de venda (null = todas as lojas). */
  private diasUteis(inicio: Date, fim: Date, idEmpresa: number | null = null): number {
    return contarDiasVenda(inicio, fim, this.excecoes, idEmpresa);
  }

  private diasUteisMes(mes: number, ano: number, idEmpresa: number | null = null): number {
    return this.diasUteis(new Date(ano, mes - 1, 1), new Date(ano, mes, 0), idEmpresa);
  }

  /** Dias de venda do mês e o corte (ontem). Mês já encerrado: corte no último dia. */
  private calcularRitmo(mes: number, ano: number, idEmpresa: number | null = null): RitmoMes {
    const inicio = new Date(ano, mes - 1, 1);
    const fimMes = new Date(ano, mes, 0);
    const ontem = new Date(); ontem.setHours(0, 0, 0, 0); ontem.setDate(ontem.getDate() - 1);
    const corte = ontem < inicio ? null : (ontem > fimMes ? fimMes : ontem);
    const diasMes = this.diasUteis(inicio, fimMes, idEmpresa);
    const diasDecorridos = corte ? this.diasUteis(inicio, corte, idEmpresa) : 0;
    return { mes, ano, inicio, corte, diasMes, diasDecorridos, diasRestantes: Math.max(0, diasMes - diasDecorridos) };
  }

  /** Fator da meta proporcional = dias de venda do período ÷ dias de venda do mês (da loja). */
  private fatorProporcional(mes: number, ano: number, idEmpresa: number | null): number {
    const totalMes    = this.diasUteisMes(mes, ano, idEmpresa);
    const diasPeriodo = this.diasUteis(this.dataInicio, this.dataFim, idEmpresa);
    return totalMes === 0 ? 0 : diasPeriodo / totalMes;
  }

  async buscar() {
    this.carregando = true;
    this.cdr.markForCheck();
    try {
      const mes = this.dataInicio.getMonth() + 1;
      const ano = this.dataInicio.getFullYear();

      // Ritmo do mês: faturamento do dia 1 até ontem (reaproveita a consulta se o filtro já for esse)
      const ritmo = this.calcularRitmo(mes, ano);
      const iniMes = this.dataISO(ritmo.inicio);
      const fimCorte = ritmo.corte ? this.dataISO(ritmo.corte) : null;
      const mesmoPeriodo = fimCorte !== null
        && this.dataISO(this.dataInicio) === iniMes && this.dataISO(this.dataFim) === fimCorte;

      // Ajustes de dias de venda que cobrem o filtro e o mês de referência
      const fimMesRef = new Date(ano, mes, 0);
      const iniExc = this.dataInicio < ritmo.inicio ? this.dataInicio : ritmo.inicio;
      const fimExc = this.dataFim > fimMesRef ? this.dataFim : fimMesRef;

      const [empresas, indic, metasApi, indicMes, excecoes] = await Promise.all([
        firstValueFrom(this.empresaSvc.getEmpresas()),
        firstValueFrom(this.dashSvc.indicadores(this.dataISO(this.dataInicio), this.dataISO(this.dataFim))),
        firstValueFrom(this.dashSvc.getMetas(mes, ano)),
        fimCorte && !mesmoPeriodo
          ? firstValueFrom(this.dashSvc.indicadores(iniMes, fimCorte))
          : Promise.resolve(null),
        firstValueFrom(this.setoresSvc.excecoesPeriodo(isoLocal(iniExc), isoLocal(fimExc))).catch(() => [] as ExcecaoDiaVenda[]),
      ]);
      this.excecoes = (excecoes ?? []).map(e => ({ ...e, id_empresa: e.id_empresa == null ? null : Number(e.id_empresa) }));
      this.ritmo = this.calcularRitmo(mes, ano);   // recalcula com os ajustes de todas as lojas
      this.mesRef = mes;
      this.anoRef = ano;
      this.setoresLojas = null;                    // filtro mudou: setores precisam ser recarregados
      this.erroSetores = '';

      const realizadoMap = new Map<number, number>();
      (mesmoPeriodo ? indic : (indicMes ?? [])).forEach((i: any) => {
        const id = Number(i?.idEmpresa ?? i?.IDEMPRESA);
        if (Number.isFinite(id)) realizadoMap.set(id, Number(i?.faturamento ?? 0) || 0);
      });

      const empMap = new Map<number, string>();
      (empresas ?? []).forEach((e: any) => {
        const id = e.id ?? e.IDEMPRESA;
        const apelido = e.apelido ?? e.EMPALIAS ?? e.NOMEFANTASIA ?? String(id);
        if (id != null) empMap.set(Number(id), String(apelido));
      });

      const metaMap = new Map<number, MetaEmpresaApi>();
      (metasApi ?? []).forEach(m => metaMap.set(Number(m.id_empresa), m));

      this.cards = (indic ?? [])
        .map((i: any): IndicadorCard => {
          const idRaw     = i?.idEmpresa ?? i?.IDEMPRESA ?? null;
          const id        = idRaw == null ? null : Number(idRaw);
          const faturamento   = Number(i?.faturamento   ?? 0) || 0;
          const lucro         = Number(i?.lucro         ?? 0) || 0;
          const devolucoes    = Number(i?.devolucoes    ?? 0) || 0;
          const descontoValor = Number(i?.descontoValor ?? 0) || 0;
          const descontoPerc  = Number(i?.descontoPerc  ?? 0) || 0;
          const apelido = (id != null && empMap.has(id)) ? empMap.get(id)! : (id != null ? String(id) : '—');

          const metaApi     = id != null ? metaMap.get(id) : undefined;
          const metaFatMes  = Number(metaApi?.meta_fat    ?? 0);
          const metaMargem  = Number(metaApi?.meta_margem ?? 0);
          const fatorProp   = this.fatorProporcional(mes, ano, id);
          const metaFatProp = metaApi ? metaFatMes * fatorProp : 0;
          const ritmoLoja   = this.calcularRitmo(mes, ano, id);

          // 41646: ticket médio (meta cheia, taxa não se proporcionaliza)
          const qtdVendas   = Number(i?.qtdVendas   ?? 0) || 0;
          const ticketMedio = Number(i?.ticketMedio ?? 0) || 0;
          const metaTicket  = Number(metaApi?.meta_ticket_medio ?? 0) || 0;

          const metaMes      = metaApi ? metaFatMes : 0;
          const realizadoMes = id != null ? (realizadoMap.get(id) ?? 0) : 0;

          return {
            idEmpresa: id, apelido, faturamento, lucro, devolucoes, descontoValor, descontoPerc,
            metaFatProp, metaMargem, qtdVendas, ticketMedio, metaTicket, metaMes, realizadoMes,
            diasMes: ritmoLoja.diasMes, diasDecorridos: ritmoLoja.diasDecorridos,
            diasRestantes: ritmoLoja.diasRestantes, fatorProp,
          };
        })
        .filter(c => (c.faturamento ?? 0) > 0 || (c.lucro ?? 0) > 0);
        if (this.empresasPermitidas.length > 0) {
          this.cards = this.cards.filter(c => 
            c.idEmpresa !== null && this.empresasPermitidas.includes(c.idEmpresa)
          );
        }

    } finally {
      this.carregando = false;
      this.cdr.detectChanges();
    }
  }

  // ── KPIs por empresa ──
  margemReal(c: IndicadorCard): number      { return c.faturamento ? c.lucro / c.faturamento : 0; }
  percFaturamento(c: IndicadorCard): number  { return c.metaFatProp ? (c.faturamento / c.metaFatProp) * 100 : 0; }
  saldoFaturamento(c: IndicadorCard): number { return c.faturamento - c.metaFatProp; }
  variacaoFaturamento(c: IndicadorCard): number { return c.metaFatProp ? ((c.faturamento / c.metaFatProp) - 1) * 100 : 0; }
  metaLucroEmpresa(c: IndicadorCard): number { return c.metaFatProp * c.metaMargem; }
  percLucroVsMeta(c: IndicadorCard): number  { const ml = this.metaLucroEmpresa(c); return ml ? ((c.lucro / ml) - 1) * 100 : 0; }
  saldoLucro(c: IndicadorCard): number       { return c.lucro - this.metaLucroEmpresa(c); }
  margemVar(c: IndicadorCard): number        { return this.margemReal(c) - c.metaMargem; }

  // ── Ritmo do mês (2.1 meta diária necessária, 2.2 tendência de fechamento) ──
  get temRitmo(): boolean { return !!this.ritmo?.corte && this.ritmo.diasDecorridos > 0; }
  get mesEncerrado(): boolean { return !!this.ritmo && this.ritmo.diasRestantes === 0 && !!this.ritmo.corte; }

  /** Média por dia de venda já fechado (dias da própria loja). */
  mediaDiariaEmp(c: IndicadorCard): number {
    return c.diasDecorridos ? c.realizadoMes / c.diasDecorridos : 0;
  }
  /** Projeção de fechamento: média diária × dias de venda do mês da loja. */
  tendenciaEmp(c: IndicadorCard): number { return this.mediaDiariaEmp(c) * c.diasMes; }
  tendenciaPercEmp(c: IndicadorCard): number { return c.metaMes ? (this.tendenciaEmp(c) / c.metaMes) * 100 : 0; }
  /** Quanto precisa vender por dia, de hoje até o fim do mês, para bater a meta. */
  metaDiariaNecEmp(c: IndicadorCard): number {
    return c.diasRestantes ? Math.max(0, c.metaMes - c.realizadoMes) / c.diasRestantes : 0;
  }
  /** Meta diária "de origem": meta do mês ÷ dias de venda do mês da loja. */
  metaDiariaOrigEmp(c: IndicadorCard): number { return c.diasMes ? c.metaMes / c.diasMes : 0; }
  atingiuMetaEmp(c: IndicadorCard): boolean   { return c.metaMes > 0 && c.realizadoMes >= c.metaMes; }

  // Geral = soma das lojas (cada loja com o seu calendário)
  get mediaDiariaGeral(): number   { return this.cards.reduce((s, c) => s + this.mediaDiariaEmp(c), 0); }
  get tendenciaGeral(): number     { return this.cards.reduce((s, c) => s + this.tendenciaEmp(c), 0); }
  get tendenciaPercGeral(): number { return this.metaMesTotal ? (this.tendenciaGeral / this.metaMesTotal) * 100 : 0; }
  get metaDiariaNecGeral(): number {
    // soma por loja: loja que já bateu a meta não "empresta" sobra para as outras
    return this.cards.reduce((s, c) => s + this.metaDiariaNecEmp(c), 0);
  }
  get metaDiariaOrigGeral(): number { return this.cards.reduce((s, c) => s + this.metaDiariaOrigEmp(c), 0); }

  /** Cor da necessidade diária: até a meta original ok; até +10% atenção; acima, ruim. */
  corNecessidade(nec: number, orig: number): string {
    if (!orig) return '';
    if (nec <= orig) return 'ok';
    return nec <= orig * 1.1 ? 'warn' : 'bad';
  }

  get rotuloCorte(): string {
    if (!this.ritmo?.corte) return '';
    const d = this.ritmo.corte;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
  }

  // ── Faturamento por setor (departamento do vendedor) ──
  async carregarSetores() {
    if (this.carregandoSetores) return;
    this.carregandoSetores = true;
    this.erroSetores = '';
    this.cdr.detectChanges();
    try {
      const [fat, metas] = await Promise.all([
        firstValueFrom(this.setoresSvc.faturamentoPorSetor(this.dataISO(this.dataInicio), this.dataISO(this.dataFim))),
        firstValueFrom(this.setoresSvc.metasSetor(this.mesRef, this.anoRef)).catch(() => [] as MetaSetorApi[]),
      ]);
      this.setoresLojas = this.montarSetores(fat ?? [], metas ?? []);
      this.lojaSetoresAberta = this.setoresLojas[0]?.idEmpresa ?? null;
    } catch (err: any) {
      this.erroSetores = err?.error?.message || 'Não foi possível carregar os setores agora. Tente um período menor ou de novo em instantes.';
    } finally {
      this.carregandoSetores = false;
      this.cdr.detectChanges();
    }
  }

  private montarSetores(fat: FaturamentoSetor[], metas: MetaSetorApi[]): SetoresLoja[] {
    const porLoja = new Map<number, Map<number, SetorLinha>>();
    const linha = (idEmp: number, idDep: number, nome: string): SetorLinha => {
      if (!porLoja.has(idEmp)) porLoja.set(idEmp, new Map());
      const m = porLoja.get(idEmp)!;
      if (!m.has(idDep)) m.set(idDep, { idDepartamento: idDep, departamento: nome, realizado: 0, metaMes: 0, metaProp: 0 });
      return m.get(idDep)!;
    };
    for (const f of fat) {
      linha(Number(f.idEmpresa), Number(f.idDepartamento), f.departamento).realizado += Number(f.faturamento) || 0;
    }
    for (const m of metas) {
      const l = linha(Number(m.id_empresa), Number(m.id_departamento), m.departamento);
      l.metaMes += Number(m.meta_fat) || 0;
    }
    const resultado: SetoresLoja[] = [];
    for (const card of this.cards) {
      if (card.idEmpresa == null || !porLoja.has(card.idEmpresa)) continue;
      const linhas = [...porLoja.get(card.idEmpresa)!.values()];
      linhas.forEach(l => l.metaProp = l.metaMes * card.fatorProp);
      linhas.sort((a, b) => b.realizado - a.realizado);
      resultado.push({
        idEmpresa: card.idEmpresa,
        apelido: card.apelido,
        linhas,
        realizado: linhas.reduce((s, l) => s + l.realizado, 0),
        metaProp: linhas.reduce((s, l) => s + l.metaProp, 0),
      });
    }
    return resultado;
  }

  toggleLojaSetores(id: number) {
    this.lojaSetoresAberta = this.lojaSetoresAberta === id ? null : id;
  }
  percSetor(l: SetorLinha): number { return l.metaProp ? (l.realizado / l.metaProp) * 100 : 0; }
  partSetor(l: SetorLinha, loja: SetoresLoja): number { return loja.realizado ? (l.realizado / loja.realizado) * 100 : 0; }
  trackSetor(_i: number, l: SetorLinha) { return l.idDepartamento; }
  trackLojaSetor(_i: number, l: SetoresLoja) { return l.idEmpresa; }

  // ── 41646: Ticket médio ──
  diffTicketValor(c: IndicadorCard): number { return c.metaTicket ? c.ticketMedio - c.metaTicket : 0; }
  diffTicketPerc(c: IndicadorCard): number  { return c.metaTicket ? ((c.ticketMedio / c.metaTicket) - 1) * 100 : 0; }

  moeda(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  private round(n: number, places = 2) {
    return Math.round((n + Number.EPSILON) * Math.pow(10, places)) / Math.pow(10, places);
  }
  corNum(n: number)      { return n >= 0 ? 'ok' : n > -10 ? 'warn' : 'bad'; }
  pct(n: number): string { return `${(n || 0).toFixed(1)}%`; }
  signo(n: number): string { return n >= 0 ? '+' : ''; }
}