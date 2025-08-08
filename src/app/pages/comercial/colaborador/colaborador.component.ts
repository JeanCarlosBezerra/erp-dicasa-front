import { AfterViewInit, Component, ViewChild, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common'; 
import { FormsModule,
         ReactiveFormsModule,
         FormGroup,
         FormControl }           from '@angular/forms';
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
import { NgForm }                          from '@angular/forms';             // para ngModel
import { ExportService } from '../../../shared/export.service';
import { MatIconModule } from '@angular/material/icon'; // ✅ IMPORTAR
import { EmpresaService } from '../../..//services/empresa.service';
import { Empresa } from '../../../models/empresa.model';



@Component({
  selector: 'app-colaborador',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    ReactiveFormsModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatSelectModule,
    NgChartsModule,
    MatPaginatorModule,
    MatCardModule,
    MatTableModule,
    MatIconModule, // ✅ AQUI!!!
  ],
  providers: [ExportService], // ✅ AQUI!
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
  'devolucoes'
];

dataInicio!: Date;
dataFim!: Date;
empresas: Empresa[] = [];
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
  this.empresas = empresas.map(e => ({
    id: (e as any).IDEMPRESA ?? e.id,
    nome: (e as any).NOMEFANTASIA ?? e.nome
  }));

  this.empresasSelecionadas = this.empresas.map(e => e.id); // seleciona todas por padrão
  this.carregar();
});
}

  carregar() {
  if (!this.empresasSelecionadas || this.empresasSelecionadas.length === 0) {
    console.warn('Nenhuma empresa selecionada');
    return;
  }

  const d1 = this.dataInicio.toISOString().slice(0, 10);
  const d2 = this.dataFim.toISOString().slice(0, 10);

  console.log('Empresas selecionadas:', this.empresasSelecionadas); // deve logar [1,2,3]

  this.svc.produtividade(this.empresasSelecionadas, d1, d2).subscribe({
    next: rows => this.dataSource.data = rows,
    error: err => console.error('Angular ← erro na API', err)
  });
}

  exportarExcel() {
  const headers = ['#', 'Nome', 'Vendas', 'Fatur. Líq', 'Lucro Líq', '%MG', 'Devol.'];
  const rows = this.dataSource.data.map((row: ColaboradorProdutividade) => [
    row.idVendedor,
    row.nome,
    row.qtdvenda,
    row.faturamento,
    row.lucro,
    `${row.margem}%`,
    row.devolucoes
  ]);

  this.exportService.exportToExcel(headers, rows, 'produtividade-colaborador');
}

exportarPDF() {
  const headers = ['#', 'Nome', 'Vendas', 'Fatur. Líq', 'Lucro Líq', '%MG', 'Devol.'];
  const rows = this.dataSource.data.map((row: ColaboradorProdutividade) => [
    row.idVendedor,
    row.nome,
    row.qtdvenda,
    row.faturamento.toFixed(2),
    row.lucro.toFixed(2),
    `${row.margem.toFixed(2)}%`,
    row.devolucoes
  ]);

    
  this.exportService.exportToPDF(headers, rows, 'produtividade-colaborador', {
    dataInicio: this.dataInicio,
    dataFim: this.dataFim,
    empresas: this.empresasSelecionadas.join(', ')
  });
}
}
