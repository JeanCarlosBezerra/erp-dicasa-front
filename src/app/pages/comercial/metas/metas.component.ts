// src/app/pages/comercial/metas/metas.component.ts
import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import { environment } from '../../../../environments/environment';
import {
  ComercialSetoresService, Departamento, FeriadoCiss, MetaSetorApi, MetaVendedorApi, SugestaoSetor,
  SugestaoVendedoresResp, VendedorCadastro, VendedorForaCadastro,
} from '../../../services/comercial-setores.service';
import {
  ExcecaoDiaVenda, contarDiasVenda, ehDiaDeVenda, excecaoDoDia, isoLocal,
} from '../../../services/dias-venda.util';

interface MetaRow {
  id?: number;
  id_empresa: number;
  apelido: string;
  mes: number;
  ano: number;
  meta_fat: number;
  meta_margem: number; // fração 0.30 = 30%
  // edição local
  _editFat?: string;
  _editMargem?: string;
  _salvando?: boolean;
  _salvo?: boolean;
  meta_ticket_medio: number;
  _editTicket?: string;
}

/** Meta de um setor (departamento do vendedor) dentro de uma loja. */
interface SetorRow {
  id?: number;
  id_departamento: number;
  departamento: string;
  meta_fat: number;
  participacao?: number;   // fração da loja nos 3 meses anteriores (quando sugerido)
  _editFat?: string;
  _editPerc?: string;
  _alterado?: boolean;
  _salvando?: boolean;
  _salvo?: boolean;
}

/** Meta de um vendedor dentro de uma loja (só as vendas dele naquela loja contam). */
interface VendedorRow {
  id?: number;
  id_vendedor: number;
  nome: string;
  id_departamento: number | null;   // setor atual no CISS (-1 = sem departamento, null = ainda não consultado)
  departamento: string;
  meta_fat: number;
  participacao?: number;   // fração da loja nos 3 meses anteriores (quando sugerido)
  _editFat?: string;
  _editPerc?: string;
  _alterado?: boolean;
  _salvando?: boolean;
  _salvo?: boolean;
}

/** Conferência: soma das metas dos vendedores de um setor x meta do setor. */
interface ResumoSetorVendedores {
  id_departamento: number | null;
  departamento: string;
  metaSetor: number | null;   // null = setor sem meta cadastrada
  somaVendedores: number;
  qtdVendedores: number;
}

interface DiaCalendario {
  data: Date;
  iso: string;
  dia: number;
  domingo: boolean;
  venda: boolean;
  excecao?: ExcecaoDiaVenda;      // exceção que vale para o escopo escolhido
  herdada: boolean;               // exceção de "todas as lojas" vista dentro de uma loja
  feriado?: FeriadoCiss;
}

type Aba = 'loja' | 'setor' | 'vendedor' | 'dias';

const MESES = [
  { num: 1, nome: 'Janeiro' }, { num: 2, nome: 'Fevereiro' },
  { num: 3, nome: 'Março' },   { num: 4, nome: 'Abril' },
  { num: 5, nome: 'Maio' },    { num: 6, nome: 'Junho' },
  { num: 7, nome: 'Julho' },   { num: 8, nome: 'Agosto' },
  { num: 9, nome: 'Setembro' },{ num: 10, nome: 'Outubro' },
  { num: 11, nome: 'Novembro' },{ num: 12, nome: 'Dezembro' },
];
const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

@Component({
  selector: 'app-metas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatIconModule, MatSelectModule,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatTooltipModule,
  ],
  templateUrl: './metas.component.html',
  styleUrls: ['./metas.component.scss'],
})
export class MetasComponent {
  private cdr = inject(ChangeDetectorRef);
  private http = inject(HttpClient);
  private empresaSvc = inject(EmpresaService);
  private setoresSvc = inject(ComercialSetoresService);

  readonly meses = MESES;
  readonly anos = [2024, 2025, 2026, 2027];
  readonly diasSemana = DIAS_SEMANA;

  aba: Aba = 'loja';
  mesSelecionado = new Date().getMonth() + 1;
  anoSelecionado = new Date().getFullYear();

  empresas: EmpresaLite[] = [];
  metas: MetaRow[] = [];
  carregando = false;

  // Dias de venda do mês
  excecoes: ExcecaoDiaVenda[] = [];
  feriadosCiss: FeriadoCiss[] = [];
  diasUteisMes = 0;   // calendário geral (todas as lojas)

  // Por setor
  departamentos: Departamento[] = [];
  lojaSetor: number | null = null;
  private setoresPorLoja = new Map<number, SetorRow[]>();
  private sugestaoCache = new Map<string, { periodo: { inicio: string; fim: string }; setores: SugestaoSetor[] }>();
  periodoSugestao = '';
  carregandoSugestao = false;
  salvandoSetores = false;
  novoDepartamento: number | null = null;
  erroSetor = '';

