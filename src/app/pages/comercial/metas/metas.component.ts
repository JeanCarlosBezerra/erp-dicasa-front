// src/app/pages/comercial/metas/metas.component.ts
import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import { environment } from '../../../../environments/environment';

interface MetaRow {
  id?: number;
  id_empresa: number;
  apelido: string;
  mes: number;
  ano: number;
  meta_fat: number;
  meta_margem: number; // fração 0.30 = 30%
  // edição local
  _editFat?: string;
  _editMargem?: string;
  _salvando?: boolean;
  _salvo?: boolean;
}

const MESES = [
  { num: 1, nome: 'Janeiro' }, { num: 2, nome: 'Fevereiro' },
  { num: 3, nome: 'Março' },   { num: 4, nome: 'Abril' },
  { num: 5, nome: 'Maio' },    { num: 6, nome: 'Junho' },
  { num: 7, nome: 'Julho' },   { num: 8, nome: 'Agosto' },
  { num: 9, nome: 'Setembro' },{ num: 10, nome: 'Outubro' },
  { num: 11, nome: 'Novembro' },{ num: 12, nome: 'Dezembro' },
];

@Component({
  selector: 'app-metas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './metas.component.html',
  styleUrls: ['./metas.component.scss'],
})
export class MetasComponent {
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private empresaSvc = inject(EmpresaService);

  readonly meses = MESES;
  readonly anos = [2024, 2025, 2026, 2027];

  mesSelecionado = new Date().getMonth() + 1;
  anoSelecionado = new Date().getFullYear();

  empresas: EmpresaLite[] = [];
  metas: MetaRow[] = [];
  carregando = false;

  // Totais
  get totalMetaFat(): number { return this.metas.reduce((s, m) => s + (m.meta_fat || 0), 0); }

  // Info de dias úteis do mês selecionado
  diasUteisMes = 0;

  constructor() {
    afterNextRender(() => {
      this.empresaSvc.getEmpresas().subscribe(emp => {
        this.empresas = emp;
        this.cdr.detectChanges();
        this.carregar();
      });
    });
  }

  carregar() {
    this.carregando = true;
    this.calcularDiasUteis();
    const url = `${environment.apiUrl}/comercial/metas/mes?mes=${this.mesSelecionado}&ano=${this.anoSelecionado}`;
    this.http.get<any[]>(url).subscribe({
      next: (rows) => {
        // Para cada empresa, monta uma linha — se já tem meta usa ela, senão zero
        this.metas = this.empresas.map(emp => {
          const existing = rows.find(r => Number(r.id_empresa) === emp.id);
          return {
            id:         existing?.id,
            id_empresa: emp.id,
            apelido:    emp.apelido,
            mes:        this.mesSelecionado,
            ano:        this.anoSelecionado,
            meta_fat:   Number(existing?.meta_fat   || 0),
            meta_margem: Number(existing?.meta_margem || 0),
            _editFat:   this.formatMoney(Number(existing?.meta_fat || 0)),
            _editMargem: ((Number(existing?.meta_margem || 0)) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false }),
          };
        });
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.carregando = false; this.cdr.detectChanges(); }
    });
  }

  private calcularDiasUteis() {
    const ano = this.anoSelecionado;
    const mes = this.mesSelecionado;
    const ultimo = new Date(ano, mes, 0).getDate();
    let count = 0;
    for (let d = 1; d <= ultimo; d++) {
      if (new Date(ano, mes - 1, d).getDay() !== 0) count++;
    }
    this.diasUteisMes = count;
  }

  get metaDiaria(): number {
    return this.diasUteisMes ? this.totalMetaFat / this.diasUteisMes : 0;
  }

  salvar(row: MetaRow) {
    // Parseia os valores editados
    row.meta_fat    = this.parseMoney(row._editFat || '0');
    row.meta_margem = Number(String(row._editMargem || '0').replace(',', '.')) / 100;
    row._salvando   = true;
    this.cdr.detectChanges();

    this.http.post<any>(`${environment.apiUrl}/comercial/metas`, {
      id_empresa:  row.id_empresa,
      mes:         row.mes,
      ano:         row.ano,
      meta_fat:    row.meta_fat,
      meta_margem: row.meta_margem,
    }).subscribe({
      next: (res) => {
        row.id = res.id;
        row._salvando = false;
        row._salvo    = true;
        setTimeout(() => { row._salvo = false; this.cdr.detectChanges(); }, 2000);
        this.cdr.detectChanges();
      },
      error: () => { row._salvando = false; alert('Erro ao salvar meta.'); this.cdr.detectChanges(); }
    });
  }

  salvarTodas() {
    this.metas.forEach(m => this.salvar(m));
  }

  // ── Formatação ──
  formatMoney(n: number): string {
    return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  parseMoney(s: string): number {
    // "1.234,56" → 1234.56
    return Number((s || '').replace(/\./g, '').replace(',', '.')) || 0;
  }

  onFatInput(row: MetaRow, value: string) {
    row._editFat = value;
  }
  onFatBlur(row: MetaRow) {
    const n = this.parseMoney(row._editFat || '0');
    row.meta_fat = n;
    row._editFat = this.formatMoney(n);
    this.cdr.detectChanges();
  }
  onMargemBlur(row: MetaRow) {
    const n = Number(String(row._editMargem || '0').replace(',', '.'));
    row.meta_margem = (isFinite(n) ? Math.max(0, Math.min(100, n)) : 0) / 100;
    row._editMargem = (row.meta_margem * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false });
    this.cdr.detectChanges();
  }

  selectAll(e: Event) {
    const el = e.target as HTMLInputElement;
    queueMicrotask(() => el.select());
  }

  nomeMes(n: number): string {
    return MESES.find(m => m.num === n)?.nome ?? '';
  }
}