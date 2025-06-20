import { Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableDataSource } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule } from '@angular/material/paginator';
import { CommonModule } from '@angular/common';
import { PedidosService } from '@app/services/pedidos.service';

@Component({
  selector: 'app-pedidos-list',
  standalone: true,
  templateUrl: './pedidos-list.component.html',
  styleUrls: ['./pedidos-list.component.scss'],
  imports: [
    CommonModule,
    MatPaginatorModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatInputModule
  ]
})
export class PedidosListComponent implements OnInit {
  displayedColumns: string[] = ['IDORCAMENTO', 'NOME', 'DTMOVIMENTO'];
  dataSource = new MatTableDataSource<any>();
  isLoading = true;

  @ViewChild(MatPaginator) paginator!: MatPaginator;

  constructor(private pedidosService: PedidosService) {}

  ngOnInit(): void {
  console.log('ngOnInit chamado - buscando pedidos');

  this.pedidosService.getPedidos().subscribe({
    next: (dados: any[]) => {
      console.log('Dados recebidos da API:', dados);
      this.dataSource.data = dados;
      this.dataSource.paginator = this.paginator;
      this.isLoading = false;
    },
    error: (err) => {
      console.error('Erro ao buscar pedidos:', err);
      this.isLoading = false;
    }
  });
}
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }
}
