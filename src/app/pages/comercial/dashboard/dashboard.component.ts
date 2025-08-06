import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

interface EmpresaIndicador {
  loja: string;
  metaFaturamento: number;
  faturamentoReal: number;
  metaMargem: number; // ex: 0.29 para 29%
  lucroReal: number;

  // Calculados
  projFaturamento?: number;
  metaRestanteFaturamento?: number;
  percFaturamento?: number;
  saldoFaturamento?: number;
  percVarFaturamento?: number;

  metaLucroTotal?: number;
  projLucro?: number;
  metaLucroRestante?: number;
  percLucro?: number;
  saldoLucro?: number;
  percVarLucro?: number;
}

@Component({
  selector: 'app-dashboard-comercial',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
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
  displayedColumns: string[] = [
    'loja', 'metaFaturamento', 'faturamentoReal', 'percFaturamento',
    'projFaturamento', 'metaRestanteFaturamento', 'saldoFaturamento', 'percVarFaturamento',
    'metaMargem', 'metaLucroTotal', 'lucroReal', 'percLucro',
    'projLucro', 'metaLucroRestante', 'saldoLucro', 'percVarLucro'
  ];

  empresas: EmpresaIndicador[] = [
    { loja: 'HCAB', metaFaturamento: 4908400, faturamentoReal: 4266353, lucroReal: 1178348, metaMargem: 0.29 },
    { loja: 'HCVR', metaFaturamento: 2629500, faturamentoReal: 3206500, lucroReal: 909197, metaMargem: 0.30 },
    { loja: 'HCAM', metaFaturamento: 1232700, faturamentoReal: 998074, lucroReal: 252521, metaMargem: 0.29 }
  ];

  totalFaturamento = 0;
  totalLucro = 0;

  calcular() {
    this.totalFaturamento = 0;
    this.totalLucro = 0;

    this.empresas.forEach(e => {
      e.metaRestanteFaturamento = e.metaFaturamento - e.faturamentoReal;
      e.projFaturamento = e.faturamentoReal + (e.metaRestanteFaturamento || 0);
      e.percFaturamento = (e.faturamentoReal / e.metaFaturamento) * 100;
      e.saldoFaturamento = e.faturamentoReal - e.metaFaturamento;
      e.percVarFaturamento = (e.faturamentoReal / e.metaFaturamento - 1) * 100;

      e.metaLucroTotal = e.metaFaturamento * e.metaMargem;
      e.metaLucroRestante = e.metaLucroTotal - e.lucroReal;
      e.projLucro = e.lucroReal + (e.metaLucroRestante || 0);
      e.percLucro = (e.lucroReal / e.metaLucroTotal) * 100;
      e.saldoLucro = e.lucroReal - e.metaLucroTotal;
      e.percVarLucro = (e.lucroReal / e.metaLucroTotal - 1) * 100;

      this.totalFaturamento += e.faturamentoReal;
      this.totalLucro += e.lucroReal;
    });
  }
}
