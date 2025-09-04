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

type Metas = Record<number, { metaFat: number; metaMargem: number }>;

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
  
  cards: IndicadorCard[] = [];
  dataInicio = new Date();
  dataFim = new Date();
  carregando = false;

  /** metas locais, editáveis (salvas em localStorage) */
  metas: Metas = {};

  /** totais (dependem das metas e dos dados reais) */
  get faturamentoTotal(): number {
    return this.cards.reduce((s, c) => s + (c.faturamento || 0), 0);
  }
  get lucroTotal(): number {
    return this.cards.reduce((s, c) => s + (c.lucro || 0), 0);
  }

  constructor(
    private dashSvc: DashboardComercialService,
    private empresaSvc: EmpresaService
  ) {}

  ngOnInit(): void {
    this.carregarMetasLocal();
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

  private dataISO(d: Date) {
    return d?.toISOString().slice(0, 10);
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
    try {
      const [empresas, indic] = await Promise.all([
        this.empresaSvc.getEmpresas().toPromise(),
        this.dashSvc.indicadores(this.dataISO(this.dataInicio), this.dataISO(this.dataFim)).toPromise()
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
    }
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

  // helpers de exibição
  pct(n: number): string { return `${(n).toFixed(1)}%`; }
  signo(n: number): string { return n >= 0 ? '+' : ''; }
}