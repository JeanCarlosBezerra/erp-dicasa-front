import { Component } from '@angular/core';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';

@Component({
  selector: 'app-dashboard',
  imports: [
    BrowserModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})

export class DashboardComercialComponent {
  colunasTabela: string[] = ['loja', 'faturamentoPrevisto', 'faturamentoReal', 'lucroPrevisto', 'lucroReal', 'margemReal'];

  dadosLojas = [
    { loja: 'HCAB', faturamentoPrevisto: 4957953, faturamentoReal: 4266353, lucroPrevisto: 1378912, lucroReal: 1178348, margemReal: 29 },
    { loja: 'HCVR', faturamentoPrevisto: 3577000, faturamentoReal: 3206500, lucroPrevisto: 1020347, lucroReal: 909197, margemReal: 30 },
    { loja: 'HCAM', faturamentoPrevisto: 1165374, faturamentoReal: 998074, lucroPrevisto: 301038, lucroReal: 252521, margemReal: 29 },
    // ... mais lojas
  ];
}

