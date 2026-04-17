import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AvaliacaoService } from '../../../services/avaliacao.service';
import { AuthService } from '../../../services/auth.service';
import { PdisStatusPipe } from '../../../shared/pipes/pdis-status.pipe';

interface PdiItem {
  id_pdi: number;
  id_ciclo: number;
  matricula: string;
  nome: string;
  filial: string;
  setor: string;
  cargo: string;
  avaliador: string;
  tipo_competencia: string;
  item: string;
  descricao: string;
  prazo: string;
  qtde_meses: number;
  status: string;
  criado_em: string;
  // flags de edição local
  _editando?: boolean;
  _editItem?: string;
  _editDescricao?: string;
  _editPrazo?: string;
  _editMeses?: number;
  _editTipo?: string;
}

interface Colaborador {
  matricula: string;
  nome: string;
  cargo: string;
  filial: string;
  setor: string;
}

@Component({
  selector: 'app-pdi',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, PdisStatusPipe],
  templateUrl: './pdi.component.html',
  styleUrls: ['./pdi.component.scss'],
})
export class PdiComponent {
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  // Permissões
  temPermissaoGestor = false;
  usuarioLogado = '';

  // Dados
  cicloAtivo: any = null;
  colaboradores: Colaborador[] = [];
  colaboradoresFiltrados: Colaborador[] = [];
  mostrarSugestoes = false;

  // Colaborador selecionado
  buscaNome = '';
  colaboradorSelecionado: Colaborador | null = null;
  pdis: PdiItem[] = [];
  carregando = false;

  // Filtros (visão gestor)
  filialFiltro = '';
  statusFiltro = '';
  todosPdis: PdiItem[] = [];
  todosPdisFiltrados: PdiItem[] = [];
  filiais = ['HCAB','HCAM','HCVR','CDAM','CDAT','BENJAMIN','CONCEPT'];

  // Novo PDI
  mostrarFormNovo = false;
  novoItem = this.itemVazio();

  // Modal de confirmação exclusão
  pdiParaExcluir: PdiItem | null = null;
  mostrarModalExcluir = false;

  readonly statusOpcoes = [
    'Aguardando Início',
    'Em andamento',
    'Concluída',
    'Não concluída',
  ];

  readonly statusConfig: Record<string, { cor: string; icone: string }> = {
    'Aguardando Início': { cor: 'aguardando', icone: 'schedule' },
    'Em andamento':      { cor: 'andamento',  icone: 'autorenew' },
    'Concluída':         { cor: 'concluida',  icone: 'check_circle' },
    'Não concluída':     { cor: 'nao-concluida', icone: 'cancel' },
  };

    constructor(private avalSvc: AvaliacaoService, public auth: AuthService) {
    
      // 1. Lê o state AQUI — antes do afterNextRender
      const nav = this.router.getCurrentNavigation();
      const state = nav?.extras?.state ?? (history.state || {});
      if (state?.matricula) {
        this.autoSelecionarPorState(state);
      }
  
      // 2. afterNextRender vem depois
      afterNextRender(() => {
        this.carregarPermissoes();
        this.carregarColaboradores();
        this.carregarCicloAtivo();
      });
    }
  

  // E adicione este método no componente:
    private autoSelecionarPorState(state: any) {
      const tentativas = (n: number) => {
        if (this.colaboradores.length > 0 && this.cicloAtivo) {
          const c = this.colaboradores.find(x => x.matricula === state.matricula);
          if (c) {
            this.selecionarColaborador(c);
            this.buscaNome = c.nome;
            this.abrirFormNovo(); // Já abre o form de novo PDI
          }
        } else if (n < 10) {
          setTimeout(() => tentativas(n + 1), 300);
        }
      };
      tentativas(0);
    }
  

