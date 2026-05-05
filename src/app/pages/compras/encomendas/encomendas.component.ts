import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { EncomendasService, EncomendaItem, TipoCompra } from '../../../services/encomendas.service';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';

@Component({
  selector: 'app-encomendas',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './encomendas.component.html',
  styleUrl: './encomendas.component.scss',
})
export class EncomendasComponent {
  private cdr      = inject(ChangeDetectorRef);
  private svc      = inject(EncomendasService);
  private empSvc   = inject(EmpresaService);

  // ─── Estado ──────────────────────────────────────────────────────────────
  carregando = false;
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  dataInicio: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1); // 1º do mês
  dataFim: Date    = new Date();

  tipoFiltro: string = 'TODOS';

  // Todos os dados recebidos da API (sem filtro frontend)
  private todosItens: EncomendaItem[] = [];

  dataSource = new MatTableDataSource<EncomendaItem>([]);

  displayedColumns = [
    'nroNf', 'dtEmissao', 'fornecedor',
    'cliente', 'produto', 'pcExtraido', 'pedidoVenda',
    'previsaoEntrega', 'valorNf',
    'metodoExtracao', 'gravadaErp', 'tipoCompra',
  ];

  tipoOptions = [
    { value: 'TODOS',              label: 'Todos' },
    { value: 'ENCOMENDA',          label: 'Encomendas' },
    { value: 'ESTOQUE',            label: 'Compra de Estoque' },
    { value: 'SEM_PC',             label: 'Sem identificação' },
    { value: 'PC_NAO_ENCONTRADO',  label: 'PC não encontrado' },
  ];

  constructor() {
    afterNextRender(() => {
      this.empSvc.getEmpresas().subscribe(empresas => {
        this.empresas = empresas;
        this.empresasSelecionadas = empresas.map(e => e.id);
        this.carregar();
        this.cdr.detectChanges();
      });
    });
  }

  // ─── Carrega da API ───────────────────────────────────────────────────────
  carregar() {
    if (!this.empresasSelecionadas.length) return;

    const d1 = this.dataInicio.toISOString().slice(0, 10);
    const d2 = this.dataFim.toISOString().slice(0, 10);

    this.carregando = true;
    this.cdr.detectChanges();

    this.svc.getEncomendas(this.empresasSelecionadas, d1, d2).subscribe({
      next: rows => {
        this.todosItens = rows;
        this.aplicarFiltro();
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('[Encomendas]', err);
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Filtro frontend por tipo ─────────────────────────────────────────────
  aplicarFiltro() {
    const dados = this.tipoFiltro === 'TODOS'
      ? this.todosItens
      : this.todosItens.filter(d => d.tipoCompra === this.tipoFiltro);

    this.dataSource.data = dados;
    this.cdr.detectChanges();
  }

  onTipoChange() { this.aplicarFiltro(); }

  // ─── KPIs (sobre todosItens) ──────────────────────────────────────────────
  get totalEncomendas(): number {
    return this.todosItens.filter(d => d.tipoCompra === 'ENCOMENDA').length;
  }

  get totalEstoque(): number {
    return this.todosItens.filter(d => d.tipoCompra === 'ESTOQUE').length;
  }

  get totalSemIdentificacao(): number {
    return this.todosItens.filter(
      d => d.tipoCompra === 'SEM_PC' || d.tipoCompra === 'PC_NAO_ENCONTRADO',
    ).length;
  }

  get valorTotalEncomendas(): number {
    return this.todosItens
      .filter(d => d.tipoCompra === 'ENCOMENDA')
      .reduce((acc, d) => acc + d.valorNf, 0);
  }

  // ─── Helpers de exibição ──────────────────────────────────────────────────
  getProdutoResumido(item: EncomendaItem): string {
    if (!item.pedidoCompra?.produtos?.length) return '—';
    const prods = item.pedidoCompra.produtos;
    const primeiro = prods[0].descricao;
    return prods.length > 1 ? `${primeiro} (+${prods.length - 1})` : primeiro;
  }

  getCliente(item: EncomendaItem): string {
    return item.encomenda?.cliente ?? '—';
  }

  getPrevisaoEntrega(item: EncomendaItem): string {
    return this.formatDate(item.pedidoCompra?.previsaoEntrega ?? null);
  }

  getPctAtendido(item: EncomendaItem): number {
    if (!item.pedidoCompra?.produtos?.length) return 0;
    const prods = item.pedidoCompra.produtos;
    const totalSol = prods.reduce((s, p) => s + p.qtdSolicitada, 0);
    const totalAte = prods.reduce((s, p) => s + p.qtdAtendida, 0);
    return totalSol > 0 ? Math.round((totalAte / totalSol) * 100) : 0;
  }

  tipoLabel(tipo: TipoCompra | string): string {
    const map: Record<string, string> = {
      ENCOMENDA:         'Encomenda',
      ESTOQUE:           'Estoque',
      SEM_PC:            'Sem identificação',
      PC_NAO_ENCONTRADO: 'PC não encontrado',
    };
    return map[tipo] ?? tipo;
  }

  tipoClass(tipo: TipoCompra | string): string {
    const map: Record<string, string> = {
      ENCOMENDA:         'badge-success',
      ESTOQUE:           'badge-info',
      SEM_PC:            'badge-secondary',
      PC_NAO_ENCONTRADO: 'badge-warning',
    };
    return map[tipo] ?? '';
  }

  metodoLabel(metodo: string): string {
    const map: Record<string, string> = {
      XPED:             'Item XML',
      INFCPL:           'Obs. NF',
      NAO_IDENTIFICADO: '—',
    };
    return map[metodo] ?? metodo;
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    // Suporta formato ISO (2026-04-29) e timestamp
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  get empresasSelecionadasResumo(): string {
    if (!this.empresasSelecionadas?.length) return '';
    const apelidos = this.empresasSelecionadas
      .map(id => this.empresas.find(e => e.id === id)?.apelido ?? String(id));
    if (apelidos.length <= 3) return apelidos.join(', ');
    return `${apelidos.slice(0, 3).join(', ')} +${apelidos.length - 3}`;
  }
}