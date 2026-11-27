import { AfterViewInit, Component, ViewChild, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { NgChartsModule } from 'ng2-charts';
import { forkJoin } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';
import { ColaboradorProdutividade, ColaboradorService } from '../../../services/colaborador.service';
import { NgForm } from '@angular/forms';
import { ExportService } from '../../../shared/export.service';
import { MatIconModule } from '@angular/material/icon';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import { Empresa } from '../../../models/empresa.model';
import { MatTooltipModule } from '@angular/material/tooltip';
import { isoLocal } from '../../../services/dias-venda.util';

@Component({
  selector: 'app-colaborador',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatFormFieldModule, ReactiveFormsModule,
    MatInputModule, MatDatepickerModule, MatNativeDateModule, MatButtonModule,
    MatSelectModule, NgChartsModule, MatPaginatorModule, MatCardModule,
    MatTableModule, MatIconModule, MatTooltipModule,
  ],
  providers: [ExportService],
  templateUrl: './colaborador.component.html',
  styleUrl: './colaborador.component.scss'
})
export class ColaboradorComponent implements OnInit {
  dataSource = new MatTableDataSource<ColaboradorProdutividade>([]);
  private cdr = inject(ChangeDetectorRef);

  /** Todas as linhas da API; a tabela mostra só as do setor escolhido (3.3). */
  private todasLinhas: ColaboradorProdutividade[] = [];
  setorFiltro = '';   // '' = todos; senão o idDepartamento como texto
  setoresDisponiveis: { id: number; nome: string; qtd: number }[] = [];

  // ── Colunas: desconto agora separado em PRODUTO e FINANCEIRO ──
  displayedColumns = [
    'idVendedor',
    'nome',
    'departamento',
    'qtdvenda',
    'faturamento',
    'lucro',
    'margem',
    'descontoProdutoValor',      // ← novo (produto R$)
    'descontoProdutoPerc',       // ← novo (produto %)
    'descontoFinanceiroValor',   // ← novo (financeiro R$)
    'descontoFinanceiroPerc',    // ← novo (financeiro %)
    'devolucoes',
  ];

  dataInicio!: Date;
  dataFim!: Date;
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  constructor(
    private svc: ColaboradorService,
    private exportService: ExportService,
    private empresaService: EmpresaService
  ) {}

  ngOnInit() {
    const hoje = new Date();
    this.dataInicio = hoje;
    this.dataFim    = hoje;

    this.empresaService.getEmpresas().subscribe(empresas => {
      this.empresas = empresas;
      this.empresasSelecionadas = empresas.length ? [empresas[0].id] : [];
      this.carregar();
    });
  }

  onEmpresasChange() { this.carregar(); }

  carregar() {
    if (!this.empresasSelecionadas || this.empresasSelecionadas.length === 0) return;
    // data local (toISOString usa UTC e, depois das 21h em Belém, já é o dia seguinte)
    const d1 = isoLocal(this.dataInicio);
    const d2 = isoLocal(this.dataFim);
    this.svc.produtividade(this.empresasSelecionadas, d1, d2).subscribe({
      next: rows => {
        this.todasLinhas = (rows ?? []).map(r => ({
          ...r,
          idDepartamento: r.idDepartamento == null ? null : Number(r.idDepartamento),
          departamento: r.departamento ?? '',
        }));
        this.montarSetores();
        this.aplicarFiltroSetor();
      },
      error: err => console.error('Angular ← erro na API', err)
    });
  }

