import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { PremiacaoService } from '../../../../services/premiacao.service';
import { BonusGestor } from '../../../../models/premiacao.model';

@Component({
  selector: 'app-premiacao-gestor',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatIconModule,
    MatTooltipModule, MatFormFieldModule, MatSelectModule,
  ],
  templateUrl: './premiacao-gestor.component.html',
  styleUrl: './premiacao-gestor.component.scss',
})
export class PremiacaoGestorComponent {
  private svc = inject(PremiacaoService);
  private cdr = inject(ChangeDetectorRef);

  dataSource = new MatTableDataSource<BonusGestor>([]);
  carregando = false;

  displayedColumns = [
    'nome',
    'faturamento', 'faturamentoPerc',
    'margem', 'margemPerc',
    'ticketMedio', 'ticketMedioPerc',
    'premioTotalPerc', 'premiacao',
  ];

  // Seletor de período — default no mês passado (mês fechado)
  hoje = new Date();
  mesSelecionado = this.hoje.getMonth() === 0 ? 12 : this.hoje.getMonth(); // mês anterior
  anoSelecionado = this.hoje.getMonth() === 0 ? this.hoje.getFullYear() - 1 : this.hoje.getFullYear();

  meses = [
    { v: 1, n: 'Janeiro' }, { v: 2, n: 'Fevereiro' }, { v: 3, n: 'Março' },
    { v: 4, n: 'Abril' }, { v: 5, n: 'Maio' }, { v: 6, n: 'Junho' },
    { v: 7, n: 'Julho' }, { v: 8, n: 'Agosto' }, { v: 9, n: 'Setembro' },
    { v: 10, n: 'Outubro' }, { v: 11, n: 'Novembro' }, { v: 12, n: 'Dezembro' },
  ];
  anos = [this.hoje.getFullYear() - 1, this.hoje.getFullYear()];

  totalPremiacao = 0;
  qtdPremiados = 0;

  constructor() {
    afterNextRender(() => this.carregar());
  }

  carregar(): void {
    this.carregando = true;
    this.svc.getBonusGestores(this.mesSelecionado, this.anoSelecionado).subscribe({
      next: (rows) => {
        this.dataSource.data = rows;
        this.totalPremiacao = rows.reduce((acc, r) => acc + r.premiacao, 0);
        this.qtdPremiados = rows.filter((r) => r.premioTotalPerc > 0).length;
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