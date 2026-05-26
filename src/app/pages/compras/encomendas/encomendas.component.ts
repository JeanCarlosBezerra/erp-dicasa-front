import { Component, inject, ChangeDetectorRef, afterNextRender, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HttpClient } from '@angular/common/http';
import { EncomendasService, EncomendaItem, TipoCompra } from '../../../services/encomendas.service';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-encomendas',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatTableModule, MatSortModule,
    MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule,
    MatDatepickerModule, MatNativeDateModule,
    MatTooltipModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  templateUrl: './encomendas.component.html',
  styleUrl: './encomendas.component.scss',
})
export class EncomendasComponent {
  private cdr    = inject(ChangeDetectorRef);
  private svc    = inject(EncomendasService);
  private empSvc = inject(EmpresaService);
  private http   = inject(HttpClient);

  @ViewChild(MatSort) sort!: MatSort;

  // ─── Estado ──────────────────────────────────────────────────────────────
  carregando = false;
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  dataInicio: Date = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  dataFim: Date    = new Date();

  tipoFiltro: string      = 'TODOS';
  filtroProduto: string   = '';
  filtroFornecedor: string = '';   // ← filtro fornecedor
  filtroMarca: string      = '';   // ← filtro marca

  nfeDetalhe: any = null;
  nfeDetalheId: number | null = null;
  carregandoDetalhe = false;

  private todosItens: EncomendaItem[] = [];

  dataSource = new MatTableDataSource<EncomendaItem>([]);

  displayedColumns = [
    'detalhe', 'nroNf', 'dtEmissao', 'fornecedor', 'transportador',
    'empresaEncomenda', 'cliente', 'produto',
    'pcExtraido', 'pedidoVenda',
    'previsaoEntrega', 'valorNf',
    'metodoExtracao', 'gravadaErp', 'tipoCompra',
  ];

  tipoOptions = [
    { value: 'TODOS',             label: 'Todos' },
    { value: 'ENCOMENDA',         label: 'Encomendas' },
    { value: 'ESTOQUE',           label: 'Compra de Estoque' },
    { value: 'SEM_PC',            label: 'Sem identificação' },
    { value: 'PC_NAO_ENCONTRADO', label: 'PC não encontrado' },
  ];

  constructor() {
    afterNextRender(() => {
      this.empSvc.getEmpresas().subscribe(empresas => {
        this.empresas = empresas;
        this.empresasSelecionadas = empresas.map(e => e.id);
        this.carregar();
        this.cdr.detectChanges();
      });
    });
  }

