// src/app/pages/rh/gestao-rh/gestao-rh.component.ts
import { Component, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ChangeDetectorRef } from '@angular/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';
import { environment } from '../../../../environments/environment';

@Component({
  standalone: true,
  selector: 'app-gestao-rh',
  templateUrl: './gestao-rh.component.html',
  styleUrls: ['./gestao-rh.component.scss'],
  imports: [CommonModule, FormsModule, MatIconModule, MatSnackBarModule],
})
export class GestaoRhComponent {
  private api = environment.apiUrl;
  private cdr = inject(ChangeDetectorRef);

  abaAtiva: 'colaboradores' | 'cargos' | 'competencias' | 'ciclos' | 'setores' = 'colaboradores';

  // Listas
  colaboradores: any[] = [];
  colaboradoresFiltrados: any[] = [];
  cargos: any[] = [];
  competencias: any[] = [];
  ciclos: any[] = [];
  setores: any[] = [];
  empresas: any[] = [];

  // Filtros
  buscaColaborador = '';
  filtroEmpresa = '';

  // Modais
  modalColaborador = false;
  modalCargo = false;
  modalCompetencia = false;
  modalCiclo = false;
  modalSetor = false;

  // Forms
  formColaborador: any = {};
  formCargo: any = {};
  formCompetencia: any = { tipo: 'TECNICA', peso: 1 };
  formCiclo: any = { ativo: false };
  formSetor: any = {};
  cargoSelecionadoComp: any = null;
  editandoId: number | null = null;

  constructor(private http: HttpClient, private snack: MatSnackBar) {
    afterNextRender(() => {
      this.loadEmpresas();
      this.loadColaboradores();
      this.loadCargos();
      this.loadSetores();
      this.loadCiclos();
    });
  }

  loadEmpresas() {
    this.http.get<any[]>(`${this.api}/rh/gestao/empresas`).subscribe({
      next: d => { this.empresas = d; this.cdr.detectChanges(); }
    });
  }

  loadColaboradores() {
    const params = this.filtroEmpresa ? `?id_empresa=${this.filtroEmpresa}` : '';
    this.http.get<any[]>(`${this.api}/rh/gestao/colaboradores${params}`).subscribe({
      next: d => { this.colaboradores = d; this.filtrarColaboradores(); this.cdr.detectChanges(); }
    });
  }

  loadCargos() {
    this.http.get<any[]>(`${this.api}/rh/gestao/cargos`).subscribe({
      next: d => { this.cargos = d; this.cdr.detectChanges(); }
    });
  }

  loadSetores() {
    this.http.get<any[]>(`${this.api}/rh/gestao/setores`).subscribe({
      next: d => { this.setores = d; this.cdr.detectChanges(); }
    });
  }

  loadCiclos() {
    this.http.get<any[]>(`${this.api}/rh/gestao/ciclos`).subscribe({
      next: d => { this.ciclos = d; this.cdr.detectChanges(); }
    });
  }

  loadCompetencias(id_cargo: number) {
    this.http.get<any[]>(`${this.api}/rh/gestao/competencias/${id_cargo}`).subscribe({
      next: d => { this.competencias = d; this.cdr.detectChanges(); }
    });
  }

  filtrarColaboradores() {
    const q = this.buscaColaborador.toLowerCase();
    this.colaboradoresFiltrados = this.colaboradores.filter(c =>
      c.nome.toLowerCase().includes(q) || (c.cargo || '').toLowerCase().includes(q)
    );
  }

  trocarAba(aba: any) {
    this.abaAtiva = aba;
    if (aba === 'colaboradores') this.loadColaboradores();
    if (aba === 'cargos') this.loadCargos();
    if (aba === 'ciclos') this.loadCiclos();
    if (aba === 'setores') this.loadSetores();
  }

  // === COLABORADORES ===
  abrirNovoColaborador() {
    this.editandoId = null;
    this.formColaborador = { ativo: true, tipo: 1 };
    this.modalColaborador = true;
  }

  editarColaborador(c: any) {
    this.editandoId = c.id;
    this.formColaborador = { ...c };
    this.modalColaborador = true;
  }

  salvarColaborador() {
    // Preenche campo texto empresa a partir do id
    const emp = this.empresas.find(e => e.id == this.formColaborador.id_empresa);
    if (emp) this.formColaborador.empresa = emp.codigo;
    const cargo = this.cargos.find(c => c.id == this.formColaborador.id_cargo);
    if (cargo) this.formColaborador.cargo = cargo.nome_cargo;

    const req = this.editandoId
      ? this.http.put(`${this.api}/rh/gestao/colaboradores/${this.editandoId}`, this.formColaborador)
      : this.http.post(`${this.api}/rh/gestao/colaboradores`, this.formColaborador);

    req.subscribe({
      next: () => {
        this.snack.open('Colaborador salvo!', 'OK', { duration: 2000 });
        this.modalColaborador = false;
        this.loadColaboradores();
      },
      error: () => this.snack.open('Erro ao salvar', 'OK', { duration: 3000 })
    });
  }

