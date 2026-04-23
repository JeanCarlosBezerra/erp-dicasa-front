import { AfterViewInit, Component, ViewChild, OnInit } from '@angular/core';
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

  displayedColumns = [
    'idVendedor',
    'nome',
    'qtdvenda',
    'faturamento',
    'lucro',
    'margem',
    'descontoValor',   // ← novo
    'descontoPerc',    // ← novo
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
    const d1 = this.dataInicio.toISOString().slice(0, 10);
    const d2 = this.dataFim.toISOString().slice(0, 10);
    this.svc.produtividade(this.empresasSelecionadas, d1, d2).subscribe({
      next: rows => this.dataSource.data = rows,
      error: err => console.error('Angular ← erro na API', err)
    });
  }

  getEmpresaApelido(id: number): string {
    const empresa = this.empresas.find(e => e.id === id);
    return empresa?.apelido ?? String(id);
  }

  exportarExcel() {
    const headers = ['#', 'Nome', 'Vendas', 'Fatur. Líq', 'Lucro Líq', '%MG', 'Desc. R$', 'Desc. %', 'Devol.'];
    const rows = this.dataSource.data.map((row: ColaboradorProdutividade) => [
      row.idVendedor, row.nome, row.qtdvenda,
      row.faturamento, row.lucro, `${row.margem}%`,
      row.descontoValor, `${row.descontoPerc}%`,
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
    const headers = ['#', 'Nome', 'Vendas', 'Fatur. Líq', 'Lucro Líq', '%MG', 'Desc. R$', 'Desc. %', 'Devol.'];
    const rows = this.dataSource.data.map((row: ColaboradorProdutividade) => [
      row.idVendedor, row.nome, row.qtdvenda,
      row.faturamento.toFixed(2), row.lucro.toFixed(2),
      `${row.margem.toFixed(2)}%`,
      row.descontoValor.toFixed(2), `${row.descontoPerc.toFixed(2)}%`,
      row.devolucoes
    ]);
    const empresasSelecionadasNomes = this.empresas
      .filter(e => this.empresasSelecionadas.includes(e.id))
      .map(e => `${e.id} - ${e.apelido}`)
      .join(', ');
    this.exportService.exportToPDF(headers, rows, 'produtividade-colaborador', {
      dataInicio: this.dataInicio, dataFim: this.dataFim,
      empresa: empresasSelecionadasNomes
    });
  }
}