  private carregarPermissoes() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = Array.isArray(payload.roles)
        ? payload.roles
        : (payload.roles || '').split(',').map((r: string) => r.trim());
      this.temPermissaoGestor = roles.includes('RH_GESTOR') || roles.includes('RH_GESTAO') || roles.includes('ADMIN');
      this.usuarioLogado = payload.username || '';
      this.cdr.detectChanges();
    } catch { }
  }

  carregarCicloAtivo() {
    this.avalSvc.getCicloAtivo().subscribe({
      next: (ciclos: any[]) => {
        this.cicloAtivo = ciclos?.[0] ?? null;
        this.cdr.detectChanges();
        if (!this.cicloAtivo) return;

        if (this.temPermissaoGestor) {
          this.carregarTodosPdis();
        } else {
          // Aguarda colaboradores carregarem antes de buscar
          this.tentarCarregarColaboradorLogado(0);
        }
      }
    });
  }

  // Tenta até 5x com delay — aguarda colaboradores chegarem
  private tentarCarregarColaboradorLogado(tentativa: number) {
    if (this.colaboradores.length > 0) {
      this.carregarPdiDoColaboradorLogado();
    } else if (tentativa < 5) {
      setTimeout(() => this.tentarCarregarColaboradorLogado(tentativa + 1), 300);
    }
  }

    private carregarPdiDoColaboradorLogado() {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Se tem matrícula no JWT, usa direto
        if (payload.matricula) {
          const c = this.colaboradores.find(x => x.matricula == payload.matricula);
          if (c) { this.colaboradorSelecionado = c; this.carregarPdiPorMatricula(c.matricula); }
          return;
        }

        // Fallback: busca pelo username (já existente)
        const termos = (payload.username || '').toLowerCase()
          .replace(/[._-]/g, ' ').split(' ').filter((t: string) => t.length > 1);
        const c = this.colaboradores.find(col =>
          termos.every((t: string) => col.nome.toLowerCase().includes(t))
        );
        if (c) { this.colaboradorSelecionado = c; this.carregarPdiPorMatricula(c.matricula); }
      } catch { }
      this.cdr.detectChanges();
    }

  carregarColaboradores() {
    this.avalSvc.getColaboradores().subscribe({
      next: (res: any[]) => { this.colaboradores = res; this.cdr.detectChanges(); }
    });
  }

  onBuscaInput() {
    const q = this.buscaNome.toLowerCase();
    if (q.length < 2) { this.mostrarSugestoes = false; return; }
    this.colaboradoresFiltrados = this.colaboradores
      .filter(c => c.nome.toLowerCase().includes(q) || c.matricula.includes(q))
      .slice(0, 8);
    this.mostrarSugestoes = this.colaboradoresFiltrados.length > 0;
  }

  selecionarColaborador(c: Colaborador) {
    this.colaboradorSelecionado = c;
    this.buscaNome = c.nome;
    this.mostrarSugestoes = false;
    this.novoItem = this.itemVazio();
    this.mostrarFormNovo = false;
    this.carregarPdiPorMatricula(c.matricula);
    this.cdr.detectChanges();
  }

  carregarPdiPorMatricula(matricula: string) {
    if (!this.cicloAtivo) return;
    this.carregando = true;
    this.avalSvc.getPdi(this.cicloAtivo.id_ciclo, matricula).subscribe({
      next: (res: any[]) => { this.pdis = res; this.carregando = false; this.cdr.detectChanges(); },
      error: () => { this.carregando = false; this.cdr.detectChanges(); }
    });
  }

  carregarTodosPdis() {
    if (!this.cicloAtivo) return;
    this.avalSvc.getTodosPdis(this.cicloAtivo.id_ciclo).subscribe({
      next: (res: any[]) => {
        this.todosPdis = res;
        this.aplicarFiltroGestor();
        this.cdr.detectChanges();
      }
    });
  }

  aplicarFiltroGestor() {
    this.todosPdisFiltrados = this.todosPdis.filter(p =>
      (!this.filialFiltro || p.filial === this.filialFiltro) &&
      (!this.statusFiltro || p.status === this.statusFiltro)
    );
  }

  get colaboradoresComPdi(): { nome: string; matricula: string; filial: string; cargo: string; pdis: PdiItem[] }[] {
    const map = new Map<string, { nome: string; matricula: string; filial: string; cargo: string; pdis: PdiItem[] }>();
    this.todosPdisFiltrados.forEach(p => {
      if (!map.has(p.matricula)) {
        map.set(p.matricula, { nome: p.nome, matricula: p.matricula, filial: p.filial, cargo: p.cargo, pdis: [] });
      }
      map.get(p.matricula)!.pdis.push(p);
    });
    return Array.from(map.values()).sort((a, b) => a.nome.localeCompare(b.nome));
  }

  get progressoColaborador(): (pdis: PdiItem[]) => number {
    return (pdis) => {
      if (!pdis.length) return 0;
      return Math.round(pdis.filter(p => p.status === 'Concluída').length / pdis.length * 100);
    };
  }

  get totalPdis(): number {
  return this.todosPdis.length;
}
 
get totalPorStatus(): Record<string, number> {
  return {
    'Aguardando Início': this.todosPdis.filter(p => p.status === 'Aguardando Início').length,
    'Em andamento':      this.todosPdis.filter(p => p.status === 'Em andamento').length,
    'Concluída':         this.todosPdis.filter(p => p.status === 'Concluída').length,
    'Não concluída':     this.todosPdis.filter(p => p.status === 'Não concluída').length,
  };
}
 
get totalVencidos(): number {
  return this.todosPdis.filter(p =>
    p.status !== 'Concluída' && !!p.prazo && new Date(p.prazo) < new Date()
  ).length;
}
 
