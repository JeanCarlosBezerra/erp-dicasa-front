import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';

interface EmpresaIndicador {
  loja: string;
  metaFaturamento: number;
  faturamentoReal: number;
  metaMargem: number; // ex: 0.29
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

  margemReal?: number;
  margemVar?: number;
}

@Component({
  selector: 'app-dashboard-comercial',
  standalone: true,
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatIconModule,
    MatInputModule,
    MatButtonModule
  ]
})
export class DashboardComercialComponent {
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

      e.margemReal = e.faturamentoReal ? e.lucroReal / e.faturamentoReal : 0;
      e.margemVar = e.margemReal - e.metaMargem;

      this.totalFaturamento += e.faturamentoReal;
      this.totalLucro += e.lucroReal;
    });
  }

  formatPercent(value?: number): string {
    return value != null ? (value).toFixed(1) + '%' : '-';
  }

  getCor(valor: number | undefined): string {
    if (valor == null) return '';
    if (valor >= 100 || valor >= 0) return 'verde';
    if (valor < 0 && valor > -10) return 'amarelo';
    return 'vermelho';
  }
}
