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
  ],
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

  dataInicio!    : Date;
  dataFim!       : Date;
  empresaFiltro! : number;

  constructor(private svc: ColaboradorService) {}

  ngOnInit() {
    const hoje = new Date();
    this.dataInicio = hoje;
    this.dataFim    = hoje;
    this.empresaFiltro = 1;
    this.carregar();
  }

  carregar() {
    const d1 = this.dataInicio.toISOString().slice(0,10);
    const d2 = this.dataFim   .toISOString().slice(0,10);

    const emp = Number(this.empresaFiltro);
    console.log('filtrando…', this.empresaFiltro, this.dataInicio, this.dataFim);

    this.svc
      .produtividade(emp, d1, d2)
      .subscribe((rows: ColaboradorProdutividade[]) => {
        this.dataSource.data = rows;
      });
  }
}
