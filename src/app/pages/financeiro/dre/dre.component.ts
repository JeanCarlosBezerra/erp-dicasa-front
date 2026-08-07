import { Component, inject, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { forkJoin } from 'rxjs';
import { DreService, CascataDRE, LinhaDRE } from '../../../services/dre.service';
// Reusa o EmpresaService existente do projeto (app/services/empresa.service.ts).
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';

// linha combinada (NF + Pedido) achatada para render
interface LinhaVisivel {
  tipo: 'conta' | 'categoria';
  nivel: number;
  chave: string;
  descricao: string;
  ehSubtotal: boolean;
  temFilhos: boolean;
  expandido: boolean;
  // valores das duas colunas (null = não disponível)
  valorNf: number | null;
  pctNf: number | null;
  valorPedido: number | null;
  pctPedido: number | null;
  // diferença Pedido - NF (null quando algum lado é n/d)
  diferenca: number | null;
}

@Component({
  selector: 'app-dre',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatButtonModule,
    MatTooltipModule, MatFormFieldModule, MatSelectModule,
  ],
  templateUrl: './dre.component.html',
  styleUrl: './dre.component.scss',
})
export class DreComponent implements OnInit {
  private svc = inject(DreService);
  private empresaSvc = inject(EmpresaService);
  private cdr = inject(ChangeDetectorRef);

  dataInicio = '2026-07-01';
  dataFim = '2026-07-31';

  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  private cascataNf: CascataDRE | null = null;
  private cascataPedido: CascataDRE | null = null;
  linhasVisiveis: LinhaVisivel[] = [];
  private expandidos = new Set<string>();
  carregando = false;

  // KPIs (baseados na NF, a fonte principal detalhada)
  receitaBruta = 0;
  lucroBruto = 0;
  margemBrutaPerc = 0;

  ngOnInit(): void {
    this.empresaSvc.getEmpresas().subscribe({
      next: (emps) => {
        this.empresas = emps;
        this.empresasSelecionadas = emps.map((e) => Number(e.id));
        this.carregar();
        this.cdr.detectChanges();
      },
      error: (err) => { console.error('DRE ← erro empresas', err); this.cdr.detectChanges(); },
    });
  }

  onEmpresasChange(): void { this.carregar(); }

  selecionarTodas(ev: Event): void {
    ev.stopPropagation();
    this.empresasSelecionadas = this.empresas.map((e) => Number(e.id));
    this.carregar();
    this.cdr.detectChanges();
  }

  limparSelecao(ev: Event): void {
    ev.stopPropagation();
    this.empresasSelecionadas = [];
    this.cascataNf = null;
    this.cascataPedido = null;
    this.linhasVisiveis = [];
    this.cdr.detectChanges();
  }

  get empresasResumo(): string {
    if (!this.empresasSelecionadas?.length) return 'Nenhuma';
    if (this.empresasSelecionadas.length === this.empresas.length) return 'Todas (consolidado)';
    const nomes = this.empresasSelecionadas
      .map((id) => this.empresas.find((e) => Number(e.id) === id)?.apelido ?? String(id));
    if (nomes.length <= 2) return nomes.join(', ');
    return `${nomes.slice(0, 2).join(', ')} +${nomes.length - 2}`;
  }

  carregar(): void {
    if (!this.empresasSelecionadas?.length) {
      this.cascataNf = null; this.cascataPedido = null; this.linhasVisiveis = [];
      return;
    }
    this.carregando = true;

    // busca as duas cascatas em paralelo (chamadas HTTP independentes — ok no front)
    forkJoin({
      nf: this.svc.getCascataNfEmitida(this.empresasSelecionadas, this.dataInicio, this.dataFim),
      pedido: this.svc.getCascataPedido(this.empresasSelecionadas, this.dataInicio, this.dataFim),
    }).subscribe({
      next: ({ nf, pedido }) => {
        this.cascataNf = nf;
        this.cascataPedido = pedido;
        this.calcularKpis(nf);
        this.reconstruirLinhas();
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('DRE ← erro na API', err);
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }

  private calcularKpis(nf: CascataDRE): void {
    const rb = nf.linhas.find((l) => l.codigo === '1')?.valor ?? 0;
    const lb = nf.linhas.find((l) => l.codigo === '7')?.valor ?? 0;
    this.receitaBruta = rb;
    this.lucroBruto = lb;
    this.margemBrutaPerc = rb ? lb / rb : 0;
  }

  toggle(linha: LinhaVisivel): void {
    if (!linha.temFilhos) return;
    if (this.expandidos.has(linha.chave)) this.expandidos.delete(linha.chave);
    else this.expandidos.add(linha.chave);
    this.reconstruirLinhas();
    this.cdr.detectChanges();
  }

  /** Combina NF + Pedido por código de linha e achata para a tabela */
  private reconstruirLinhas(): void {
    if (!this.cascataNf) { this.linhasVisiveis = []; return; }
    const out: LinhaVisivel[] = [];

    // indexa pedido por código para lookup rápido
    const pedidoPorCodigo = new Map<string, LinhaDRE>();
    for (const l of this.cascataPedido?.linhas ?? []) pedidoPorCodigo.set(l.codigo, l);

    const val = (v: number | null | undefined) =>
      (v === null || v === undefined) ? null : Number(v);

    for (const linha of this.cascataNf.linhas) {
      const chaveConta = `c:${linha.codigo}`;
      const temFilhos = !!linha.filhos?.length; // só NF tem drill-down
      const expandido = this.expandidos.has(chaveConta);
      const ped = pedidoPorCodigo.get(linha.codigo);
      const vNf = val(linha.valor);
      const vPed = ped ? val(ped.valor) : null;
      const dif = (vNf !== null && vPed !== null) ? (vPed - vNf) : null;

      out.push({
        tipo: 'conta', nivel: 0, chave: chaveConta,
        descricao: linha.descricao, ehSubtotal: linha.tipo === 'subtotal',
        temFilhos, expandido,
        valorNf: vNf, pctNf: linha.percentualReceita,
        valorPedido: vPed,
        pctPedido: ped ? ped.percentualReceita : null,
        diferenca: dif,
      });

      // drill-down (só NF; a coluna Pedido fica vazia nas categorias)
      if (temFilhos && expandido) {
        for (const div of linha.filhos!) {
          const chaveDiv = `${chaveConta}|d:${div.nome}`;
          const divTemFilhos = !!div.filhos?.length;
          const divExpandido = this.expandidos.has(chaveDiv);

          out.push({
            tipo: 'categoria', nivel: 1, chave: chaveDiv,
            descricao: div.nome, ehSubtotal: false,
            temFilhos: divTemFilhos, expandido: divExpandido,
            valorNf: val(div.valor), pctNf: null, valorPedido: null, pctPedido: null,
            diferenca: null,
          });

          if (divTemFilhos && divExpandido) {
            for (const sec of div.filhos!) {
              out.push({
                tipo: 'categoria', nivel: 2, chave: `${chaveDiv}|s:${sec.nome}`,
                descricao: sec.nome, ehSubtotal: false,
                temFilhos: false, expandido: false,
                valorNf: val(sec.valor), pctNf: null, valorPedido: null, pctPedido: null,
                diferenca: null,
              });
            }
          }
        }
      }
    }
    this.linhasVisiveis = out;
  }
}