  // Por vendedor
  lojaVendedor: number | null = null;
  private lojasPermitidasUsuario: number[] | null = null;   // null = todas
  private vendedoresPorLoja = new Map<number, VendedorRow[]>();
  private sugestaoVendCache = new Map<string, SugestaoVendedoresResp>();
  /** Quem vendeu na loja no período da sugestão mas não está no cadastro do ERP (só aviso). */
  foraDoCadastroLoja: VendedorForaCadastro[] = [];
  periodoSugestaoVend = '';
  carregandoSugestaoVend = false;
  salvandoVendedores = false;
  cadastroVendedores: VendedorCadastro[] = [];
  private cadastroCarregado = false;
  novoVendedor: number | null = null;
  erroVendedor = '';

  // Dias de venda
  escopoDias: number | null = null;   // null = todas as lojas
  descricaoDia = '';
  calendario: (DiaCalendario | null)[] = [];
  gravandoDia = false;
  erroDias = '';

  // Totais
  get totalMetaFat(): number { return this.metas.reduce((s, m) => s + (m.meta_fat || 0), 0); }

  constructor() {
    afterNextRender(() => {
      this.lojasPermitidasUsuario = this.lerLojasDoToken();
      this.empresaSvc.getEmpresas().subscribe(emp => {
        this.empresas = emp;
        this.lojaSetor = emp[0]?.id ?? null;
        this.lojaVendedor = this.empresasVendedor[0]?.id ?? null;
        this.cdr.detectChanges();
        this.carregar();
      });
      this.setoresSvc.departamentos().subscribe({
        next: (d) => { this.departamentos = d; this.cdr.detectChanges(); },
        error: () => { this.departamentos = []; },
      });
    });
  }

  trocarAba(a: Aba) {
    this.aba = a;
    if (a === 'vendedor') this.carregarCadastroVendedores();
    this.cdr.detectChanges();
  }

