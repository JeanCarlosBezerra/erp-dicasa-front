import { Component, OnInit, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonModule } from '@angular/material/button';
import { PremiacaoService } from '../../../../services/premiacao.service';
import { BonusVendedor, FaixaBonusVendedor } from '../../../../models/premiacao.model';

@Component({
  selector: 'app-premiacao-vendedor',
  standalone: true,
  imports: [CommonModule, MatTableModule, MatIconModule, MatTooltipModule, MatButtonModule],
  templateUrl: './premiacao-vendedor.component.html',
  styleUrl: './premiacao-vendedor.component.scss',
})
export class PremiacaoVendedorComponent implements OnInit {
  private svc = inject(PremiacaoService);
  private cdr = inject(ChangeDetectorRef);

  dataSource = new MatTableDataSource<BonusVendedor>([]);
  faixas: FaixaBonusVendedor[] = [];

  displayedColumns = [
    'idVendedor', 'nome', 'loja', 'setor',
    'vendaRealizada', 'lucroRealizado',
    'faixaFaturamento', 'faixaLucratividade', 'faixaElegivel', 'premiacao',
  ];

  totalPremiacao = 0;
  qtdElegiveis = 0;

  constructor() {
    // padrão do projeto: renderização fora do zone.js
    afterNextRender(() => {
      this.carregar();
    });
  }

  ngOnInit(): void {
    this.faixas = this.svc.getFaixasVendedor();
  }

  carregar(): void {
    this.svc.getBonusVendedores().subscribe({
      next: (rows) => {
        this.dataSource.data = rows;
        this.totalPremiacao = rows.reduce((acc, r) => acc + r.premiacao, 0);
        this.qtdElegiveis = rows.filter((r) => r.premiacao > 0).length;
        this.cdr.detectChanges();
      },
    });
  }
}