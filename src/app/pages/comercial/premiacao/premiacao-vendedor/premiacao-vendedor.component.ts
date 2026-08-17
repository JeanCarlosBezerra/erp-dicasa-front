import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PremiacaoService } from '../../../../services/premiacao.service';
import { BonusVendedor, FaixaBonusVendedor } from '../../../../models/premiacao.model';

@Component({
  selector: 'app-premiacao-vendedor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatIconModule,
    MatTooltipModule, MatButtonModule, MatFormFieldModule, MatSelectModule,
  ],
  templateUrl: './premiacao-vendedor.component.html',
  styleUrl: './premiacao-vendedor.component.scss',
})
export class PremiacaoVendedorComponent {
  private svc = inject(PremiacaoService);
  private cdr = inject(ChangeDetectorRef);

  dataSource = new MatTableDataSource<BonusVendedor>([]);
  faixas: FaixaBonusVendedor[] = [];
  carregando = false;

  displayedColumns = [
    'idVendedor', 'nome', 'idEmpresa',
    'vendaRealizada', 'lucroRealizado',
    'faixaFaturamento', 'faixaLucratividade', 'faixaElegivel', 'premiacao',
  ];

  private readonly lojasMap: Record<number, string> = {
    1: 'HCAB', 2: 'Show Room', 3: 'COM1', 4: 'CDBR', 5: 'COJE',
    6: 'HCAM', 7: 'COM2', 8: 'HCVR', 9: 'CDAM', 10: 'Atacado',
  };

  nomeLoja(id: number | null): string {
    return id != null ? (this.lojasMap[id] ?? `Empresa ${id}`) : '—';
  }

  // Seletor de período — default no mês anterior (fechado)
  hoje = new Date();
  mesSelecionado = this.hoje.getMonth() === 0 ? 12 : this.hoje.getMonth();
  anoSelecionado = this.hoje.getMonth() === 0 ? this.hoje.getFullYear() - 1 : this.hoje.getFullYear();

  meses = [
    { v: 1, n: 'Janeiro' }, { v: 2, n: 'Fevereiro' }, { v: 3, n: 'Março' },
    { v: 4, n: 'Abril' }, { v: 5, n: 'Maio' }, { v: 6, n: 'Junho' },
    { v: 7, n: 'Julho' }, { v: 8, n: 'Agosto' }, { v: 9, n: 'Setembro' },
    { v: 10, n: 'Outubro' }, { v: 11, n: 'Novembro' }, { v: 12, n: 'Dezembro' },
  ];
  anos = [this.hoje.getFullYear() - 1, this.hoje.getFullYear()];

  totalPremiacao = 0;
  qtdElegiveis = 0;

  constructor() {
    this.faixas = this.svc.getFaixasVendedor();
    afterNextRender(() => this.carregar());
  }

  carregar(): void {
    this.carregando = true;
    this.svc.getBonusVendedores(this.mesSelecionado, this.anoSelecionado).subscribe({
      next: (rows) => {
        this.dataSource.data = rows;
        this.totalPremiacao = rows.reduce((acc, r) => acc + r.premiacao, 0);
        this.qtdElegiveis = rows.filter((r) => r.premiacao > 0).length;
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.dataSource.data = [];
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }
}