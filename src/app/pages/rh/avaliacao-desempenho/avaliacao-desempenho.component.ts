import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { AvaliacaoService } from '../../../services/avaliacao.service';

interface Box9Item {
  matricula: string;
  nome: string;
  cargo: string;
  filial: string;
  setor: string;
  media_desempenho: number;
  media_potencial: number;
  titulo_9box: string;
}

interface ResumoFilial {
  filial: string;
  total: number;
  mediaDesemp: number;
  mediaPot: number;
  altosPotenciais: number;
}

@Component({
  selector: 'app-avaliacao-desempenho',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './avaliacao-desempenho.component.html',
  styleUrls: ['./avaliacao-desempenho.component.scss'],
})
export class AvaliacaoDesempenhoComponent {
  private cdr = inject(ChangeDetectorRef);

  cicloAtivo: any = null;
  dados: Box9Item[] = [];
  dadosFiltrados: Box9Item[] = [];
  filialFiltro = '';
  setorFiltro = '';
  carregando = true;
  abaSelecionada: 'matriz' | 'macro' = 'matriz';

  filiais = ['HCAB','HCAM','HCVR','CDAM','CDAT','BENJAMIN','CONCEPT'];

  readonly boxes = [
    { key: 'Enigma',           classe: 'enigma',          linha: 0, col: 0 },
    { key: 'Forte potencial',  classe: 'forte-potencial', linha: 0, col: 1 },
    { key: 'Alto potencial',   classe: 'alto-potencial',  linha: 0, col: 2 },
    { key: 'Questionável',     classe: 'questionavel',    linha: 1, col: 0 },
    { key: 'Mantenedor',       classe: 'mantenedor',      linha: 1, col: 1 },
    { key: 'Forte desempenho', classe: 'forte-desemp',    linha: 1, col: 2 },
    { key: 'Insuficiente',     classe: 'insuficiente',    linha: 2, col: 0 },
    { key: 'Eficaz',           classe: 'eficaz',          linha: 2, col: 1 },
    { key: 'Comprometido',     classe: 'comprometido',    linha: 2, col: 2 },
  ];

  boxSelecionado: string | null = null;

  constructor(private avalSvc: AvaliacaoService) {
    afterNextRender(() => {
      this.avalSvc.getCicloAtivo().subscribe({
        next: (ciclos: any[]) => {
          this.cicloAtivo = ciclos?.[0] ?? null;
          if (this.cicloAtivo) this.carregarDados();
          else { this.carregando = false; this.cdr.detectChanges(); }
        }
      });
    });
  }

  carregarDados() {
    this.carregando = true;
    this.avalSvc.getDashboard9Box(this.cicloAtivo.id_ciclo).subscribe({
      next: (res: any[]) => {
        this.dados = res;
        this.aplicarFiltro();
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: () => { this.carregando = false; this.cdr.detectChanges(); }
    });
  }

  aplicarFiltro() {
    this.dadosFiltrados = this.dados.filter(d =>
      (!this.filialFiltro || d.filial === this.filialFiltro) &&
      (!this.setorFiltro  || (d.setor || '').toLowerCase().includes(this.setorFiltro.toLowerCase()))
    );
    this.cdr.detectChanges();
  }

  countBox(key: string): number {
    return this.dadosFiltrados.filter(d =>
      d.titulo_9box?.toLowerCase() === key.toLowerCase()
    ).length;
  }

  pessoasBox(key: string): Box9Item[] {
    return this.dadosFiltrados.filter(d =>
      d.titulo_9box?.toLowerCase() === key.toLowerCase()
    );
  }

  toggleBox(key: string) {
    this.boxSelecionado = this.boxSelecionado === key ? null : key;
  }

  get totalAvaliados(): number { return this.dadosFiltrados.length; }

  get mediaGeralDesemp(): string {
    if (!this.dadosFiltrados.length) return '-';
    const m = this.dadosFiltrados.reduce((s, d) => s + Number(d.media_desempenho), 0) / this.dadosFiltrados.length;
    return m.toFixed(1);
  }

  get mediaGeralPot(): string {
    if (!this.dadosFiltrados.length) return '-';
    const m = this.dadosFiltrados.reduce((s, d) => s + Number(d.media_potencial), 0) / this.dadosFiltrados.length;
    return m.toFixed(1);
  }

  get topTalentos(): Box9Item[] {
    return [...this.dadosFiltrados]
      .sort((a, b) => (Number(b.media_desempenho) + Number(b.media_potencial)) -
                      (Number(a.media_desempenho) + Number(a.media_potencial)))
      .slice(0, 5);
  }

  // ── VISÃO MACRO: resumo por filial ──
  get resumoPorFilial(): ResumoFilial[] {
    const map = new Map<string, Box9Item[]>();
    this.dados.forEach(d => {
      if (!map.has(d.filial)) map.set(d.filial, []);
      map.get(d.filial)!.push(d);
    });
    return Array.from(map.entries())
      .map(([filial, itens]) => ({
        filial,
        total: itens.length,
        mediaDesemp: Number((itens.reduce((s, i) => s + Number(i.media_desempenho), 0) / itens.length).toFixed(1)),
        mediaPot:    Number((itens.reduce((s, i) => s + Number(i.media_potencial),   0) / itens.length).toFixed(1)),
        altosPotenciais: itens.filter(i => i.titulo_9box?.toLowerCase() === 'alto potencial').length,
      }))
      .sort((a, b) => b.total - a.total);
  }

  countBoxFilial(filial: string, key: string): number {
    return this.dados.filter(d => d.filial === filial && d.titulo_9box?.toLowerCase() === key.toLowerCase()).length;
  }

  selecionarFilial(filial: string) {
    this.filialFiltro = filial;
    this.abaSelecionada = 'matriz';
    this.aplicarFiltro();
  }

  limparFiltros() {
    this.filialFiltro = '';
    this.setorFiltro = '';
    this.boxSelecionado = null;
    this.aplicarFiltro();
  }

  get corMedia(): (val: string) => string {
    return (val: string) => {
      const n = parseFloat(val);
      if (isNaN(n)) return '';
      if (n >= 4) return 'verde';
      if (n >= 3) return 'amarelo';
      return 'vermelho';
    };
  }
}