// src/app/pages/comercial/dashboard/dashboard-comercial.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Angular Material
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { firstValueFrom, combineLatest } from 'rxjs';
import { ChangeDetectorRef } from '@angular/core';

// service que você criou para chamar o backend
import { DashboardComercialService, IndicadorEmpresa } from '../../../services/dashboard-comercial.service';
import { EmpresaService } from '../../../services/empresa.service';

interface EmpresaLite {
  id: number;
  apelido: string; // EMPALIAS / NOMEFANTASIA
}

// troque por um tipo "Card" que aceita null no id e tem apelido
type IndicadorCard = {
  idEmpresa: number | null;   // 👈 pode vir null
  faturamento: number;
  lucro: number;
  apelido: string;            // 👈 string garantida
};

type IdEmpresa = number;
interface MetaValores {
  metaFat: number;      // sempre número
  metaMargem: number;   // 0.30 = 30%
}

type Metas = Record<number, { metaFat: number; metaMargem: number }>;

type MetaGeral = { metaFat: number; metaLucro: number };

@Component({
  selector: 'app-dashboard-comercial',
  templateUrl: './dashboard-comercial.component.html',
  styleUrls: ['./dashboard-comercial.component.scss'],
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
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

  /** metas locais, editáveis (salvas em localStorage) */
  metas: Record<IdEmpresa, MetaValores> = {};
  
  metaGeral: MetaGeral = { metaFat: 0, metaLucro: 0 };

  /** totais (dependem das metas e dos dados reais) */
  get faturamentoTotal(): number {
    return this.cards.reduce((s, c) => s + (c.faturamento || 0), 0);
  }
  get lucroTotal(): number {
    return this.cards.reduce((s, c) => s + (c.lucro || 0), 0);
  }

   // ajuda o *ngFor a não “chacoalhar” os cards
  trackById(_i: number, c: IndicadorCard) {
    return c.idEmpresa ?? c.apelido;
  }

  ngOnInit(): void {
    this.carregarMetasLocal();
    this.carregarMetaGeralLocal();   // 👈
    this.buscar();
  }

  private carregarMetasLocal() {
    try {
      const raw = localStorage.getItem('dash_metas');
      if (raw) this.metas = JSON.parse(raw) as Metas;
    } catch { /* ignore */ }
  }
  private salvarMetasLocal() {
    localStorage.setItem('dash_metas', JSON.stringify(this.metas));
  }

  private carregarMetaGeralLocal() {
  try {
    const raw = localStorage.getItem('dash_meta_geral');
    if (raw) this.metaGeral = JSON.parse(raw) as MetaGeral;
  } catch {}
  }
  private salvarMetaGeralLocal() {
    localStorage.setItem('dash_meta_geral', JSON.stringify(this.metaGeral));
  }

  private dataISO(d: Date) {
    return d?.toISOString().slice(0, 10);
  }

  private ensureMeta(id: number): MetaValores {
  if (!this.metas[id]) {
    this.metas[id] = { metaFat: 0, metaMargem: 0 };
  }
  return this.metas[id];
}

  moeda(v: number | null | undefined): string {
    const n = Number(v || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** % margem real = lucro/faturamento */
  margemReal(c: IndicadorCard): number {
    const fat = c.faturamento || 0;
    return fat ? (c.lucro || 0) / fat : 0;
  }

  // ========= BUSCA =========
  async buscar() {
    this.carregando = true;
    this.cdr.markForCheck();
    try {
      const [empresas, indic] = await Promise.all([
        firstValueFrom(this.empresaSvc.getEmpresas()),
        firstValueFrom(
          this.dashSvc.indicadores(this.dataISO(this.dataInicio), this.dataISO(this.dataFim))
        )
      ]);

      const empMap = new Map<number, string>();
      (empresas ?? []).forEach((e: any) => {
        const id = e.id ?? e.IDEMPRESA;
        const apelido = e.apelido ?? e.EMPALIAS ?? e.NOMEFANTASIA ?? String(id);
        if (id != null) empMap.set(Number(id), String(apelido));
      });

      this.cards = (indic ?? [])
        .map((i: any): IndicadorCard => {
          const idRaw =
            i?.idEmpresa ?? i?.IDEMPRESA ?? i?.idempresa ?? i?.empresa ?? i?.ID_EMPRESA;
          const id = (idRaw === null || idRaw === undefined || idRaw === '')
            ? null : Number(idRaw);

          const faturamento = Number(i?.faturamento ?? i?.FATURAMENTO) || 0;
          const lucro       = Number(i?.lucro       ?? i?.LUCRO)        || 0;

          const apelido = (id != null && empMap.has(id)) ? empMap.get(id)! :
            (id != null ? String(id) : '—');

          // garante que existe um slot de metas para este id
          if (id != null && !this.metas[id]) {
            this.metas[id] = { metaFat: faturamento, metaMargem: this.margemReal({idEmpresa:id, apelido, faturamento, lucro}) };
          }

          return { idEmpresa: id, apelido, faturamento, lucro };
        })
        .filter(c => (c.faturamento ?? 0) > 0 || (c.lucro ?? 0) > 0);

      this.salvarMetasLocal();
    } finally {
      this.carregando = false;
      this.cdr.detectChanges();
    }
  }

  /** Seleciona tudo ao focar (qualquer input) */
  selectAll(ev: FocusEvent) {
    const el = ev.target as HTMLInputElement;
    setTimeout(() => el.select(), 0);
  }

  /** Formata inteiro em pt-BR (sem centavos) */
  formatMoney(v: number): string {
    const n = Math.round(Number(v || 0));
    return n.toLocaleString('pt-BR');
  }

  /** Remove tudo que não for dígito (valor inteiro em reais) */
  unformatMoney(s: string): number {
    const onlyDigits = (s || '').replace(/\D+/g, '');
    return Number(onlyDigits || 0);
  }

  /** Enquanto digita, mantém o número no estado e devolve formatado */
  onMetaFatInput(id: number, raw: string) {
    const n = this.unformatMoney(raw);
    this.getMeta(id).metaFat = n;
    // nada a retornar: o [value] se atualiza pela mudança do estado
  }

  /** Ao sair do campo (blur), força o formato bonito */
  onMetaFatBlur(id: number) {
    // forçar detecção: trocar o objeto para o [value] renderizar
    const m = this.getMeta(id);
    this.metas[id] = { ...m, metaFat: Math.round(m.metaFat || 0) };
    this.onChangeMeta({ idEmpresa: id } as any);
  }

  get metaFatTotal(): number {
    return this.cards.reduce((s,c) => s + (this.meta(c.idEmpresa ?? -1).metaFat || 0), 0);
  }
  get metaLucroTotalGeral(): number {
    return this.cards.reduce((s,c) => s + (this.meta(c.idEmpresa ?? -1).metaFat * this.meta(c.idEmpresa ?? -1).metaMargem || 0), 0);
  }
  get percFatGeral(): number {
    const meta = this.metaFatTotal;
    return meta ? (this.faturamentoTotal / meta) * 100 : 0;
  }
  get metaLucroTotalCards(): number { // soma das metas de lucro dos cards (informativo)
  return this.cards.reduce((s,c) => {
    const m = this.meta(c.idEmpresa ?? -1);
    return s + (m.metaFat * m.metaMargem || 0);
  }, 0);
}
  get percLucroGeral(): number {
    const meta = this.metaLucroTotalGeral;
    return meta ? (this.lucroTotal / meta) * 100 : 0;
  }

  onMetaGeralFatInput(raw: string) {
  this.metaGeral.metaFat = this.unformatMoney(raw);
  }
  onMetaGeralFatBlur() {
    this.metaGeral.metaFat = Math.round(this.metaGeral.metaFat || 0);
    this.salvarMetaGeralLocal();
  }
  
  onMetaGeralLucroInput(raw: string) {
    this.metaGeral.metaLucro = this.unformatMoney(raw);
  }
  onMetaGeralLucroBlur() {
    this.metaGeral.metaLucro = Math.round(this.metaGeral.metaLucro || 0);
    this.salvarMetaGeralLocal();
  }

  /** Ex.: 12.3 mil, 4.5 mi, 980  */
  short(n: number): string {
    return Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
  }

  /** Exibe moeda curta: R$ 12,3 mi */
  shortMoney(n: number): string {
    return 'R$ ' + this.short(n);
  }
  // ========= CÁLCULOS A PARTIR DAS METAS =========
  metaFat(c: IndicadorCard): number {
    const id = c.idEmpresa ?? -1;
    return this.metas[id]?.metaFat ?? 0;
  }
  metaMargem(c: IndicadorCard): number {
    const id = c.idEmpresa ?? -1;
    return this.metas[id]?.metaMargem ?? 0; // ex.: 0.30 (30%)
  }

  // KPIs (iguais aos do seu “modelo antigo”)
  percFaturamento(c: IndicadorCard): number {
    const meta = this.metaFat(c);
    return meta ? (c.faturamento / meta) * 100 : 0;
  }
  saldoFaturamento(c: IndicadorCard): number {
    return c.faturamento - this.metaFat(c);
  }
  variacaoFaturamento(c: IndicadorCard): number {
    const meta = this.metaFat(c);
    return meta ? ((c.faturamento / meta) - 1) * 100 : 0;
  }

  metaLucroTotal(c: IndicadorCard): number {
    return this.metaFat(c) * this.metaMargem(c);
    // metaMargem em fração: 0.29 => 29%
  }
  metaLucroRestante(c: IndicadorCard): number {
    return this.metaLucroTotal(c) - c.lucro;
  }
  percLucro(c: IndicadorCard): number {
    const metaL = this.metaLucroTotal(c);
    return metaL ? (c.lucro / metaL) * 100 : 0;
  }
  saldoLucro(c: IndicadorCard): number {
    return c.lucro - this.metaLucroTotal(c);
  }
  variacaoLucro(c: IndicadorCard): number {
    const metaL = this.metaLucroTotal(c);
    return metaL ? ((c.lucro / metaL) - 1) * 100 : 0;
  }
  margemVar(c: IndicadorCard): number {
    return this.margemReal(c) - this.metaMargem(c);
  }

  // quando usuário edita campos
  onChangeMeta(c: IndicadorCard) {
    if (c.idEmpresa == null) return;
    // saneia valores
    const slot = this.metas[c.idEmpresa] ?? { metaFat: 0, metaMargem: 0 };
    slot.metaFat = Number(slot.metaFat) || 0;
    slot.metaMargem = Number(slot.metaMargem) || 0;
    this.metas[c.idEmpresa] = slot;
    this.salvarMetasLocal();
  }

  // helpers só para leitura no template
  meta(id: number): MetaValores {
    return this.metas[id] ?? { metaFat: 0, metaMargem: 0 };
  }

  // Helper para garantir objeto sempre existente
  private getMeta(id: IdEmpresa): MetaValores {
    if (!this.metas[id]) {
      this.metas[id] = { metaFat: 0, metaMargem: 0 };
    }
    return this.metas[id];
  }
  

// setters usados pelo template (coerção p/ number)
setMetaFat(id: IdEmpresa, valor: number | string | null): void {
  const n = Number(valor ?? 0);
  this.getMeta(id).metaFat = isNaN(n) ? 0 : n;
  this.onChangeMeta({ idEmpresa: id } as any); // mantém seu recálculo
}

setMetaMargem(id: IdEmpresa, valorPercent: number | string | null): void {
  const p = Number(valorPercent ?? 0);     // vem 0..100 do input
  const frac = isNaN(p) ? 0 : p / 100;     // guarda como 0..1
  this.getMeta(id).metaMargem = frac;
  this.onChangeMeta({ idEmpresa: id } as any);
}
  // Cores rápidas (−10% vermelho, entre −10 e 0 amarelo, ≥0 verde)
  corNum(n: number) {
    if (n >= 0) return 'ok';
    if (n > -10) return 'warn';
    return 'bad';
  }

  // helpers de exibição
  pct(n: number): string { return `${(n).toFixed(1)}%`; }
  signo(n: number): string { return n >= 0 ? '+' : ''; }
}