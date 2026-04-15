import { Component, afterNextRender, inject, PLATFORM_ID, ChangeDetectorRef } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
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

  form = { nome: '', matricula: '', cargo: '', filial: 'HCAB', setor: '' };
  private cdr = inject(ChangeDetectorRef);
  cargos: string[] = [];
  colaboradores: Colaborador[] = [];
  colaboradoresFiltrados: Colaborador[] = [];
  mostrarSugestoes = false;

  tecnicas: Competencia[] = [];
  comportamentais: Competencia[] = [];
  observacoes = '';
  modoGestor = false;
  cicloAtivo: any = null;

  constructor(private avalSvc: AvaliacaoService) {
    afterNextRender(() => {
      this.carregarCargos();
      this.carregarColaboradores();
      this.carregarCicloAtivo();
    });
  }


  // Atualize carregarCicloAtivo:
carregarCicloAtivo() {
  this.avalSvc.getCicloAtivo().subscribe({
    next: (ciclos: any[]) => {
      this.cicloAtivo = ciclos?.[0] ?? null;
      this.cdr.detectChanges(); // ← força atualização
    }
  });
}

carregarNotas() {
  if (!this.cicloAtivo || !this.form.matricula) return;
  this.avalSvc.getNotas(this.cicloAtivo.id_ciclo, this.form.matricula).subscribe({
    next: (notas: any[]) => {
      notas.forEach(n => {
        const comp = [...this.tecnicas, ...this.comportamentais]
          .find(c => Number(c.id_competencia) === Number(n.id_competencia)); // ← Number() nos dois
        if (comp) {
          if (n.tipo_avaliador === 'AUTO')   comp.notaAuto   = Number(n.nota);
          if (n.tipo_avaliador === 'GESTOR') comp.notaGestor = Number(n.nota);
        }
      });
      this.cdr.detectChanges();
    }
  });
}

// Atualize carregarCargos:
carregarCargos() {
  this.avalSvc.getCargos().subscribe({
    next: (res: any[]) => {
      this.cargos = res.map((r: any) => r.cargo).sort();
      this.cdr.detectChanges(); // ← força atualização
    }
  });
}


  carregarColaboradores() {
    this.avalSvc.getColaboradores().subscribe({
      next: (res: any[]) => { this.colaboradores = res; }
    });
  }

  // Autocomplete colaborador
  onNomeInput() {
    const q = this.form.nome.toLowerCase();
    if (q.length < 2) { this.mostrarSugestoes = false; return; }
    this.colaboradoresFiltrados = this.colaboradores
      .filter(c => c.nome.toLowerCase().includes(q) || c.matricula.includes(q))
      .slice(0, 8);
    this.mostrarSugestoes = this.colaboradoresFiltrados.length > 0;
  }

selecionarColaborador(c: Colaborador) {
  this.form.nome = c.nome;
  this.form.matricula = c.matricula;
  this.form.filial = c.filial;
  this.mostrarSugestoes = false;

  const cargoMatch = this.cargos.find(
    cargo => cargo.trim().toUpperCase() === (c.cargo || '').trim().toUpperCase()
  );
  if (cargoMatch) {
    this.form.cargo = cargoMatch;
    this.cdr.detectChanges();
    this.onCargoChange(); // ← onCargoChange já chama carregarNotas internamente
    // ← REMOVA o this.carregarNotas() daqui
  }
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
      this.carregarNotas(); // ← adicione essa linha
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
    const cp = p >= 4 ? 'MUITO BOM' : p >= 3 ? 'ACEITÁVEL' : 'BAIXO';
    const map: Record<string, Record<string, string>> = {
      'BAIXO':     { 'INSUFICIENTE': 'Insuficiente',    'MEDIANO': 'Eficaz',          'EXCEPCIONAL': 'Comprometido' },
      'ACEITÁVEL': { 'INSUFICIENTE': 'Questionável',    'MEDIANO': 'Mantenedor',       'EXCEPCIONAL': 'Forte desempenho' },
      'MUITO BOM': { 'INSUFICIENTE': 'Enigma',          'MEDIANO': 'Forte potencial',  'EXCEPCIONAL': 'Alto potencial' },
    };
    return map[cp]?.[cd] ?? '-';
  }

  salvar() {
    if (!this.cicloAtivo) { alert('Nenhum ciclo de avaliação ativo.'); return; }
    if (!this.form.matricula || !this.form.cargo) { alert('Preencha o colaborador e o cargo.'); return; }

    const notas = [
      ...this.tecnicas.filter(c => c.notaAuto !== null).map(c => ({ id_competencia: c.id_competencia, nota: c.notaAuto! })),
      ...this.comportamentais.filter(c => c.notaAuto !== null).map(c => ({ id_competencia: c.id_competencia, nota: c.notaAuto! })),
    ];

    this.avalSvc.salvarNotas({
      id_ciclo: this.cicloAtivo.id_ciclo,
      matricula: this.form.matricula,
      nome: this.form.nome,
      cargo: this.form.cargo,
      setor: this.form.setor,
      filial: this.form.filial,
      tipo_avaliador: this.modoGestor ? 'GESTOR' : 'AUTO',
      avaliador: localStorage.getItem('usuario') || this.form.nome,
      notas,
    }).subscribe({
    next: () => {
      // Se modo gestor, calcula 9-Box automaticamente
      if (this.modoGestor) {
        this.avalSvc.calcular9Box(
          this.cicloAtivo.id_ciclo,
          this.form.matricula
        ).subscribe({
          next: (res) => {
            alert(`Avaliação salva! Classificação 9-Box: ${res?.titulo}`);
          }
        });
      } else {
        alert('Avaliação salva com sucesso!');
      }
    },
    error: () => alert('Erro ao salvar avaliação.'),
  });
}

  limpar() {
    this.form = { nome: '', matricula: '', cargo: '', filial: 'HCAB', setor: '' };
    this.tecnicas = [];
    this.comportamentais = [];
    this.observacoes = '';
    this.modoGestor = false;
  }
}