  async carregar() {
    this.carregando = true;
    this.erroSetor = '';
    this.erroDias = '';
    this.erroVendedor = '';
    this.cdr.detectChanges();
    const mes = this.mesSelecionado;
    const ano = this.anoSelecionado;
    try {
      const [rows, dias, metasSetor, metasVendedor] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`${environment.apiUrl}/comercial/metas/mes?mes=${mes}&ano=${ano}`)),
        firstValueFrom(this.setoresSvc.diasVenda(mes, ano)).catch(() => ({ excecoes: [], feriadosCiss: [] } as any)),
        firstValueFrom(this.setoresSvc.metasSetor(mes, ano)).catch(() => [] as MetaSetorApi[]),
        firstValueFrom(this.setoresSvc.metasVendedor(mes, ano)).catch(() => [] as MetaVendedorApi[]),
      ]);

      this.excecoes = (dias?.excecoes ?? []).map((e: any) => ({ ...e, id_empresa: e.id_empresa == null ? null : Number(e.id_empresa) }));
      this.feriadosCiss = dias?.feriadosCiss ?? [];
      this.calcularDiasUteis();

      // Para cada empresa, monta uma linha — se já tem meta usa ela, senão zero
      this.metas = this.empresas.map(emp => {
        const existing = rows.find(r => Number(r.id_empresa) === emp.id);
        return {
          id:         existing?.id,
          id_empresa: emp.id,
          apelido:    emp.apelido,
          mes, ano,
          meta_fat:   Number(existing?.meta_fat   || 0),
          meta_margem: Number(existing?.meta_margem || 0),
          _editFat:   this.formatMoney(Number(existing?.meta_fat || 0)),
          _editMargem: ((Number(existing?.meta_margem || 0)) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false }),
          meta_ticket_medio: Number(existing?.meta_ticket_medio || 0),
          _editTicket: this.formatMoney(Number(existing?.meta_ticket_medio || 0)),
        };
      });

      this.montarSetores(metasSetor ?? []);
      this.montarVendedores(metasVendedor ?? []);
      this.montarCalendario();
    } catch {
      this.metas = [];
    } finally {
      this.carregando = false;
      this.cdr.detectChanges();
    }
  }

  private calcularDiasUteis() {
    const ini = new Date(this.anoSelecionado, this.mesSelecionado - 1, 1);
    const fim = new Date(this.anoSelecionado, this.mesSelecionado, 0);
    this.diasUteisMes = contarDiasVenda(ini, fim, this.excecoes, null);
  }

  /** Dias de venda do mês na loja (considera as exceções da loja e as de todas). */
  diasLoja(idEmpresa: number | null): number {
    const ini = new Date(this.anoSelecionado, this.mesSelecionado - 1, 1);
    const fim = new Date(this.anoSelecionado, this.mesSelecionado, 0);
    return contarDiasVenda(ini, fim, this.excecoes, idEmpresa);
  }

  metaDiariaLoja(row: MetaRow): number {
    const d = this.diasLoja(row.id_empresa);
    return d ? row.meta_fat / d : 0;
  }

  get metaDiaria(): number {
    return this.metas.reduce((s, m) => s + this.metaDiariaLoja(m), 0);
  }

  get qtdExcecoesMes(): number { return this.excecoes.length; }

  salvar(row: MetaRow) {
    // Parseia os valores editados
    row.meta_fat          = this.parseMoney(row._editFat || '0');
    row.meta_margem       = Number(String(row._editMargem || '0').replace(',', '.')) / 100;
    row.meta_ticket_medio = this.parseMoney(row._editTicket || '0');
    row._salvando   = true;
    this.cdr.detectChanges();

    this.http.post<any>(`${environment.apiUrl}/comercial/metas`, {
      id_empresa:        row.id_empresa,
      mes:               row.mes,
      ano:               row.ano,
      meta_fat:          row.meta_fat,
      meta_margem:       row.meta_margem,
      meta_ticket_medio: row.meta_ticket_medio,
    }).subscribe({
      next: (res) => {
        row.id = res.id;
        row._salvando = false;
        row._salvo    = true;
        setTimeout(() => { row._salvo = false; this.cdr.detectChanges(); }, 2000);
        this.cdr.detectChanges();
      },
      error: (err) => {
        row._salvando = false;
        alert(err?.error?.message || 'Erro ao salvar meta.');
        this.cdr.detectChanges();
      }
    });
  }

  salvarTodas() {
    this.metas.forEach(m => this.salvar(m));
  }

  // ════════════════════════════════════════════════════════════════
  // Por setor
  // ════════════════════════════════════════════════════════════════

  private montarSetores(api: MetaSetorApi[]) {
    this.setoresPorLoja.clear();
    for (const m of api) {
      const idEmp = Number(m.id_empresa);
      const lista = this.setoresPorLoja.get(idEmp) ?? [];
      const meta = Number(m.meta_fat) || 0;
      lista.push({
        id: m.id,
        id_departamento: Number(m.id_departamento),
        departamento: m.departamento,
        meta_fat: meta,
        _editFat: this.formatMoney(meta),
      });
      this.setoresPorLoja.set(idEmp, lista);
    }
    for (const [idEmp, lista] of this.setoresPorLoja) {
      lista.sort((a, b) => b.meta_fat - a.meta_fat || a.departamento.localeCompare(b.departamento));
      lista.forEach(r => r._editPerc = this.formatPerc(this.percDaLoja(idEmp, r.meta_fat)));
    }
    const s = this.sugestaoCache.get(`${this.anoSelecionado}-${this.mesSelecionado}`);
    this.periodoSugestao = s ? this.rotuloPeriodo(s.periodo) : '';
  }

  get setoresDaLoja(): SetorRow[] {
    if (this.lojaSetor == null) return [];
    if (!this.setoresPorLoja.has(this.lojaSetor)) this.setoresPorLoja.set(this.lojaSetor, []);
    return this.setoresPorLoja.get(this.lojaSetor)!;
  }

  get metaLojaSetor(): number {
    return this.metas.find(m => m.id_empresa === this.lojaSetor)?.meta_fat ?? 0;
  }
  get totalSetores(): number {
    return this.setoresDaLoja.reduce((s, r) => s + (r.meta_fat || 0), 0);
  }
  /** Parte da meta da loja que ainda não foi distribuída entre os setores (negativo = passou da meta da loja). */
  get naoDistribuido(): number {
    return Math.round((this.metaLojaSetor - this.totalSetores) * 100) / 100;
  }
  get percDistribuido(): number {
    return this.metaLojaSetor ? (this.totalSetores / this.metaLojaSetor) * 100 : 0;
  }
  get temAlteracaoSetor(): boolean {
    return this.setoresDaLoja.some(r => r._alterado);
  }

  /** Departamentos ainda não usados na loja escolhida (para "Adicionar setor"). */
  get departamentosDisponiveis(): Departamento[] {
    const usados = new Set(this.setoresDaLoja.map(r => r.id_departamento));
    return this.departamentos.filter(d => d.ativo && !usados.has(d.id));
  }

  private percDaLoja(idEmp: number, valor: number): number {
    const meta = this.metas.find(m => m.id_empresa === idEmp)?.meta_fat ?? 0;
    return meta ? (valor / meta) * 100 : 0;
  }

  apelidoLoja(id: number | null): string {
    if (id == null) return 'Todas as lojas';
    return this.empresas.find(e => e.id === id)?.apelido ?? `Loja ${id}`;
  }

  trocarLojaSetor() {
    this.erroSetor = '';
    this.setoresDaLoja.forEach(r => r._editPerc = this.formatPerc(this.percDaLoja(this.lojaSetor!, r.meta_fat)));
    this.cdr.detectChanges();
  }

  adicionarSetor() {
    const dep = this.departamentos.find(d => d.id === this.novoDepartamento);
    if (!dep || this.lojaSetor == null) return;
    this.setoresDaLoja.push({
      id_departamento: dep.id, departamento: dep.nome, meta_fat: 0,
      _editFat: this.formatMoney(0), _editPerc: this.formatPerc(0), _alterado: true,
    });
    this.novoDepartamento = null;
    this.cdr.detectChanges();
  }

  onSetorFatBlur(r: SetorRow) {
    const n = this.parseMoney(r._editFat || '0');
    if (n !== r.meta_fat) r._alterado = true;
    r.meta_fat = n;
    r._editFat = this.formatMoney(n);
    r._editPerc = this.formatPerc(this.percDaLoja(this.lojaSetor!, n));
    this.cdr.detectChanges();
  }

  onSetorPercBlur(r: SetorRow) {
    const p = Number(String(r._editPerc || '0').replace(',', '.'));
    const perc = Number.isFinite(p) ? Math.max(0, p) : 0;
    const valor = Math.round(this.metaLojaSetor * perc) / 100;
    if (valor !== r.meta_fat) r._alterado = true;
    r.meta_fat = valor;
    r._editFat = this.formatMoney(valor);
    r._editPerc = this.formatPerc(perc);
    this.cdr.detectChanges();
  }

  /** Divide a meta da loja entre os setores pela participação dos 3 meses anteriores. Não grava: o usuário revisa e salva. */
  async sugerirPelaParticipacao() {
    if (this.lojaSetor == null) return;
    if (!this.metaLojaSetor) {
      this.erroSetor = 'Cadastre primeiro a meta da loja na aba "Por loja".';
      this.cdr.detectChanges();
      return;
    }
    const chave = `${this.anoSelecionado}-${this.mesSelecionado}`;
    this.erroSetor = '';
    this.carregandoSugestao = true;
    this.cdr.detectChanges();
    try {
      let sug = this.sugestaoCache.get(chave);
      if (!sug) {
        sug = await firstValueFrom(this.setoresSvc.sugestao(this.mesSelecionado, this.anoSelecionado));
        this.sugestaoCache.set(chave, sug);
      }
      this.periodoSugestao = this.rotuloPeriodo(sug.periodo);
      const daLoja = sug.setores.filter(s => s.idEmpresa === this.lojaSetor);
      if (!daLoja.length) {
        this.erroSetor = 'Sem venda por setor nesta loja nos 3 meses anteriores.';
        return;
      }
      const meta = this.metaLojaSetor;
      const lista = this.setoresDaLoja;
      // setores da sugestão: preenche valor; setores que não venderam no período ficam com 0
      for (const r of lista) { r.participacao = 0; }
      for (const s of daLoja) {
        let r = lista.find(x => x.id_departamento === s.idDepartamento);
        if (!r) {
          r = { id_departamento: s.idDepartamento, departamento: s.departamento, meta_fat: 0 };
          lista.push(r);
        }
        r.participacao = s.participacao;
      }
      for (const r of lista) {
        const novo = Math.round(meta * (r.participacao ?? 0) * 100) / 100;
        if (novo !== r.meta_fat) r._alterado = true;
        r.meta_fat = novo;
      }
      // sobra de arredondamento vai para o maior setor
      const resto = Math.round((meta - lista.reduce((s, r) => s + r.meta_fat, 0)) * 100) / 100;
      if (resto !== 0) {
        const maior = lista.reduce((a, b) => (b.meta_fat > a.meta_fat ? b : a));
        maior.meta_fat = Math.round((maior.meta_fat + resto) * 100) / 100;
      }
      lista.sort((a, b) => b.meta_fat - a.meta_fat || a.departamento.localeCompare(b.departamento));
      lista.forEach(r => {
        r._editFat = this.formatMoney(r.meta_fat);
        r._editPerc = this.formatPerc(this.percDaLoja(this.lojaSetor!, r.meta_fat));
      });
    } catch (err: any) {
      this.erroSetor = err?.error?.message || 'Não foi possível calcular a sugestão agora. Tente de novo em instantes.';
    } finally {
      this.carregandoSugestao = false;
      this.cdr.detectChanges();
    }
  }

  async salvarSetores() {
    if (this.lojaSetor == null) return;
    const idEmp = this.lojaSetor;
    const pendentes = this.setoresDaLoja.filter(r => r._alterado);
    if (!pendentes.length) return;
    this.salvandoSetores = true;
    this.erroSetor = '';
    this.cdr.detectChanges();
    let falhas = 0;
    for (const r of pendentes) {
      r._salvando = true;
      this.cdr.detectChanges();
      try {
        const res = await firstValueFrom(this.setoresSvc.salvarMetaSetor({
          id_empresa: idEmp,
          id_departamento: r.id_departamento,
          departamento: r.departamento,
          mes: this.mesSelecionado,
          ano: this.anoSelecionado,
          meta_fat: r.meta_fat,
        }));
        r.id = res.id;
        r._alterado = false;
        r._salvo = true;
        setTimeout(() => { r._salvo = false; this.cdr.detectChanges(); }, 2000);
      } catch (err: any) {
        falhas++;
        this.erroSetor = err?.error?.message || 'Erro ao salvar metas dos setores.';
      } finally {
        r._salvando = false;
      }
    }
    this.salvandoSetores = false;
    if (falhas) this.erroSetor = `${falhas} setor(es) não foram salvos. ${this.erroSetor}`;
    this.cdr.detectChanges();
  }

  async removerSetor(r: SetorRow) {
    if (r.id && !confirm(`Remover a meta de ${r.departamento} em ${this.apelidoLoja(this.lojaSetor)}?`)) return;
    try {
      if (r.id) await firstValueFrom(this.setoresSvc.excluirMetaSetor(r.id));
      const lista = this.setoresDaLoja;
      lista.splice(lista.indexOf(r), 1);
    } catch (err: any) {
      this.erroSetor = err?.error?.message || 'Erro ao remover.';
    }
    this.cdr.detectChanges();
  }

  // ════════════════════════════════════════════════════════════════
  // Por vendedor (loja + vendedor: só as vendas dele naquela loja)
  // ════════════════════════════════════════════════════════════════

  /** Lojas COM_EMPRESA_X do token. null = todas (ADMIN ou sem nenhuma COM_EMPRESA_X). O back confere de novo. */
  private lerLojasDoToken(): number[] | null {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = String(payload.roles || '').split(',').map((r: string) => r.trim().toUpperCase()).filter(Boolean);
      if (roles.includes('ADMIN')) return null;
      const lojas = roles
        .filter(r => r.startsWith('COM_EMPRESA_'))
        .map(r => parseInt(r.replace('COM_EMPRESA_', ''), 10))
        .filter(n => !isNaN(n));
      return lojas.length ? lojas : null;
    } catch {
      return null;
    }
  }

  /** Lojas que o usuário pode editar na aba Por vendedor. */
  get empresasVendedor(): EmpresaLite[] {
    const lojas = this.lojasPermitidasUsuario;
    return lojas ? this.empresas.filter(e => lojas.includes(e.id)) : this.empresas;
  }

  private montarVendedores(api: MetaVendedorApi[]) {
    this.vendedoresPorLoja.clear();
    for (const m of api) {
      const idEmp = Number(m.id_empresa);
      const lista = this.vendedoresPorLoja.get(idEmp) ?? [];
      const meta = Number(m.meta_fat) || 0;
      lista.push({
        id: m.id,
        id_vendedor: Number(m.id_vendedor),
        nome: m.nome,
        id_departamento: m.id_departamento == null ? null : Number(m.id_departamento),
        departamento: m.departamento || '—',
        meta_fat: meta,
        _editFat: this.formatMoney(meta),
      });
      this.vendedoresPorLoja.set(idEmp, lista);
    }
    for (const [idEmp, lista] of this.vendedoresPorLoja) {
      this.ordenarVendedores(lista);
      lista.forEach(r => r._editPerc = this.formatPerc(this.percDaLoja(idEmp, r.meta_fat)));
    }
    const s = this.sugestaoVendCache.get(`${this.anoSelecionado}-${this.mesSelecionado}`);
    this.periodoSugestaoVend = s ? this.rotuloPeriodo(s.periodo) : '';
  }

  private ordenarVendedores(lista: VendedorRow[]) {
    lista.sort((a, b) => b.meta_fat - a.meta_fat || a.nome.localeCompare(b.nome));
  }

  private carregarCadastroVendedores() {
    if (this.cadastroCarregado) return;
    this.cadastroCarregado = true;
    this.setoresSvc.vendedoresCadastro().subscribe({
      next: (lista) => { this.cadastroVendedores = lista; this.cdr.detectChanges(); },
      error: () => { this.cadastroCarregado = false; },
    });
  }

  get vendedoresDaLoja(): VendedorRow[] {
    if (this.lojaVendedor == null) return [];
    if (!this.vendedoresPorLoja.has(this.lojaVendedor)) this.vendedoresPorLoja.set(this.lojaVendedor, []);
    return this.vendedoresPorLoja.get(this.lojaVendedor)!;
  }

  get metaLojaVendedor(): number {
    return this.metas.find(m => m.id_empresa === this.lojaVendedor)?.meta_fat ?? 0;
  }
  get totalVendedores(): number {
    return this.vendedoresDaLoja.reduce((s, r) => s + (r.meta_fat || 0), 0);
  }
  /** Parte da meta da loja que ainda não foi distribuída entre os vendedores (negativo = passou da meta da loja). */
  get naoDistribuidoVend(): number {
    return Math.round((this.metaLojaVendedor - this.totalVendedores) * 100) / 100;
  }
  get percDistribuidoVend(): number {
    return this.metaLojaVendedor ? (this.totalVendedores / this.metaLojaVendedor) * 100 : 0;
  }
  get temAlteracaoVendedor(): boolean {
    return this.vendedoresDaLoja.some(r => r._alterado);
  }

  /** Vendedores ativos do cadastro, da loja escolhida (ou sem loja), que ainda não estão na lista. */
  get vendedoresDisponiveis(): VendedorCadastro[] {
    const usados = new Set(this.vendedoresDaLoja.map(r => r.id_vendedor));
    return this.cadastroVendedores.filter(v =>
      !usados.has(v.id_vendedor) && (v.id_empresa == null || v.id_empresa === this.lojaVendedor));
  }

  /** Por setor: soma das metas dos vendedores x meta do setor (aviso, não bloqueia). */
  get resumoSetoresVendedores(): ResumoSetorVendedores[] {
    if (this.lojaVendedor == null) return [];
    const setores = this.setoresPorLoja.get(this.lojaVendedor) ?? [];
    const mapa = new Map<string, ResumoSetorVendedores>();
    for (const s of setores) {
      mapa.set(String(s.id_departamento), {
        id_departamento: s.id_departamento, departamento: s.departamento,
        metaSetor: s.meta_fat, somaVendedores: 0, qtdVendedores: 0,
      });
    }
    for (const v of this.vendedoresDaLoja) {
      const chave = String(v.id_departamento);
      let r = mapa.get(chave);
      if (!r) {
        r = { id_departamento: v.id_departamento, departamento: v.departamento, metaSetor: null, somaVendedores: 0, qtdVendedores: 0 };
        mapa.set(chave, r);
      }
      r.somaVendedores += v.meta_fat || 0;
      r.qtdVendedores++;
    }
    return [...mapa.values()].sort((a, b) => (b.metaSetor ?? 0) - (a.metaSetor ?? 0) || a.departamento.localeCompare(b.departamento));
  }

  get totalForaDoCadastro(): number {
    return this.foraDoCadastroLoja.reduce((s, f) => s + f.faturamento, 0);
  }

  get nomesForaDoCadastro(): string {
    const nomes = this.foraDoCadastroLoja.slice(0, 6).map(f => `${f.nome} (${f.idVendedor})`);
    const resto = this.foraDoCadastroLoja.length - nomes.length;
    return nomes.join(', ') + (resto > 0 ? ` e mais ${resto}` : '');
  }

  difSetor(r: ResumoSetorVendedores): number {
    return Math.round(((r.metaSetor ?? 0) - r.somaVendedores) * 100) / 100;
  }

  trocarLojaVendedor() {
    this.erroVendedor = '';
    this.foraDoCadastroLoja = [];
    this.novoVendedor = null;
    this.vendedoresDaLoja.forEach(r => r._editPerc = this.formatPerc(this.percDaLoja(this.lojaVendedor!, r.meta_fat)));
    this.cdr.detectChanges();
  }

  adicionarVendedor() {
    const v = this.cadastroVendedores.find(x => x.id_vendedor === this.novoVendedor);
    if (!v || this.lojaVendedor == null) return;
    this.vendedoresDaLoja.push({
      id_vendedor: v.id_vendedor, nome: v.nome, id_departamento: null, departamento: '—', meta_fat: 0,
      _editFat: this.formatMoney(0), _editPerc: this.formatPerc(0), _alterado: true,
    });
    this.novoVendedor = null;
    this.cdr.detectChanges();
  }

  onVendedorFatBlur(r: VendedorRow) {
    const n = this.parseMoney(r._editFat || '0');
    if (n !== r.meta_fat) r._alterado = true;
    r.meta_fat = n;
    r._editFat = this.formatMoney(n);
    r._editPerc = this.formatPerc(this.percDaLoja(this.lojaVendedor!, n));
    this.cdr.detectChanges();
  }

  onVendedorPercBlur(r: VendedorRow) {
    const p = Number(String(r._editPerc || '0').replace(',', '.'));
    const perc = Number.isFinite(p) ? Math.max(0, p) : 0;
    const valor = Math.round(this.metaLojaVendedor * perc) / 100;
    if (valor !== r.meta_fat) r._alterado = true;
    r.meta_fat = valor;
    r._editFat = this.formatMoney(valor);
    r._editPerc = this.formatPerc(perc);
    this.cdr.detectChanges();
  }

  /**
   * Divide a meta da loja entre os vendedores pela participação de cada um nas vendas
   * da loja nos 3 meses anteriores. Não grava: o usuário revisa e salva.
   */
  async sugerirVendedoresPelaParticipacao() {
    if (this.lojaVendedor == null) return;
    if (!this.metaLojaVendedor) {
      this.erroVendedor = 'Cadastre primeiro a meta da loja na aba "Por loja".';
      this.cdr.detectChanges();
      return;
    }
    const chave = `${this.anoSelecionado}-${this.mesSelecionado}`;
    this.erroVendedor = '';
    this.carregandoSugestaoVend = true;
    this.cdr.detectChanges();
    try {
      // sempre pergunta ao back: a consulta pesada fica em cache lá, e o filtro do cadastro é aplicado na hora
      const sug = await firstValueFrom(this.setoresSvc.sugestaoVendedores(this.mesSelecionado, this.anoSelecionado));
      this.sugestaoVendCache.set(chave, sug);
      this.periodoSugestaoVend = this.rotuloPeriodo(sug.periodo);
      this.foraDoCadastroLoja = (sug.foraDoCadastro ?? []).filter(f => f.idEmpresa === this.lojaVendedor);
      const daLoja = sug.vendedores.filter(s => s.idEmpresa === this.lojaVendedor);
      if (!daLoja.length) {
        this.erroVendedor = 'Sem venda de vendedores nesta loja nos 3 meses anteriores.';
        return;
      }
      const meta = this.metaLojaVendedor;
      const lista = this.vendedoresDaLoja;
      // vendedores da sugestão: preenche valor; quem não vendeu na loja no período fica com 0
      for (const r of lista) { r.participacao = 0; }
      for (const s of daLoja) {
        let r = lista.find(x => x.id_vendedor === s.idVendedor);
        if (!r) {
          r = { id_vendedor: s.idVendedor, nome: s.nome, id_departamento: s.idDepartamento, departamento: s.departamento, meta_fat: 0 };
          lista.push(r);
        } else if (r.id_departamento == null) {
          r.id_departamento = s.idDepartamento;
          r.departamento = s.departamento;
        }
        r.participacao = s.participacao;
      }
      for (const r of lista) {
        const novo = Math.round(meta * (r.participacao ?? 0) * 100) / 100;
        if (novo !== r.meta_fat) r._alterado = true;
        r.meta_fat = novo;
      }
      // sobra de arredondamento vai para o maior vendedor
      const resto = Math.round((meta - lista.reduce((s, r) => s + r.meta_fat, 0)) * 100) / 100;
      if (resto !== 0) {
        const maior = lista.reduce((a, b) => (b.meta_fat > a.meta_fat ? b : a));
        maior.meta_fat = Math.round((maior.meta_fat + resto) * 100) / 100;
        maior._alterado = true;
      }
      this.ordenarVendedores(lista);
      lista.forEach(r => {
        r._editFat = this.formatMoney(r.meta_fat);
        r._editPerc = this.formatPerc(this.percDaLoja(this.lojaVendedor!, r.meta_fat));
      });
    } catch (err: any) {
      this.erroVendedor = err?.error?.message || 'Não foi possível calcular a sugestão agora. Tente de novo em instantes.';
    } finally {
      this.carregandoSugestaoVend = false;
      this.cdr.detectChanges();
    }
  }

  async salvarVendedores() {
    if (this.lojaVendedor == null) return;
    const idEmp = this.lojaVendedor;
    const pendentes = this.vendedoresDaLoja.filter(r => r._alterado);
    if (!pendentes.length) return;
    this.salvandoVendedores = true;
    this.erroVendedor = '';
    this.cdr.detectChanges();
    let falhas = 0;
    for (const r of pendentes) {
      r._salvando = true;
      this.cdr.detectChanges();
      try {
        const res = await firstValueFrom(this.setoresSvc.salvarMetaVendedor({
          id_empresa: idEmp,
          id_vendedor: r.id_vendedor,
          nome: r.nome,
          mes: this.mesSelecionado,
          ano: this.anoSelecionado,
          meta_fat: r.meta_fat,
        }));
        r.id = res.id;
        r._alterado = false;
        r._salvo = true;
        setTimeout(() => { r._salvo = false; this.cdr.detectChanges(); }, 2000);
      } catch (err: any) {
        falhas++;
        this.erroVendedor = err?.error?.message || 'Erro ao salvar metas dos vendedores.';
      } finally {
        r._salvando = false;
      }
    }
    // Vendedor adicionado pelo cadastro ainda não tem setor: busca no back depois de salvar.
    if (this.vendedoresDaLoja.some(r => r.id_departamento == null && r.id)) {
      try {
        const api = await firstValueFrom(this.setoresSvc.metasVendedor(this.mesSelecionado, this.anoSelecionado));
        for (const r of this.vendedoresDaLoja) {
          const a = api.find(x => x.id === r.id);
          if (a && r.id_departamento == null && a.id_departamento != null) {
            r.id_departamento = Number(a.id_departamento);
            r.departamento = a.departamento || '—';
          }
        }
        this.ordenarVendedores(this.vendedoresDaLoja);
      } catch { /* o setor aparece no próximo carregamento */ }
    }
    this.salvandoVendedores = false;
    if (falhas) this.erroVendedor = `${falhas} vendedor(es) não foram salvos. ${this.erroVendedor}`;
    this.cdr.detectChanges();
  }

  async removerVendedor(r: VendedorRow) {
    if (r.id && !confirm(`Remover a meta de ${r.nome} em ${this.apelidoLoja(this.lojaVendedor)}?`)) return;
    try {
      if (r.id) await firstValueFrom(this.setoresSvc.excluirMetaVendedor(r.id));
      const lista = this.vendedoresDaLoja;
      lista.splice(lista.indexOf(r), 1);
    } catch (err: any) {
      this.erroVendedor = err?.error?.message || 'Erro ao remover.';
    }
    this.cdr.detectChanges();
  }

  private rotuloPeriodo(p: { inicio: string; fim: string }): string {
    const f = (iso: string) => `${iso.slice(5, 7)}/${iso.slice(0, 4)}`;
    return `${f(p.inicio)} a ${f(p.fim)}`;
  }

  // ════════════════════════════════════════════════════════════════
  // Dias de venda
  // ════════════════════════════════════════════════════════════════

  montarCalendario() {
    const ano = this.anoSelecionado;
    const mes = this.mesSelecionado;
    const ultimo = new Date(ano, mes, 0).getDate();
    const primeiroDow = new Date(ano, mes - 1, 1).getDay();
    const cal: (DiaCalendario | null)[] = Array(primeiroDow).fill(null);
    for (let d = 1; d <= ultimo; d++) {
      const data = new Date(ano, mes - 1, d);
      const iso = isoLocal(data);
      const exc = excecaoDoDia(iso, this.excecoes, this.escopoDias);
      cal.push({
        data, iso, dia: d,
        domingo: data.getDay() === 0,
        venda: ehDiaDeVenda(data, this.excecoes, this.escopoDias),
        excecao: exc,
        herdada: !!exc && this.escopoDias != null && exc.id_empresa == null,
        feriado: this.feriadosCiss.find(f => f.data === iso),
      });
    }
    this.calendario = cal;
  }

  trocarEscopoDias() {
    this.erroDias = '';
    this.montarCalendario();
    this.cdr.detectChanges();
  }

  get diasVendaEscopo(): number { return this.diasLoja(this.escopoDias); }

  /** Lojas cujo número de dias de venda difere do calendário geral. */
  get lojasComDiasDiferentes(): { apelido: string; dias: number }[] {
    return this.empresas
      .map(e => ({ apelido: e.apelido, dias: this.diasLoja(e.id) }))
      .filter(x => x.dias !== this.diasUteisMes);
  }

  tooltipDia(d: DiaCalendario): string {
    const partes: string[] = [];
    if (d.feriado) partes.push(`Feriado no CISS: ${d.feriado.descricao}`);
    if (d.excecao) {
      partes.push(`${d.excecao.tipo === 'FECHADO' ? 'Loja fechada' : 'Loja aberta'}${d.excecao.descricao ? ': ' + d.excecao.descricao : ''}`);
      partes.push(d.herdada ? 'Vale para todas as lojas (remova na visão "Todas as lojas", ou clique para criar uma regra só desta loja)' : 'Clique para desfazer');
    } else {
      partes.push(d.venda ? 'Dia de venda. Clique para marcar como fechado' : 'Domingo sem venda. Clique para marcar como aberto');
    }
    return partes.join('\n');
  }

  /**
   * Clique no dia: sem exceção no escopo escolhido → cria (FECHADO em dia de semana, ABERTO em domingo).
   * Com exceção do próprio escopo → remove.
   * Exceção herdada de "todas" vista dentro de uma loja → cria a regra contrária só para a loja.
   */
  async clicarDia(d: DiaCalendario) {
    if (this.gravandoDia) return;
    this.erroDias = '';
    this.gravandoDia = true;
    this.cdr.detectChanges();
    try {
      if (d.excecao && !d.herdada) {
        await firstValueFrom(this.setoresSvc.excluirExcecao(d.excecao.id!));
        this.excecoes = this.excecoes.filter(e => e.id !== d.excecao!.id);
      } else {
        let tipo: 'FECHADO' | 'ABERTO';
        if (d.herdada) {
          // a regra geral fechou (ou abriu) o dia; nesta loja vale o contrário
          tipo = d.excecao!.tipo === 'FECHADO' ? 'ABERTO' : 'FECHADO';
        } else {
          tipo = d.domingo ? 'ABERTO' : 'FECHADO';
        }
        const descricao = (this.descricaoDia || d.feriado?.descricao || '').trim();
        const nova = await firstValueFrom(this.setoresSvc.inserirExcecao({
          data: d.iso, id_empresa: this.escopoDias, tipo, descricao,
        }));
        this.excecoes = [...this.excecoes, { ...nova, id_empresa: nova.id_empresa == null ? null : Number(nova.id_empresa) }];
      }
      this.calcularDiasUteis();
      this.montarCalendario();
    } catch (err: any) {
      this.erroDias = err?.error?.message || 'Não foi possível gravar. Verifique sua permissão de Metas.';
    } finally {
      this.gravandoDia = false;
      this.cdr.detectChanges();
    }
  }

  async removerExcecao(e: ExcecaoDiaVenda) {
    if (!e.id) return;
    try {
      await firstValueFrom(this.setoresSvc.excluirExcecao(e.id));
      this.excecoes = this.excecoes.filter(x => x.id !== e.id);
      this.calcularDiasUteis();
      this.montarCalendario();
    } catch (err: any) {
      this.erroDias = err?.error?.message || 'Erro ao remover.';
    }
    this.cdr.detectChanges();
  }

  dataBr(iso: string): string {
    const d = new Date(`${iso}T12:00:00`);
    return `${DIAS_SEMANA[d.getDay()]} ${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
  }

  // ── Formatação ──
  formatMoney(n: number): string {
    return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  formatPerc(n: number): string {
    return (n || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2, useGrouping: false });
  }
  parseMoney(s: string): number {
    // "1.234,56" → 1234.56
    return Number((s || '').replace(/\./g, '').replace(',', '.')) || 0;
  }

  onFatInput(row: MetaRow, value: string) {
    row._editFat = value;
  }
  onFatBlur(row: MetaRow) {
    const n = this.parseMoney(row._editFat || '0');
    row.meta_fat = n;
    row._editFat = this.formatMoney(n);
    this.cdr.detectChanges();
  }
  onMargemBlur(row: MetaRow) {
    const n = Number(String(row._editMargem || '0').replace(',', '.'));
    row.meta_margem = (isFinite(n) ? Math.max(0, Math.min(100, n)) : 0) / 100;
    row._editMargem = (row.meta_margem * 100).toLocaleString('pt-BR', { maximumFractionDigits: 4, useGrouping: false });
    this.cdr.detectChanges();
  }
  onTicketBlur(row: MetaRow) {
    const n = this.parseMoney(row._editTicket || '0');
    row.meta_ticket_medio = n;
    row._editTicket = this.formatMoney(n);
    this.cdr.detectChanges();
  }

  selectAll(e: Event) {
    const el = e.target as HTMLInputElement;
    queueMicrotask(() => el.select());
  }

  nomeMes(n: number): string {
    return MESES.find(m => m.num === n)?.nome ?? '';
  }
}
