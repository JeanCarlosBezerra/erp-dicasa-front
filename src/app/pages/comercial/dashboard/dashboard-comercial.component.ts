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
const GENERAL_ID = -1;  // id especial para o “Empresa (Geral)”
type MetaGeral = {
  metaFat: number;       // valor em R$
  metaMargemPct: number; // 0..100 (percentual digitado pelo usuário)
};


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
  
  metaGeral: MetaGeral = { metaFat: 0, metaMargemPct: 0 };
  get cardGeral(): { idEmpresa: number, apelido: string, faturamento: number, lucro: number } {
  return {
    idEmpresa: GENERAL_ID,
    apelido: 'Empresa (Geral)',
    faturamento: this.faturamentoTotal,
    lucro: this.lucroTotal
  };
 }
  /** totais (dependem das metas e dos dados reais) */
  get faturamentoTotal(): number {
    return this.cards.reduce((s, c) => s + (c.faturamento || 0), 0);
  }
  get lucroTotal(): number {
    return this.cards.reduce((s, c) => s + (c.lucro || 0), 0);
  }

  onMetaGeralMargemBlur(): void {
  // não arredonda, só garante o clamp e salva
  const pct = this.metaGeral.metaMargemPct;
  this.metaGeral.metaMargemPct = isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
  this.salvarMetaGeralLocal();
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
 selectAll(e: Event) {
  const el = e.target as HTMLInputElement;
  queueMicrotask(() => el.select());
}

  /** Formata inteiro em pt-BR (sem centavos) */
formatMoney(n: number) {
  // “00.000,00”
  return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

  /** Remove tudo que não for dígito (valor inteiro em reais) */
  unformatMoney(s: string): number {
    const onlyDigits = (s || '').replace(/\D+/g, '');
    return Number(onlyDigits || 0);
  }

onMetaGeralFatInput(value: string) {
  const onlyNums = value.replace(/[^\d]/g, '');
  const cents = Number(onlyNums || 0);
  this.metaGeral.metaFat = cents / 100;
}
onMetaGeralFatBlur() {
  this.metaGeral.metaFat = this.round(this.metaGeral.metaFat, 2);
  this.salvarMetaGeralLocal(); // <- acrescentar esta linha
}

onMetaGeralMargemInput(value: number | string | null) {
  const pct = Number(String(value ?? '').replace(',', '.'));
  this.metaGeral.metaMargemPct = isFinite(pct) ? Math.max(0, Math.min(100, pct)) : 0;
}

  /** Enquanto digita, mantém o número no estado e devolve formatado */
onMetaFatInput(id: number, value: string) {
  const onlyNums = value.replace(/[^\d]/g, '');
  const cents = Number(onlyNums || 0);
  this.getMeta(id).metaFat = cents / 100;
}

  /** Ao sair do campo (blur), força o formato bonito */
 onMetaFatBlur(id: number) {
  this.getMeta(id).metaFat = this.round(this.getMeta(id).metaFat, 2);
  this.onChangeMeta({ idEmpresa: id } as any);
}

  get metaFatTotal(): number {
    return this.cards.reduce((s,c) => s + (this.meta(c.idEmpresa ?? -1).metaFat || 0), 0);
  }
  get metaLucroTotalGeral(): number {
    return this.cards.reduce((s,c) => s + (this.meta(c.idEmpresa ?? -1).metaFat * this.meta(c.idEmpresa ?? -1).metaMargem || 0), 0);
  }

  get metaLucroTotalCards(): number { // soma das metas de lucro dos cards (informativo)
  return this.cards.reduce((s,c) => {
    const m = this.meta(c.idEmpresa ?? -1);
    return s + (m.metaFat * m.metaMargem || 0);
  }, 0);
}

  /** arredonda com segurança */
private round(n: number, places = 2) {
  const f = Math.pow(10, places);
  return Math.round((n + Number.EPSILON) * f) / f;
}


/** KPIs gerais calculados (exemplo simples) */
get percFatGeral(): number {
  const meta = this.metaGeral.metaFat || 0;
  return meta ? (this.faturamentoTotal / meta) * 100 : 0;
}
get saldoFatGeral(): number {
  return this.faturamentoTotal - (this.metaGeral.metaFat || 0);
}
get variacaoFatGeral(): number {
  const meta = this.metaGeral.metaFat || 0;
  return meta ? ((this.faturamentoTotal / meta) - 1) * 100 : 0;
}
get percLucroGeral(): number {
  const metaL = (this.metaGeral.metaFat || 0) * ((this.metaGeral.metaMargemPct || 0) / 100);
  return metaL ? (this.lucroTotal / metaL) * 100 : 0;
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

  get margemRealGeralPct(): number {
  const fat = this.faturamentoTotal || 0;
  return fat ? (this.lucroTotal / fat) * 100 : 0;
}

  get saldoLucroGeral(): number {
  const metaL = (this.metaGeral.metaFat || 0) * ((this.metaGeral.metaMargemPct || 0) / 100);
  return this.lucroTotal - metaL;
}

  get diffMargemGeral(): number {
  return this.margemRealGeralPct - (this.metaGeral.metaMargemPct || 0);
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

pctInput(frac: number): string {
  const pct = (Number(frac) || 0) * 100;
  return pct.toLocaleString('pt-BR', { useGrouping: false, maximumFractionDigits: 6 });
}

setMetaMargem(id: number, valorPercent: number | string | null): void {
  const s = String(valorPercent ?? '').trim().replace(',', '.');
  const n = Number(s);
  const clean = isFinite(n) ? Math.max(0, Math.min(100, n)) : 0;
  this.getMeta(id).metaMargem = clean / 100;
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