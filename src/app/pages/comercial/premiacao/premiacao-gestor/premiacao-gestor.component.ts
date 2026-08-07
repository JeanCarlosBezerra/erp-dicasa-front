import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PremiacaoService } from '../../../../services/premiacao.service';
import { BonusGestor } from '../../../../models/premiacao.model';

@Component({
  selector: 'app-premiacao-gestor',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatIconModule, MatTooltipModule],
  templateUrl: './premiacao-gestor.component.html',
  styleUrl: './premiacao-gestor.component.scss',
})
export class PremiacaoGestorComponent {
  private svc = inject(PremiacaoService);
  private cdr = inject(ChangeDetectorRef);

  dataSource = new MatTableDataSource<BonusGestor>([]);

  displayedColumns = [
    'nome',
    'faturamento', 'faturamentoPerc',
    'margem', 'margemPerc',
    'ticketMedio', 'ticketMedioPerc',
    'premioTotalPerc', 'premiacao',
  ];

  totalPremiacao = 0;
  qtdPremiados = 0;

  constructor() {
    afterNextRender(() => {
      this.carregar();
    });
  }

  carregar(): void {
    this.svc.getBonusGestores().subscribe({
      next: (rows) => {
        this.dataSource.data = rows;
        this.totalPremiacao = rows.reduce((acc, r) => acc + r.premiacao, 0);
        this.qtdPremiados = rows.filter((r) => r.premioTotalPerc > 0).length;
        this.cdr.detectChanges();
      },
    });
  }
}