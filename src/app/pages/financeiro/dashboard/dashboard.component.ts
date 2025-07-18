import { AfterViewInit, Component, ViewChild } from '@angular/core';
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
import { ChartData, ChartOptions } from 'chart.js/auto';
import { MatSelectModule } from '@angular/material/select';
import { NgChartsModule } from 'ng2-charts';
import { DashboardService, Pendente, ContasPagar, ContasReceber} from '../../../services/dashboard.service';
import { forkJoin } from 'rxjs';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-dashboard',
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
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements AfterViewInit{
  @ViewChild('paginatorPagar')   pagPagar!: MatPaginator;
  @ViewChild('paginatorReceber') pagReceber!: MatPaginator;
  @ViewChild('paginatorPendentes') pagPendentes!: MatPaginator;
  //---------------------------------------------------GRÁFICO 1 -----------------------------------------------------------------//
  filtroForm = new FormGroup({
    dataInicial: new FormControl<Date|null>(null),
    dataFinal:   new FormControl<Date|null>(null),
    empresa:     new FormControl<number>(1),
  });

  colunasPagar   = ['idclifor','nome','valtitulo','sumvalpagamentotitulo'];
  apagarDataSource   = new MatTableDataSource<ContasPagar>([]);

  colunasReceberCTA = ['idctadebito','descrctadebito','valtitulo','sumvalpagamentotitulo'];
  receberDataSource = new MatTableDataSource<ContasReceber>([]);

  displayedColumns = ['idclifor','cliente','valsaldotitulo','diaspgto'];
  pendentesDataSource = new MatTableDataSource<Pendente>([]);

  totalPagamentosPrevistos = 0;
  totalPagamentosRealizados = 0;
  totalValTituloReceber = 0;
  totalPagamentosReceber = 0;

   ngAfterViewInit() {
    // depois que a view existir, conecta o paginator
    this.apagarDataSource.paginator   = this.pagPagar;
    this.receberDataSource.paginator = this.pagReceber;
    this.pendentesDataSource.paginator = this.pagPendentes;
  }

  graficoDuploData: any;
  graficoSecundarioData: any;

    // adicione isto:
  graficoDuploOptions: ChartOptions<'bar'> = {
    responsive: true,
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true }
    }
  };

  graficoSecundarioOptions: ChartOptions<'line'> = {
    responsive: true,
    scales: {
      x: { beginAtZero: true },
      y: { beginAtZero: true }
    }
  };

  constructor(private dashboardService: DashboardService) {}
  buscar() {
    if (this.filtroForm.invalid) return;
    const { dataInicial, dataFinal, empresa } = this.filtroForm.value;

    // converte para Date e clona
    const iniAtual = new Date(dataInicial!);
    const fimAtual = new Date(dataFinal!);

    const parseBRL = (s: string) =>
    Number(s.replace(/\./g,'').replace(',','.'));

    // calcula mesmo dia/mês, mas um ano antes
    const iniAnoAnt = new Date(iniAtual);
    iniAnoAnt.setFullYear(iniAnoAnt.getFullYear() - 1);
    const fimAnoAnt = new Date(fimAtual);
    fimAnoAnt.setFullYear(fimAnoAnt.getFullYear() - 1);
console.log('APSSOU AQUI1');
    // dispara as duas requisições em paralelo
    forkJoin({
    atual:    this.dashboardService.getFaturamentoLiquido(iniAtual, fimAtual, empresa!),
    anterior: this.dashboardService.getFaturamentoLiquido(iniAnoAnt, fimAnoAnt, empresa!)
    }).subscribe({
      next: ({ atual, anterior }) => {
        // pega o objeto cru
        const ra = (atual[0] ?? {}) as any;
        const rb = (anterior[0] ?? {}) as any;
      
        // lê totalvenda lowercase ou uppercase, ou zero
        const vendaAtual = Number(ra.totalvenda ?? ra.TOTALVENDA ?? 0);
        const vendaAnterior = Number(rb.totalvenda ?? rb.TOTALVENDA ?? 0);
      
        // monta o ChartData com duas barras
        this.graficoDuploData = {
          labels: ['Atual', 'Ano Anterior'],
          datasets: [{
            label: 'Total Venda',
            data: [vendaAtual, vendaAnterior]
          }]
        };
      },
      error: err => console.error(err)
    });
    console.log('APSSOU AQUI');
    this.dashboardService.getPendentes(empresa!, dataInicial!, dataFinal!)
    .subscribe({
          next: raw => {
            // mapeia as propriedades para lowercase  
            const pendentes = raw.map(r => ({
              idclifor:      r['idclifor'],
              cliente:       r['cliente'],
              valsaldotitulo: r['valsaldotitulo'],
              diaspgto:      r['diaspgto'],
            }));
            this.pendentesDataSource.data = pendentes;
            // o paginator já está conectado em ngAfterViewInit
          },
          error: err => console.error(err)
        });
console.log('AQUI ENTROU →');
  forkJoin({
    pagar:   this.dashboardService.getContasAPagar(empresa!, dataInicial!, dataFinal!),
    receber: this.dashboardService.getContasAReceber(empresa!, dataInicial!, dataFinal!)
  }).subscribe({
    next: ({ pagar, receber }) => {

      console.log('RAW PAGAR →', pagar);
      console.log('RAW RECEBER →', receber);
      // 1) alimenta o MatTableDataSource
      const ContasPagar = pagar.map(r => ({
      idclifor:      r['idclifor'],
      nome:                r['nome'],
      valtitulo:           r['valtitulo'],
      sumvalpagamentotitulo:  r['sumvalpagamentotitulo']
      }));

      const ContasReceberCTA = receber.map(r => ({
      idctadebito:      r['idctadebito'],
      descrctadebito:         r['descrctadebito'],
      valtitulo:           r['valtitulo'],
      sumvalpagamentotitulo:  r['sumvalpagamentotitulo']
      }));
      this.apagarDataSource.data = ContasPagar;
      this.receberDataSource.data = ContasReceberCTA;
     
      this.totalPagamentosPrevistos     = pagar.reduce((s, c) => s + Number(c.valtitulo), 0);
      this.totalPagamentosRealizados    = pagar.reduce((s, c) => s + Number(c.sumvalpagamentotitulo), 0);

      this.totalValTituloReceber   = receber.reduce((s, c) => s + Number(c.valtitulo), 0);
      this.totalPagamentosReceber  = receber.reduce((s, c) => s + Number(c.sumvalpagamentotitulo), 0);
    },
    error: err => console.error('Erro tabelas:', err)
  }); 

  }

  limpar() {
    this.filtroForm.reset({ empresa: 1 });
    this.buscar();
  }
}