get totalVencendoEmBreve(): number {
  return this.todosPdis.filter(p => {
    if (p.status === 'Concluída' || !p.prazo) return false;
    const diff = (new Date(p.prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }).length;
}
 
get progressoGeral(): number {
  if (!this.todosPdis.length) return 0;
  return Math.round(
    this.todosPdis.filter(p => p.status === 'Concluída').length / this.todosPdis.length * 100
  );
}
 
get totalColaboradoresComPdi(): number {
  return new Set(this.todosPdis.map(p => p.matricula)).size;
}
 

  abrirFormNovo() {
    this.novoItem = this.itemVazio();
    this.mostrarFormNovo = true;
  }

  fecharFormNovo() { this.mostrarFormNovo = false; }

  salvarNovoPdi() {
    if (!this.colaboradorSelecionado || !this.cicloAtivo) return;
    if (!this.novoItem.item.trim()) { alert('Informe o item de desenvolvimento.'); return; }
    if (!this.novoItem.prazo) { alert('Informe o prazo.'); return; }

    const c = this.colaboradorSelecionado;
    this.avalSvc.salvarPdi({
      id_ciclo: this.cicloAtivo.id_ciclo, matricula: c.matricula,
      nome: c.nome, filial: c.filial, setor: c.setor, cargo: c.cargo,
      avaliador: this.usuarioLogado,
      tipo_competencia: this.novoItem.tipo_competencia,
      item: this.novoItem.item, descricao: this.novoItem.descricao,
      prazo: this.novoItem.prazo, qtde_meses: this.novoItem.qtde_meses,
    }).subscribe({
      next: () => {
        this.mostrarFormNovo = false;
        this.carregarPdiPorMatricula(c.matricula);
        if (this.temPermissaoGestor) this.carregarTodosPdis();
      },
      error: () => alert('Erro ao salvar PDI.')
    });
  }

  // ── EDIÇÃO inline ──
  abrirEdicao(pdi: PdiItem) {
    // Fecha edição de outros
    this.pdis.forEach(p => p._editando = false);
    pdi._editando = true;
    pdi._editItem     = pdi.item;
    pdi._editDescricao = pdi.descricao;
    pdi._editPrazo    = pdi.prazo?.split('T')[0] ?? '';
    pdi._editMeses    = pdi.qtde_meses;
    pdi._editTipo     = pdi.tipo_competencia;
    this.cdr.detectChanges();
  }

  cancelarEdicao(pdi: PdiItem) {
    pdi._editando = false;
    this.cdr.detectChanges();
  }

  salvarEdicao(pdi: PdiItem) {
    if (!pdi._editItem?.trim()) { alert('Item não pode ser vazio.'); return; }
    this.avalSvc.editarPdi(pdi.id_pdi, {
      tipo_competencia: pdi._editTipo!,
      item:      pdi._editItem!,
      descricao: pdi._editDescricao!,
      prazo:     pdi._editPrazo!,
      qtde_meses: pdi._editMeses!,
    }).subscribe({
      next: () => {
        pdi.tipo_competencia = pdi._editTipo!;
        pdi.item      = pdi._editItem!;
        pdi.descricao = pdi._editDescricao!;
        pdi.prazo     = pdi._editPrazo!;
        pdi.qtde_meses = pdi._editMeses!;
        pdi._editando = false;
        this.cdr.detectChanges();
      },
      error: () => alert('Erro ao editar PDI.')
    });
  }

  // ── EXCLUSÃO ──
  confirmarExclusao(pdi: PdiItem) {
    this.pdiParaExcluir = pdi;
    this.mostrarModalExcluir = true;
  }

  cancelarExclusao() {
    this.pdiParaExcluir = null;
    this.mostrarModalExcluir = false;
  }

  executarExclusao() {
    if (!this.pdiParaExcluir) return;
    const id = this.pdiParaExcluir.id_pdi;
    this.avalSvc.deletarPdi(id).subscribe({
      next: () => {
        this.pdis = this.pdis.filter(p => p.id_pdi !== id);
        if (this.temPermissaoGestor) this.carregarTodosPdis();
        this.cancelarExclusao();
        this.cdr.detectChanges();
      },
      error: () => { alert('Erro ao excluir PDI.'); this.cancelarExclusao(); }
    });
  }

  // ── STATUS ──
  alterarStatus(pdi: PdiItem, status: string) {
    this.avalSvc.atualizarStatusPdi(pdi.id_pdi, status).subscribe({
      next: () => {
        pdi.status = status;
        if (this.temPermissaoGestor) this.carregarTodosPdis();
        this.cdr.detectChanges();
      }
    });
  }

  prazoVencido(prazo: string): boolean {
    return !!prazo && new Date(prazo) < new Date();
  }

  prazoProximo(prazo: string): boolean {
    if (!prazo) return false;
    const diff = (new Date(prazo).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 30;
  }

  private itemVazio() {
    return { tipo_competencia: 'Comportamental', item: '', descricao: '', prazo: '', qtde_meses: 3 };
  }
}