  // === CARGOS ===
  abrirNovoCargo() {
    this.editandoId = null;
    this.formCargo = { ativo: true };
    this.modalCargo = true;
  }

  editarCargo(c: any) {
    this.editandoId = c.id;
    this.formCargo = { ...c };
    this.modalCargo = true;
  }

  salvarCargo() {
    const req = this.editandoId
      ? this.http.put(`${this.api}/rh/gestao/cargos/${this.editandoId}`, this.formCargo)
      : this.http.post(`${this.api}/rh/gestao/cargos`, this.formCargo);

    req.subscribe({
      next: () => {
        this.snack.open('Cargo salvo!', 'OK', { duration: 2000 });
        this.modalCargo = false;
        this.loadCargos();
      },
      error: () => this.snack.open('Erro ao salvar', 'OK', { duration: 3000 })
    });
  }

  selecionarCargoComp(cargo: any) {
    this.cargoSelecionadoComp = cargo;
    this.loadCompetencias(cargo.id);
  }

  // === COMPETÊNCIAS ===
  abrirNovaCompetencia() {
    this.editandoId = null;
    this.formCompetencia = { tipo: 'TECNICA', peso: 1, ativo: true, id_cargo: this.cargoSelecionadoComp?.id };
    this.modalCompetencia = true;
  }

  editarCompetencia(c: any) {
    this.editandoId = c.id;
    this.formCompetencia = { ...c };
    this.modalCompetencia = true;
  }

  salvarCompetencia() {
    const req = this.editandoId
      ? this.http.put(`${this.api}/rh/gestao/competencias/${this.editandoId}`, this.formCompetencia)
      : this.http.post(`${this.api}/rh/gestao/competencias`, this.formCompetencia);

    req.subscribe({
      next: () => {
        this.snack.open('Competência salva!', 'OK', { duration: 2000 });
        this.modalCompetencia = false;
        this.loadCompetencias(this.cargoSelecionadoComp.id);
      },
      error: () => this.snack.open('Erro ao salvar', 'OK', { duration: 3000 })
    });
  }

  // === CICLOS ===
  abrirNovoCiclo() {
    this.editandoId = null;
    this.formCiclo = { ativo: false, ano: new Date().getFullYear() };
    this.modalCiclo = true;
  }

  editarCiclo(c: any) {
  this.editandoId = c.id_ciclo; // ← era c.id
  this.formCiclo = { ...c };
  this.modalCiclo = true;
}

  salvarCiclo() {
    const req = this.editandoId
      ? this.http.put(`${this.api}/rh/gestao/ciclos/${this.editandoId}`, this.formCiclo)
      : this.http.post(`${this.api}/rh/gestao/ciclos`, this.formCiclo);

    req.subscribe({
      next: () => {
        this.snack.open('Ciclo salvo!', 'OK', { duration: 2000 });
        this.modalCiclo = false;
        this.loadCiclos();
      },
      error: () => this.snack.open('Erro ao salvar', 'OK', { duration: 3000 })
    });
  }

  // === SETORES ===
  abrirNovoSetor() {
    this.editandoId = null;
    this.formSetor = { ativo: true };
    this.modalSetor = true;
  }

  editarSetor(s: any) {
    this.editandoId = s.id;
    this.formSetor = { ...s };
    this.modalSetor = true;
  }

  salvarSetor() {
    const req = this.editandoId
      ? this.http.put(`${this.api}/rh/gestao/setores/${this.editandoId}`, this.formSetor)
      : this.http.post(`${this.api}/rh/gestao/setores`, this.formSetor);

    req.subscribe({
      next: () => {
        this.snack.open('Setor salvo!', 'OK', { duration: 2000 });
        this.modalSetor = false;
        this.loadSetores();
      },
      error: () => this.snack.open('Erro ao salvar', 'OK', { duration: 3000 })
    });
  }

  getNomeEmpresa(id: number) {
    return this.empresas.find(e => e.id === id)?.nome ?? '-';
  }

  getNomeCargo(id: number) {
    return this.cargos.find(c => c.id === id)?.nome_cargo ?? '-';
  }

  getNomeSetor(id: number) {
    return this.setores.find(s => s.id === id)?.nome ?? '-';
  }
}