  // ─── Carrega da API ───────────────────────────────────────────────────────
  carregar() {
    if (!this.empresasSelecionadas.length) return;

    const d1 = this.dataInicio.toISOString().slice(0, 10);
    const d2 = this.dataFim.toISOString().slice(0, 10);

    this.carregando = true;
    this.cdr.detectChanges();

    this.svc.getEncomendas(this.empresasSelecionadas, d1, d2).subscribe({
      next: rows => {
        this.todosItens = rows;
        this.aplicarFiltro();
        this.carregando = false;
        if (this.sort) this.dataSource.sort = this.sort;
        this.cdr.detectChanges();
      },
      error: err => {
        console.error('[Encomendas]', err);
        this.carregando = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─── Filtros frontend ─────────────────────────────────────────────────────
  aplicarFiltro() {
    let dados = this.todosItens;

    // Tipo
    if (this.tipoFiltro !== 'TODOS') {
      dados = dados.filter(d => d.tipoCompra === this.tipoFiltro);
    }

    // Fornecedor — busca no nome do fornecedor da NF
    if (this.filtroFornecedor.trim()) {
      const termo = this.filtroFornecedor.trim().toLowerCase();
      dados = dados.filter(d =>
        d.fornecedor.toLowerCase().includes(termo)
      );
    }

    // Produto — busca por código ou nome nos produtos do pedido
    if (this.filtroProduto.trim()) {
      const termo = this.filtroProduto.trim().toLowerCase();
      const termoNumerico = Number(termo);
      const ehNumero = !isNaN(termoNumerico) && termo !== '';
    
      dados = dados.filter(d => {
        const prods = d.pedidoCompra?.produtos ?? [];
        return prods.some(p =>
          ehNumero
            ? p.idProduto === termoNumerico          // ← ID exato
            : p.descricao.toLowerCase().includes(termo) // ← nome parcial
        );
      });
    }

    // Marca — busca na marca dos produtos do pedido
    if (this.filtroMarca.trim()) {
      const termo = this.filtroMarca.trim().toLowerCase();
      dados = dados.filter(d => {
        const prods = d.pedidoCompra?.produtos ?? [];
        return prods.some((p: any) =>
          (p.marca ?? '').toLowerCase().includes(termo)
        );
      });
    }

    this.dataSource.data = dados;
    if (this.sort) this.dataSource.sort = this.sort;
    this.cdr.detectChanges();
  }

  onTipoChange()       { this.aplicarFiltro(); }
  onProdutoChange()    { this.aplicarFiltro(); }
  onFornecedorChange() { this.aplicarFiltro(); }
  onMarcaChange()      { this.aplicarFiltro(); }

  limparFiltros() {
    this.tipoFiltro       = 'TODOS';
    this.filtroProduto    = '';
    this.filtroFornecedor = '';
    this.filtroMarca      = '';
    this.aplicarFiltro();
  }

  // ─── Painel de detalhe ───────────────────────────────────────────────────
  abrirDetalhe(idNfe: number) {
    if (this.nfeDetalheId === idNfe) {
      this.nfeDetalheId = null;
      this.nfeDetalhe = null;
      this.cdr.detectChanges();
      return;
    }

    this.nfeDetalheId = idNfe;
    this.nfeDetalhe = null;
    this.carregandoDetalhe = true;
    this.cdr.detectChanges();

    this.http.get<any>(`${environment.apiUrl}/compras/encomendas/${idNfe}/detalhe`).subscribe({
      next: detalhe => {
        this.nfeDetalhe = detalhe;
        this.carregandoDetalhe = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.carregandoDetalhe = false;
        this.cdr.detectChanges();
      },
    });
  }

  fecharDetalhe() {
    this.nfeDetalheId = null;
    this.nfeDetalhe = null;
    this.cdr.detectChanges();
  }

  // ─── KPIs — sobre os dados filtrados ─────────────────────────────────────
  get totalEncomendas(): number {
    return this.dataSource.data.filter(d => d.tipoCompra === 'ENCOMENDA').length;
  }

  get totalEstoque(): number {
    return this.dataSource.data.filter(d => d.tipoCompra === 'ESTOQUE').length;
  }

  get totalSemIdentificacao(): number {
    return this.dataSource.data.filter(
      d => d.tipoCompra === 'SEM_PC' || d.tipoCompra === 'PC_NAO_ENCONTRADO',
    ).length;
  }

  get valorTotalEncomendas(): number {
    return this.dataSource.data
      .filter(d => d.tipoCompra === 'ENCOMENDA')
      .reduce((acc, d) => acc + d.valorNf, 0);
  }

  get atingiuLimite(): boolean {
    return this.todosItens.length >= 150;
  }

  // ─── Helpers de exibição ─────────────────────────────────────────────────
  getProdutoResumido(item: EncomendaItem): string {
    if (!item.pedidoCompra?.produtos?.length) return '—';
    const prods = item.pedidoCompra.produtos;
    const primeiro = prods[0].descricao;
    return prods.length > 1 ? `${primeiro} (+${prods.length - 1})` : primeiro;
  }

  getMarcaResumida(item: EncomendaItem): string {
    if (!item.pedidoCompra?.produtos?.length) return '';
    const marcas = [...new Set(
      item.pedidoCompra.produtos
        .map((p: any) => p.marca ?? '')
        .filter(Boolean)
    )];
    return marcas.length ? marcas[0] : '';
  }

  getCliente(item: EncomendaItem): string {
    return item.encomenda?.cliente ?? '—';
  }

  getEmpresaEncomenda(item: EncomendaItem): string {
    const id = item.encomenda?.idEmpresaEncomenda;
    if (!id) return '—';
    return this.empresas.find(e => e.id === id)?.apelido ?? String(id);
  }

  getPrevisaoEntrega(item: EncomendaItem): string {
    return this.formatDate(item.pedidoCompra?.previsaoEntrega ?? null);
  }

  tipoLabel(tipo: TipoCompra | string): string {
    const map: Record<string, string> = {
      ENCOMENDA:         'Encomenda',
      ESTOQUE:           'Estoque',
      SEM_PC:            'Sem identificação',
      PC_NAO_ENCONTRADO: 'PC não encontrado',
    };
    return map[tipo] ?? tipo;
  }

  tipoClass(tipo: TipoCompra | string): string {
    const map: Record<string, string> = {
      ENCOMENDA:         'badge-success',
      ESTOQUE:           'badge-info',
      SEM_PC:            'badge-secondary',
      PC_NAO_ENCONTRADO: 'badge-warning',
    };
    return map[tipo] ?? '';
  }

  metodoLabel(metodo: string): string {
    const map: Record<string, string> = {
      XPED:             'Item XML',
      INFCPL:           'Obs. NF',
      NAO_IDENTIFICADO: '—',
    };
    return map[metodo] ?? metodo;
  }

  formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('pt-BR');
  }

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  formatDecimal(v: number): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
  }

  formatDateSimples(dateStr: string): string {
    if (!dateStr || dateStr.length < 10) return dateStr;
    const [y, m, d] = dateStr.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }

  get empresasSelecionadasResumo(): string {
    if (!this.empresasSelecionadas?.length) return '';
    const apelidos = this.empresasSelecionadas
      .map(id => this.empresas.find(e => e.id === id)?.apelido ?? String(id));
    if (apelidos.length <= 3) return apelidos.join(', ');
    return `${apelidos.slice(0, 3).join(', ')} +${apelidos.length - 3}`;
  }
}