import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import {
  FaturamentoService,
  FaturamentoEmpresaItem,
  FaturamentoFormaPagamentoItem
} from '../../../services/faturamento.service';

type AbaFaturamento = 'empresa' | 'forma-pagamento';

@Component({
  selector: 'app-faturamento',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule
  ],
  templateUrl: './faturamento.component.html',
  styleUrl: './faturamento.component.scss'
})
export class FaturamentoComponent implements OnInit {
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  dataInicio!: Date;
  dataFim!: Date;

  carregando = false;
  abaAtiva: AbaFaturamento = 'empresa';

  dadosPorEmpresa: FaturamentoEmpresaItem[] = [];
  dadosFormaPagamento: FaturamentoFormaPagamentoItem[] = [];

  constructor(
    private empresaService: EmpresaService,
    private faturamentoService: FaturamentoService
  ) {}

  ngOnInit(): void {
    const hoje = new Date();
    this.dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
    this.dataFim = hoje;

    this.empresaService.getEmpresas().subscribe({
      next: (empresas) => {
        this.empresas = empresas;
        this.empresasSelecionadas = empresas.length ? [empresas[0].id] : [];
        this.aplicarFiltros();
      },
      error: (err) => {
        console.error('Erro ao carregar empresas', err);
      }
    });
  }

  selecionarAba(aba: AbaFaturamento): void {
    this.abaAtiva = aba;
  }

  aplicarFiltros(): void {
    if (!this.empresasSelecionadas.length) {
      return;
    }

    this.carregando = true;

    const filtros = {
      empresas: this.empresasSelecionadas,
      dataInicio: this.toIsoDate(this.dataInicio),
      dataFim: this.toIsoDate(this.dataFim)
    };

    this.faturamentoService.buscarPorEmpresa(filtros).subscribe({
      next: (dados) => {
        this.dadosPorEmpresa = dados;
        this.buscarFormaPagamento(filtros);
      },
      error: (err) => {
        console.error('Erro ao buscar faturamento por empresa', err);
        this.carregando = false;
      }
    });
  }

  private buscarFormaPagamento(filtros: {
    empresas: number[];
    dataInicio: string;
    dataFim: string;
  }): void {
    this.faturamentoService.buscarPorFormaPagamento(filtros).subscribe({
      next: (dados) => {
        this.dadosFormaPagamento = dados;
      },
      error: (err) => {
        console.error('Erro ao buscar faturamento por forma de pagamento', err);
      },
      complete: () => {
        this.carregando = false;
      }
    });
  }

  private toIsoDate(data: Date): string {
    return data.toISOString().slice(0, 10);
  }

  moeda(valor: number | null | undefined): string {
    const numero = Number(valor || 0);
    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  percentual(valor: number | null | undefined): string {
    const numero = Number(valor || 0);
    return numero.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }) + '%';
  }

  get totalFaturamentoLiquido(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.TOTALVENDA || 0), 0);
  }

  get totalLucroLiquido(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.LUCRO || 0), 0);
  }

  get totalDevolucoes(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.DEVOLUCOES || 0), 0);
  }

  get totalVendas(): number {
    return this.dadosPorEmpresa.reduce((soma, item) => soma + Number(item.QTDVENDA || 0), 0);
  }
}