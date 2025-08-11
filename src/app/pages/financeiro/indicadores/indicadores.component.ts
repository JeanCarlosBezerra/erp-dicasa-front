import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';

type Trend = 'up' | 'down' | 'flat';

interface KpiCard {
  key: string;         // id único
  title: string;       // título do card
  value: string;       // valor principal
  subtitle?: string;   // observação/descrição
  trend?: Trend;       // tendência: up/down/flat
}

@Component({
  selector: 'app-indicadores',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule, MatButtonModule],
  templateUrl: './indicadores.component.html',
  styleUrls: ['./indicadores.component.scss']
})
export class IndicadoresComponent {

  // MOCK só para apresentação. Depois você troca por dados reais.
  kpis: KpiCard[] = [
    { key: 'dy',      title: 'Dividend Yield (D.Y)', value: '2,15%',  subtitle: 'Últimos 12 meses', trend: 'up' },
    { key: 'pl',      title: 'P/L',                   value: '24,28',  subtitle: 'Preço / Lucro',   trend: 'down' },
    { key: 'peg',     title: 'PEG Ratio',             value: '2,42',   subtitle: 'Crescimento',     trend: 'flat' },
    { key: 'pvp',     title: 'P/VP',                  value: '7,01',   subtitle: 'Preço / Valor Patrimonial' },
    { key: 'ev_ebit', title: 'EV/EBITDA',             value: '32,56' },
    { key: 'roe',     title: 'ROE',                   value: '28,86%', subtitle: 'Rentabilidade',   trend: 'up' },
    { key: 'roic',    title: 'ROIC',                  value: '25,60%', subtitle: 'Capital investido', trend: 'up' },
    { key: 'liq',     title: 'Liq. Corrente',         value: '1,77',   subtitle: 'Curto prazo' },
    { key: 'mbruta',  title: 'Margem Bruta',          value: '33,61%' },
    { key: 'mebit',   title: 'Margem EBIT',           value: '19,82%' },
    { key: 'mlq',     title: 'Margem Líquida',        value: '15,65%' },
    { key: 'cagr',    title: 'CAGR 5 anos',           value: '23,27%', subtitle: 'Receitas' },
  ];

  iconFor(trend?: Trend) {
    switch (trend) {
      case 'up':   return 'trending_up';
      case 'down': return 'trending_down';
      default:     return 'trending_flat';
    }
  }
}
