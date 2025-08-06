import { Component } from '@angular/core';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';

interface Empresa {
  loja: string;
  metaFaturamento: number;
  metaLucro: number;
  metaMargem: number;

  faturamentoReal: number;
  lucroReal: number;

  // calculados
  saldoFaturamento?: number;
  percFaturamento?: number;
  saldoLucro?: number;
  percLucro?: number;
  percMargem?: number;
  percMargemVar?: number;
}

@Component({
  selector: 'app-dashboard-comercial',
  standalone: true,
  styleUrls: ['./dashboard.component.scss'],
  templateUrl: './dashboard.component.html',
  imports: [
    CommonModule,
    FormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatTableModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule
  ]
})
export class DashboardComercialComponent {
  colunasMeta: string[] = ['loja', 'metaFaturamento', 'metaLucro', 'metaMargem'];

  empresas: Empresa[] = [
    { loja: 'HCAB', metaFaturamento: 4908400, metaLucro: 1423436, metaMargem: 29, faturamentoReal: 4266353, lucroReal: 1178348 },
    { loja: 'HCVR', metaFaturamento: 2629500, metaLucro: 788850, metaMargem: 30, faturamentoReal: 3206500, lucroReal: 909197 },
    { loja: 'HCAM', metaFaturamento: 1232700, metaLucro: 357483, metaMargem: 29, faturamentoReal: 998074, lucroReal: 252521 }
  ];

  totalFaturamento = 0;
  totalLucro = 0;

  calcular() {
    this.totalFaturamento = 0;
    this.totalLucro = 0;

    this.empresas.forEach(e => {
      e.saldoFaturamento = e.faturamentoReal - e.metaFaturamento;
      e.percFaturamento = (e.faturamentoReal / e.metaFaturamento) * 100;

      e.saldoLucro = e.lucroReal - e.metaLucro;
      e.percLucro = (e.lucroReal / e.metaLucro) * 100;

      e.percMargem = (e.lucroReal / e.faturamentoReal) * 100;
      e.percMargemVar = e.percMargem - e.metaMargem;

      this.totalFaturamento += e.faturamentoReal;
      this.totalLucro += e.lucroReal;
    });
  }
}