  /** Setores presentes no resultado, do maior faturamento para o menor ("Sem departamento" no fim). */
  private montarSetores() {
    const mapa = new Map<number, { id: number; nome: string; qtd: number; fat: number }>();
    for (const r of this.todasLinhas) {
      if (r.idDepartamento == null) continue;
      const s = mapa.get(r.idDepartamento) ?? { id: r.idDepartamento, nome: r.departamento || 'Sem departamento', qtd: 0, fat: 0 };
      s.qtd++;
      s.fat += Number(r.faturamento) || 0;
      mapa.set(r.idDepartamento, s);
    }
    this.setoresDisponiveis = [...mapa.values()]
      .sort((a, b) => (a.id === -1 ? 1 : 0) - (b.id === -1 ? 1 : 0) || b.fat - a.fat)
      .map(({ id, nome, qtd }) => ({ id, nome, qtd }));
    if (this.setorFiltro && !this.setoresDisponiveis.some(s => String(s.id) === this.setorFiltro)) {
      this.setorFiltro = '';
    }
  }

  aplicarFiltroSetor() {
    this.dataSource.data = this.setorFiltro
      ? this.todasLinhas.filter(r => String(r.idDepartamento) === this.setorFiltro)
      : this.todasLinhas;
    this.cdr.detectChanges();
  }

  get nomeSetorFiltro(): string {
    return this.setoresDisponiveis.find(s => String(s.id) === this.setorFiltro)?.nome ?? '';
  }

  getEmpresaApelido(id: number): string {
    const empresa = this.empresas.find(e => e.id === id);
    return empresa?.apelido ?? String(id);
  }

  exportarExcel() {
    const headers = [
      '#', 'Nome', 'Setor', 'Vendas', 'Fatur. Líq', 'Lucro Líq', '%MG',
      'Desc. Prod. R$', 'Desc. Prod. %',
      'Desc. Fin. R$', 'Desc. Fin. %',
      'Devol.'
    ];
    const rows = this.dataSource.data.map((row: ColaboradorProdutividade) => [
      row.idVendedor, row.nome, row.departamento ?? '', row.qtdvenda,
      row.faturamento, row.lucro, `${row.margem}%`,
      row.descontoProdutoValor, `${row.descontoProdutoPerc}%`,
      row.descontoFinanceiroValor, `${row.descontoFinanceiroPerc}%`,
      row.devolucoes
    ]);
    this.exportService.exportToExcel(headers, rows, 'produtividade-colaborador');
  }

  get empresasSelecionadasResumo(): string {
    if (!this.empresasSelecionadas?.length) return '';
    const apelidos = this.empresasSelecionadas
      .map(id => this.getEmpresaApelido(id))
      .filter(Boolean);
    if (apelidos.length <= 3) return apelidos.join(', ');
    return `${apelidos.slice(0, 3).join(', ')} +${apelidos.length - 3}`;
  }

  exportarPDF() {
    const headers = [
      '#', 'Nome', 'Setor', 'Vendas', 'Fatur. Líq', 'Lucro Líq', '%MG',
      'Desc. Prod. R$', 'Desc. Prod. %',
      'Desc. Fin. R$', 'Desc. Fin. %',
      'Devol.'
    ];
    const rows = this.dataSource.data.map((row: ColaboradorProdutividade) => [
      row.idVendedor, row.nome, row.departamento ?? '', row.qtdvenda,
      row.faturamento.toFixed(2), row.lucro.toFixed(2),
      `${row.margem.toFixed(2)}%`,
      row.descontoProdutoValor.toFixed(2), `${row.descontoProdutoPerc.toFixed(2)}%`,
      row.descontoFinanceiroValor.toFixed(2), `${row.descontoFinanceiroPerc.toFixed(2)}%`,
      row.devolucoes
    ]);
    const empresasSelecionadasNomes = this.empresas
      .filter(e => this.empresasSelecionadas.includes(e.id))
      .map(e => `${e.id} - ${e.apelido}`)
      .join(', ');
    this.exportService.exportToPDF(headers, rows, 'produtividade-colaborador', {
      dataInicio: this.dataInicio, dataFim: this.dataFim,
      empresa: empresasSelecionadasNomes + (this.setorFiltro ? ` · Setor: ${this.nomeSetorFiltro}` : '')
    });
  }
}