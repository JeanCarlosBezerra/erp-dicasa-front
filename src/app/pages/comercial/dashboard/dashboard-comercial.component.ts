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
  IndicadorEmpresa,
  MetaEmpresaApi,
} from '../../../services/dashboard-comercial.service';
import { EmpresaService } from '../../../services/empresa.service';

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
    private cdr: ChangeDetectorRef
  ) {}

  cards: IndicadorCard[] = [];
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

  // Dias úteis exceto domingos
  private diasUteis(inicio: Date, fim: Date): number {
    let count = 0;
    const cur = new Date(inicio); cur.setHours(0, 0, 0, 0);
    const end = new Date(fim);    end.setHours(0, 0, 0, 0);
    while (cur <= end) {
      if (cur.getDay() !== 0) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }

  private diasUteisMes(mes: number, ano: number): number {
    return this.diasUteis(new Date(ano, mes - 1, 1), new Date(ano, mes, 0));
  }

  // Meta proporcional = meta mensal ÷ dias úteis mês × dias úteis período
  private metaProporcional(metaMensal: number, mes: number, ano: number): number {
    const totalMes    = this.diasUteisMes(mes, ano);
    const diasPeriodo = this.diasUteis(this.dataInicio, this.dataFim);
    return totalMes === 0 ? 0 : (metaMensal / totalMes) * diasPeriodo;
  }

  async buscar() {
    this.carregando = true;
    this.cdr.markForCheck();
    try {
      const mes = this.dataInicio.getMonth() + 1;
      const ano = this.dataInicio.getFullYear();

      const [empresas, indic, metasApi] = await Promise.all([
        firstValueFrom(this.empresaSvc.getEmpresas()),
        firstValueFrom(this.dashSvc.indicadores(this.dataISO(this.dataInicio), this.dataISO(this.dataFim))),
        firstValueFrom(this.dashSvc.getMetas(mes, ano)),
      ]);

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
          const metaFatProp = metaApi ? this.metaProporcional(metaFatMes, mes, ano) : 0;

          return { idEmpresa: id, apelido, faturamento, lucro, devolucoes, descontoValor, descontoPerc, metaFatProp, metaMargem };
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