import { Component, afterNextRender, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { Router } from '@angular/router';
import { AvaliacaoService } from '../../../services/avaliacao.service';

interface Competencia {
  id_competencia: number;
  tipo: string;
  descricao: string;
  notaAuto: number | null;
  notaGestor: number | null;
}

interface Colaborador {
  matricula: string;
  nome: string;
  cargo: string;
  filial: string;
  setor: string;
}

@Component({
  selector: 'app-formulario-avaliacao',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './formulario-avaliacao.component.html',
  styleUrls: ['./formulario-avaliacao.component.scss'],
})
export class FormularioAvaliacaoComponent {
  private platformId = inject(PLATFORM_ID);
  private cdr = inject(ChangeDetectorRef);
  private router = inject(Router);

  form = { nome: '', matricula: '', cargo: '', filial: '', setor: '' };

  cargos: string[] = [];
  colaboradores: Colaborador[] = [];
  colaboradoresFiltrados: Colaborador[] = [];
  mostrarSugestoes = false;

  tecnicas: Competencia[] = [];
  comportamentais: Competencia[] = [];
  observacoes = '';
  modoGestor = false;
  cicloAtivo: any = null;

  temPermissaoGestor = false;
  carregandoProprio = false; // spinner enquanto carrega o colaborador logado

  avaliacaoSalva = false;
  autoConfirmada = false;
  gestorConfirmado = false;
  autoConfirmadaEm: string | null = null;
  autoConfirmadaPor: string | null = null;
  gestorConfirmadoEm: string | null = null;
  gestorConfirmadoPor: string | null = null;
  mostrarModalConfirmacao = false;

  get avaliacaoConfirmada(): boolean {
    return this.modoGestor ? this.gestorConfirmado : this.autoConfirmada;
  }
  get confirmadoEm(): string | null {
    return this.modoGestor ? this.gestorConfirmadoEm : this.autoConfirmadaEm;
  }
  get confirmadoPor(): string | null {
    return this.modoGestor ? this.gestorConfirmadoPor : this.autoConfirmadaPor;
  }
  get mostrarBotaoPdi(): boolean {
    return this.temPermissaoGestor && !!this.form.matricula && this.avaliacaoSalva;
  }

  constructor(private avalSvc: AvaliacaoService) {
    afterNextRender(() => {
      this.verificarPermissaoGestor();
      this.carregarCargos();
      this.carregarColaboradores();
      this.carregarCicloAtivo();
    });
  }

  private verificarPermissaoGestor() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = Array.isArray(payload.roles)
        ? payload.roles
        : (payload.roles || '').split(',').map((r: string) => r.trim());
      this.temPermissaoGestor = roles.includes('RH_GESTOR') || roles.includes('ADMIN');
      this.cdr.detectChanges();
    } catch {
      this.temPermissaoGestor = false;
    }
  }

  carregarCicloAtivo() {
    this.avalSvc.getCicloAtivo().subscribe({
      next: (ciclos: any[]) => {
        this.cicloAtivo = ciclos?.[0] ?? null;
        this.cdr.detectChanges();
        // Colaborador comum: carrega próprio automaticamente após ciclo pronto
        if (!this.temPermissaoGestor) {
          this.tentarCarregarProprio(0);
        }
      }
    });
  }

  // Tenta até 10x com 300ms — aguarda colaboradores e ciclo carregarem
  private tentarCarregarProprio(tentativa: number) {
    if (this.colaboradores.length > 0 && this.cicloAtivo) {
      this.carregarColaboradorLogado();
    } else if (tentativa < 10) {
      setTimeout(() => this.tentarCarregarProprio(tentativa + 1), 300);
    }
  }

  private carregarColaboradorLogado() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));

      this.carregandoProprio = true;
      this.cdr.detectChanges();

      // Prioridade 1: matrícula no JWT (após atualização do auth.service)
      if (payload.matricula) {
        const c = this.colaboradores.find(x => String(x.matricula) === String(payload.matricula));
        if (c) { this.preencherColaborador(c); return; }
      }

      // Prioridade 2: busca pelo username — "jose.alfaia" → ["jose","alfaia"]
      const termos = (payload.username || '')
        .toLowerCase().replace(/[._-]/g, ' ')
        .split(' ').filter((t: string) => t.length > 1);

      const c = this.colaboradores.find(col =>
        termos.every((t: string) => col.nome.toLowerCase().includes(t))
      );

      if (c) {
        this.preencherColaborador(c);
      } else {
        this.carregandoProprio = false;
        this.cdr.detectChanges();
      }
    } catch {
      this.carregandoProprio = false;
      this.cdr.detectChanges();
    }
  }

  private preencherColaborador(c: Colaborador) {
    this.form.nome      = c.nome;
    this.form.matricula = c.matricula;
    this.form.filial    = c.filial;
    this.form.setor     = c.setor || '';
    this.form.cargo     = '';
    this.carregandoProprio = false;
    this.cdr.detectChanges();

    // Verifica confirmação e carrega competências
    this.avalSvc.getConfirmacao(this.cicloAtivo.id_ciclo, c.matricula).subscribe({
      next: (res: any) => {
        if (res?.confirmado_colaborador_em) {
          this.autoConfirmada = true;
          this.autoConfirmadaEm  = res.confirmado_colaborador_em;
          this.autoConfirmadaPor = res.confirmado_colaborador_por;
        }
        if (res?.confirmado_gestor_em) {
          this.gestorConfirmado = true;
          this.gestorConfirmadoEm  = res.confirmado_gestor_em;
          this.gestorConfirmadoPor = res.confirmado_gestor_por;
        }
        if (this.autoConfirmada || this.gestorConfirmado) this.avaliacaoSalva = true;
        this.cdr.detectChanges();
        this.carregarCargoPeloColaborador(c);
      },
      error: () => this.carregarCargoPeloColaborador(c)
    });
  }

  carregarCargos() {
    this.avalSvc.getCargos().subscribe({
      next: (res: any[]) => {
        this.cargos = res.map((r: any) => r.cargo).sort();
        this.cdr.detectChanges();
      }
    });
  }

  carregarColaboradores() {
    this.avalSvc.getColaboradores().subscribe({
      next: (res: any[]) => { this.colaboradores = res; this.cdr.detectChanges(); }
    });
  }

  // Autocomplete — só usado pelo gestor
  onNomeInput() {
    const q = this.form.nome.toLowerCase();
    if (q.length < 2) { this.mostrarSugestoes = false; return; }
    this.colaboradoresFiltrados = this.colaboradores
      .filter(c => c.nome.toLowerCase().includes(q) || c.matricula.includes(q))
      .slice(0, 8);
    this.mostrarSugestoes = this.colaboradoresFiltrados.length > 0;
  }

  selecionarColaborador(c: Colaborador) {
    this.form.nome      = c.nome;
    this.form.matricula = c.matricula;
    this.form.filial    = c.filial;
    this.form.setor     = c.setor || '';
    this.form.cargo     = '';
    this.tecnicas = [];
    this.comportamentais = [];
    this.mostrarSugestoes = false;
    this.avaliacaoSalva = false;
    this.autoConfirmada = false; this.gestorConfirmado = false;
    this.autoConfirmadaEm = null; this.autoConfirmadaPor = null;
    this.gestorConfirmadoEm = null; this.gestorConfirmadoPor = null;
    if (!this.temPermissaoGestor) this.modoGestor = false;
    this.cdr.detectChanges();

    if (this.cicloAtivo) {
      this.avalSvc.getConfirmacao(this.cicloAtivo.id_ciclo, c.matricula).subscribe({
        next: (res: any) => {
          if (res?.confirmado_colaborador_em) {
            this.autoConfirmada = true;
            this.autoConfirmadaEm  = res.confirmado_colaborador_em;
            this.autoConfirmadaPor = res.confirmado_colaborador_por;
          }
          if (res?.confirmado_gestor_em) {
            this.gestorConfirmado = true;
            this.gestorConfirmadoEm  = res.confirmado_gestor_em;
            this.gestorConfirmadoPor = res.confirmado_gestor_por;
          }
          if (this.autoConfirmada || this.gestorConfirmado) this.avaliacaoSalva = true;
          this.cdr.detectChanges();
          this.carregarCargoPeloColaborador(c);
        },
        error: () => this.carregarCargoPeloColaborador(c)
      });
    } else {
      this.carregarCargoPeloColaborador(c);
    }
  }

  private carregarCargoPeloColaborador(c: Colaborador) {
    if (!c.cargo) return;
    this.form.cargo = c.cargo;
    this.cdr.detectChanges();
    this.avalSvc.getCompetencias(c.cargo).subscribe({
      next: (comps: any[]) => {
        this.tecnicas = comps
          .filter((x: any) => x.tipo === 'TECNICA')
          .map((x: any) => ({ ...x, notaAuto: null, notaGestor: null }));
        this.comportamentais = comps
          .filter((x: any) => x.tipo === 'COMPORTAMENTAL')
          .map((x: any) => ({ ...x, notaAuto: null, notaGestor: null }));
        this.cdr.detectChanges();
        this.carregarNotas();
      }
    });
  }

  onCargoChange() {
    if (!this.form.cargo) return;
    this.avalSvc.getCompetencias(this.form.cargo).subscribe({
      next: (comps: any[]) => {
        this.tecnicas = comps
          .filter((c: any) => c.tipo === 'TECNICA')
          .map((c: any) => ({ ...c, notaAuto: null, notaGestor: null }));
        this.comportamentais = comps
          .filter((c: any) => c.tipo === 'COMPORTAMENTAL')
          .map((c: any) => ({ ...c, notaAuto: null, notaGestor: null }));
        this.cdr.detectChanges();
        this.carregarNotas();
      }
    });
  }

  carregarNotas() {
    if (!this.cicloAtivo || !this.form.matricula) return;
    this.avalSvc.getNotas(this.cicloAtivo.id_ciclo, this.form.matricula).subscribe({
      next: (notas: any[]) => {
        notas.forEach(n => {
          const comp = [...this.tecnicas, ...this.comportamentais]
            .find(c => Number(c.id_competencia) === Number(n.id_competencia));
          if (comp) {
            if (n.tipo_avaliador === 'AUTO')   comp.notaAuto   = Number(n.nota);
            if (n.tipo_avaliador === 'GESTOR') comp.notaGestor = Number(n.nota);
          }
        });
        this.cdr.detectChanges();
      }
    });
  }

  mediaAuto(lista: Competencia[]): string {
    const notas = lista.filter(c => c.notaAuto !== null).map(c => c.notaAuto!);
    if (!notas.length) return '-';
    return (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1);
  }

  mediaGestor(lista: Competencia[]): string {
    const notas = lista.filter(c => c.notaGestor !== null).map(c => c.notaGestor!);
    if (!notas.length) return '-';
    return (notas.reduce((a, b) => a + b, 0) / notas.length).toFixed(1);
  }

  classificacao9Box(): string {
    const d = parseFloat(this.mediaGestor(this.tecnicas));
    const p = parseFloat(this.mediaGestor(this.comportamentais));
    if (isNaN(d) || isNaN(p)) return '-';
    const cd = d >= 4 ? 'EXCEPCIONAL' : d >= 3 ? 'MEDIANO' : 'INSUFICIENTE';
    const cp = p >= 4 ? 'MUITO BOM'   : p >= 3 ? 'ACEITÁVEL' : 'BAIXO';
    const map: Record<string, Record<string, string>> = {
      'BAIXO':     { 'INSUFICIENTE': 'Insuficiente',   'MEDIANO': 'Eficaz',         'EXCEPCIONAL': 'Comprometido' },
      'ACEITÁVEL': { 'INSUFICIENTE': 'Questionável',   'MEDIANO': 'Mantenedor',     'EXCEPCIONAL': 'Forte desempenho' },
      'MUITO BOM': { 'INSUFICIENTE': 'Enigma',         'MEDIANO': 'Forte potencial','EXCEPCIONAL': 'Alto potencial' },
    };
    return map[cp]?.[cd] ?? '-';
  }

  salvar() {
    if (this.avaliacaoConfirmada) return;
    if (this.modoGestor && !this.temPermissaoGestor) { alert('Sem permissão.'); return; }
    if (!this.cicloAtivo) { alert('Nenhum ciclo ativo.'); return; }
    if (!this.form.matricula || !this.form.cargo) { alert('Preencha o colaborador.'); return; }

    const notas = [
      ...this.tecnicas.filter(c => c.notaAuto !== null).map(c => ({ id_competencia: c.id_competencia, nota: c.notaAuto! })),
      ...this.comportamentais.filter(c => c.notaAuto !== null).map(c => ({ id_competencia: c.id_competencia, nota: c.notaAuto! })),
    ];

    this.avalSvc.salvarNotas({
      id_ciclo: this.cicloAtivo.id_ciclo, matricula: this.form.matricula,
      nome: this.form.nome, cargo: this.form.cargo, setor: this.form.setor,
      filial: this.form.filial, tipo_avaliador: this.modoGestor ? 'GESTOR' : 'AUTO',
      avaliador: localStorage.getItem('usuario') || this.form.nome, notas,
    }).subscribe({
      next: () => {
        this.avaliacaoSalva = true;
        if (this.modoGestor) {
          this.avalSvc.calcular9Box(this.cicloAtivo.id_ciclo, this.form.matricula).subscribe({
            next: (res) => { alert(`Avaliação salva! 9-Box: ${res?.titulo}`); this.cdr.detectChanges(); }
          });
        } else {
          alert('Avaliação salva! Agora você pode confirmar e assinar.');
          this.cdr.detectChanges();
        }
      },
      error: () => alert('Erro ao salvar avaliação.'),
    });
  }

  abrirModalConfirmacao() {
    if (this.avaliacaoConfirmada) return;
    if (this.modoGestor && !this.temPermissaoGestor) return;
    this.mostrarModalConfirmacao = true;
  }

  fecharModalConfirmacao() { this.mostrarModalConfirmacao = false; }

  confirmarAssinatura() {
    const tipo    = this.modoGestor ? 'GESTOR' : 'AUTO';
    const usuario = localStorage.getItem('usuario') || this.form.nome;
    this.avalSvc.confirmarAvaliacao(this.cicloAtivo.id_ciclo, this.form.matricula, tipo, usuario).subscribe({
      next: (res: any) => {
        const em = res?.confirmado_em || new Date().toISOString();
        if (this.modoGestor) {
          this.gestorConfirmado = true; this.gestorConfirmadoEm = em; this.gestorConfirmadoPor = usuario;
        } else {
          this.autoConfirmada = true; this.autoConfirmadaEm = em; this.autoConfirmadaPor = usuario;
        }
        this.mostrarModalConfirmacao = false;
        this.cdr.detectChanges();
      },
      error: () => { alert('Erro ao confirmar.'); this.mostrarModalConfirmacao = false; }
    });
  }

  irParaPdi() {
    this.router.navigate(['/menu/rh/pdi'], {
      state: { matricula: this.form.matricula, nome: this.form.nome, cargo: this.form.cargo, filial: this.form.filial, setor: this.form.setor }
    });
  }

  limpar() {
    // Colaborador comum não pode limpar — recarga o próprio
    if (!this.temPermissaoGestor) {
      this.tentarCarregarProprio(0);
      return;
    }
    this.form = { nome: '', matricula: '', cargo: '', filial: '', setor: '' };
    this.tecnicas = []; this.comportamentais = [];
    this.observacoes = ''; this.modoGestor = false;
    this.avaliacaoSalva = false;
    this.autoConfirmada = false; this.gestorConfirmado = false;
    this.autoConfirmadaEm = null; this.autoConfirmadaPor = null;
    this.gestorConfirmadoEm = null; this.gestorConfirmadoPor = null;
    this.mostrarModalConfirmacao = false;
  }
}