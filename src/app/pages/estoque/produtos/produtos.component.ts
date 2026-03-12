import { Component, OnInit } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';

import {
  EstoqueProdutosService,
  CurvaAbcProduto,
  CurvaAbcResumoItem,
  CurvaAbcResponse,
} from '../../../services/estoque-produtos.service';

@Component({
  selector: 'app-estoque-produtos',
  standalone: true,
  templateUrl: './produtos.component.html',
  styleUrls: ['./produtos.component.scss'],
  imports: [
    CommonModule,
    FormsModule,
    DecimalPipe,
  ],
})


export class ProdutosComponent implements OnInit {
  dtBase = new Date().toISOString().substring(0, 10);
  produtos: CurvaAbcProduto[] = [];
  resumo: CurvaAbcResumoItem[] = [];
  loading = false;

  constructor(private readonly service: EstoqueProdutosService) {}

  ngOnInit(): void {
    this.carregarCurvaAbc();
  }

  carregarCurvaAbc(): void {
  this.loading = true;

  this.service.getCurvaAbc({ dtBase: this.dtBase }).subscribe({
    next: (resp: CurvaAbcResponse) => {
      this.produtos = resp.produtos;
      this.resumo = resp.resumo;
      this.loading = false;
    },
    error: (err: unknown) => {
      console.error(err);
      this.loading = false;
    },
  });
}
}
