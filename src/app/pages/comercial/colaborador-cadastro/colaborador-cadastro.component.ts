import { Component, inject, ChangeDetectorRef, afterNextRender } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { environment } from '../../../../environments/environment';

interface Colaborador {
  id?: number;
  nome: string;
  idclifor_erp: number | null;
  id_empresa_erp: number | null;
  cargo: string | null;
  tipo: string;
  prestacao_servico: number;
  data_inicio: string | null;
  ativo: boolean;
}

@Component({
  selector: 'app-colaborador-cadastro',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatIconModule, MatButtonModule,
    MatFormFieldModule, MatSelectModule, MatInputModule, MatTooltipModule,
  ],
  templateUrl: './colaborador-cadastro.component.html',
  styleUrl: './colaborador-cadastro.component.scss',
})
export class ColaboradorCadastroComponent {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private readonly api = `${environment.apiUrl}/comercial/colaborador-cadastro`;

  dataSource = new MatTableDataSource<Colaborador>([]);
  displayedColumns = ['nome', 'tipo', 'cargo', 'loja', 'idclifor_erp', 'ativo', 'acoes'];

  carregando = false;
  filtroTipo = 'TODOS';
  busca = '';

  tipos = [
    { v: 'TODOS', n: 'Todos' },
    { v: 'VENDEDOR', n: 'Vendedores' },
    { v: 'GESTOR', n: 'Gestores' },
    { v: 'ASSISTENTE', n: 'Assistentes' },
  ];

  tiposEdicao = [
    { v: 'VENDEDOR', n: 'Vendedor' },
    { v: 'GESTOR', n: 'Gestor' },
    { v: 'ASSISTENTE', n: 'Assistente' },
  ];

  empresas = [
    { id: 1, nome: 'HCAB' }, { id: 2, nome: 'Show Room' }, { id: 3, nome: 'COM1' },
    { id: 4, nome: 'CDBR' }, { id: 5, nome: 'COJE' }, { id: 6, nome: 'HCAM' },
    { id: 7, nome: 'COM2' }, { id: 8, nome: 'HCVR' }, { id: 9, nome: 'CDAM' },
    { id: 10, nome: 'Atacado' },
  ];

  // Estado do modal de edição/criação
  editando: Colaborador | null = null;
  salvando = false;

  constructor() {
    afterNextRender(() => this.carregar());
  }

  nomeLoja(id: number | string | null): string {
    if (id == null || id === '') return '—';
    const n = Number(id);
    return this.empresas.find(e => e.id === n)?.nome ?? `Empresa ${id}`;
  }

  carregar(): void {
    this.carregando = true;
    const params: any = {};
    if (this.filtroTipo !== 'TODOS') params.tipo = this.filtroTipo;

    this.http.get<Colaborador[]>(this.api, { params }).subscribe({
      next: (rows) => {
        this.dataSource.data = this.aplicarBusca(rows);
        this.todos = rows;
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

  private todos: Colaborador[] = [];

  aplicarBusca(rows: Colaborador[]): Colaborador[] {
    const q = this.busca.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.nome.toLowerCase().includes(q));
  }

  onBusca(): void {
    this.dataSource.data = this.aplicarBusca(this.todos);
    this.cdr.detectChanges();
  }

  novo(): void {
    this.editando = {
      nome: '', idclifor_erp: null, id_empresa_erp: null, cargo: '',
      tipo: 'VENDEDOR', prestacao_servico: 0, data_inicio: null, ativo: true,
    };
  }

  editar(c: Colaborador): void {
    this.editando = { ...c }; // cópia, pra não alterar a lista antes de salvar
  }

  cancelar(): void {
    this.editando = null;
  }

  salvar(): void {
    if (!this.editando) return;
    if (!this.editando.nome?.trim()) { alert('Informe o nome.'); return; }

    this.salvando = true;
    const c = this.editando;
    const req = c.id
      ? this.http.put<Colaborador>(`${this.api}/${c.id}`, c)
      : this.http.post<Colaborador>(this.api, c);

    req.subscribe({
      next: () => {
        this.salvando = false;
        this.editando = null;
        this.carregar();
      },
      error: () => {
        this.salvando = false;
        alert('Erro ao salvar. Tente novamente.');
        this.cdr.detectChanges();
      },
    });
  }

  inativar(c: Colaborador): void {
    if (!c.id) return;
    if (!confirm(`Inativar ${c.nome}?`)) return;
    this.http.delete(`${this.api}/${c.id}`).subscribe({
      next: () => this.carregar(),
      error: () => { alert('Erro ao inativar.'); },
    });
  }
}