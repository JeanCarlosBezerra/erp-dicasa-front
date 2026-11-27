import { Component, afterNextRender, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { EmpresaService } from '../../../services/empresa.service';
import { ExcecaoDiaVenda, contarDiasVenda, isoLocal } from '../../../services/dias-venda.util';

/** Linha de /comercial/colaborador/produtividade (período escolhido nos botões). */
interface VendedorDados {
  idVendedor: number;
  nome: string;
  qtdvenda: number;
  faturamento: number;
  lucro: number;
  margem: number;
  devolucoes: number;
  descontoProdutoValor: number;     // negociação do vendedor
  descontoProdutoPerc: number;
  descontoFinanceiroValor: number;  // condição de pagamento / política da loja
  descontoFinanceiroPerc: number;
  idDepartamento: number | null;    // setor no último dia do período (-1 = sem departamento; null = não consultado)
  departamento: string;
}

interface EmpresaLite {
  id: number;
  apelido: string;
}

/** Linha de /comercial/colaborador/ritmo-mes (mês corrente, por loja + vendedor). */
interface RitmoLinhaApi {
  idEmpresa: number;
  idVendedor: number;
  nome: string;
  meta: number | null;
  realizado: number;
  idDepartamento: number | null;
  departamento: string;
}

interface RitmoMesApi {
  mes: number;
  ano: number;
  inicio: string;
  corte: string | null;   // ontem; null no dia 1
  linhas: RitmoLinhaApi[];
}

type Cor = 'ok' | 'warn' | 'danger' | '';

/** Ritmo do mês de um vendedor numa loja (mesmas contas do Ritmo do mês do Dashboard). */
interface RitmoVendedor {
  idEmpresa: number;
  idVendedor: number;
  meta: number;              // 0 = sem meta
  realizado: number;         // dia 1 até ontem, só nesta loja
  diasMes: number;
  diasDecorridos: number;
  diasRestantes: number;     // contando hoje
  mediaDiaria: number;
  tendencia: number;
  tendenciaPerc: number;
  percAtingido: number;
  metaDiariaNec: number;
  metaDiariaOrig: number;
  atingiu: boolean;
  corTendencia: Cor;
  corNecessidade: Cor;
}

/** /comercial/colaborador/bota-fora */
interface BotaForaVendedorApi {
  idEmpresa: number;
  idVendedor: number;
  nome: string;
  faturamento: number;
}

interface BotaForaApi {
  dataInicio: string;
  dataFim: string;
  faturamento: number;
  lucro: number;
  secoes: { idSecao: number; secao: string; faturamento: number }[];
  vendedores: BotaForaVendedorApi[];
}

interface MetaLojaApi {
  id_empresa: number;
  meta_margem: number;   // fração 0.30 = 30%
}

const MESES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

@Component({
  selector: 'app-meu-painel',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatTooltipModule],
  templateUrl: './meu-painel.component.html',
  styleUrls: ['./meu-painel.component.scss'],
})
export class MeuPainelComponent {
    private cdr  = inject(ChangeDetectorRef);
    private http = inject(HttpClient);
    private api  = environment.apiUrl;

  // ─── Perfil detectado do JWT ──────────────────────────────────────────────
  isAdmin       = false;
  isGestor      = false;   // tem COM_EMPRESA mas não é o próprio vendedor
  nomeUsuario   = '';
  empresasPermitidas: number[] = [];

  // ─── Filtros ──────────────────────────────────────────────────────────────
  empresas: EmpresaLite[] = [];
  empresaSelecionada = '';
  periodoLabel = 'Hoje';
  mostrarDataCustom = false;
  dataInicioCustom = '';
  dataFimCustom = '';

  dataInicio: string = this.hoje();
  dataFim:    string = this.hoje();

  readonly periodos: { label: string; tipo: 'hoje' | 'semana' | 'mes' | 'mesAnterior' }[] = [
    { label: 'Hoje',         tipo: 'hoje' },
    { label: 'Esta semana',  tipo: 'semana' },
    { label: 'Este mês',     tipo: 'mes' },
    { label: 'Mês anterior', tipo: 'mesAnterior' },
  ];

  // ─── Dados ────────────────────────────────────────────────────────────────
  todosVendedores: VendedorDados[] = [];
  meusDados:       VendedorDados | null = null;
  carregando = false;
  dadosCarregados = false;
  erroMsg = '';

  // ─── Visão gestor ─────────────────────────────────────────────────────────
  buscaVendedor = '';
  setorFiltro = '';   // '' = todos; senão o idDepartamento como texto (3.3)
  vendedorSelecionado: VendedorDados | null = null;

  // ─── Ritmo do mês (metas individuais 3.2 e 3.4) ───────────────────────────
  ritmoMes: RitmoMesApi | null = null;
  private excecoesMes: ExcecaoDiaVenda[] = [];
  private metaMargemLoja = new Map<number, number>();   // fração
  carregandoRitmo = false;
  erroRitmo = '';
  /** O ritmo só recarrega ao abrir a tela ou trocar de loja, e sempre DEPOIS da produtividade
   *  (uma consulta por vez no CISS: chamadas simultâneas derrubam o driver do DB2). */
  private ritmoPendente = false;

  // ─── Bota-Fora (divisão 23, período dos botões; sem meta até haver regra) ──
  // Vendedor: só ele (somando as lojas). Gestor: a loja selecionada inteira.
  botaFora: BotaForaApi | null = null;
  carregandoBotaFora = false;
  erroBotaFora = '';

  /** Seções para as barras: as 6 maiores e o resto somado em "Outras seções". */
  get botaForaSecoes(): { nome: string; valor: number; pct: number }[] {
    const lista = (this.botaFora?.secoes ?? []).filter(s => s.faturamento > 0);
    const top = lista.slice(0, 6).map(s => ({ nome: s.secao, valor: s.faturamento }));
    const resto = lista.slice(6).reduce((acc, s) => acc + s.faturamento, 0);
    if (resto > 0) top.push({ nome: 'Outras seções', valor: resto });
    const maior = Math.max(...top.map(s => s.valor), 0);
    return top.map(s => ({ ...s, pct: maior ? Math.round((s.valor / maior) * 100) : 0 }));
  }

  /** Gestor: os 5 vendedores que mais venderam Bota-Fora na loja. */
  get botaForaTopVendedores(): BotaForaVendedorApi[] {
    return (this.botaFora?.vendedores ?? []).filter(v => v.idVendedor > 0 && v.faturamento > 0).slice(0, 5);
  }

  get botaForaMargem(): number | null {
    const b = this.botaFora;
    return b && b.faturamento > 0 ? (b.lucro / b.faturamento) * 100 : null;
  }

  /** Participação no faturamento do período (vendedor: o dele; gestor: o da equipe). */
  get botaForaParticipacao(): number | null {
    const base = this.isGestor ? this.totalEquipe : (this.meusDados?.faturamento ?? 0);
    return this.botaFora && base > 0 ? (this.botaFora.faturamento / base) * 100 : null;
  }

  /** Setores presentes na equipe do período (para o filtro 3.3), do maior faturamento para o menor. */
  get setoresDisponiveis(): { id: number; nome: string; qtd: number }[] {
    const mapa = new Map<number, { id: number; nome: string; qtd: number; fat: number }>();
    for (const v of this.todosVendedores) {
      if (v.nome.includes('-DEV(Reentrega)') || v.idDepartamento == null) continue;
      const s = mapa.get(v.idDepartamento) ?? { id: v.idDepartamento, nome: v.departamento || 'Sem departamento', qtd: 0, fat: 0 };
      s.qtd++;
      s.fat += v.faturamento;
      mapa.set(v.idDepartamento, s);
    }
    return [...mapa.values()]
      .sort((a, b) => (a.id === -1 ? 1 : 0) - (b.id === -1 ? 1 : 0) || b.fat - a.fat)
      .map(({ id, nome, qtd }) => ({ id, nome, qtd }));
  }

  get nomeSetorFiltro(): string {
    return this.setoresDisponiveis.find(s => String(s.id) === this.setorFiltro)?.nome ?? '';
  }

  /** Vendedores do setor escolhido (sem a busca por nome): base dos totais. */
  get vendedoresDoSetor(): VendedorDados[] {
    return this.todosVendedores
      .filter(v => !v.nome.includes('-DEV(Reentrega)'))
      .filter(v => !this.setorFiltro || String(v.idDepartamento) === this.setorFiltro);
  }

  get vendedoresFiltrados(): VendedorDados[] {
    const q = this.buscaVendedor.toLowerCase();
    return this.vendedoresDoSetor
      .filter(v => !q || v.nome.toLowerCase().includes(q))
      .sort((a, b) => b.faturamento - a.faturamento);
  }

  /** Total do setor escolhido (= total da equipe quando não há filtro). */
  get totalSetor(): number {
    return this.vendedoresDoSetor.reduce((s, v) => s + v.faturamento, 0);
  }

  get dadosExibidos(): VendedorDados | null {
    return this.vendedorSelecionado ?? this.meusDados;
  }

  // ─── KPIs calculados ──────────────────────────────────────────────────────
  get totalEquipe(): number {
    return this.todosVendedores
      .filter(v => !v.nome.includes('-DEV(Reentrega)'))
      .reduce((s, v) => s + v.faturamento, 0);
  }

  get mediaFaturamento(): number {
    const v = this.vendedoresDoSetor;
    if (!v.length) return 0;
    return v.reduce((s, x) => s + x.faturamento, 0) / v.length;
  }

  get rankingPosicao(): number {
    if (!this.meusDados) return 0;
    const sorted = [...this.vendedoresFiltrados].sort((a, b) => b.faturamento - a.faturamento);
    return sorted.findIndex(v => v.idVendedor === this.meusDados!.idVendedor) + 1;
  }

  constructor(private empresaService: EmpresaService) {
    afterNextRender(() => {
      this.detectarPerfil();
      this.carregarEmpresas();
    });
  }

  // ─── Detecção de perfil via JWT ───────────────────────────────────────────
  private detectarPerfil() {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = (payload.roles || '')
        .split(',').map((r: string) => r.trim()).filter(Boolean);

      this.nomeUsuario = payload.username || '';
      this.isAdmin = roles.includes('ADMIN');

      this.empresasPermitidas = roles
        .filter(r => r.startsWith('COM_EMPRESA_'))
        .map(r => parseInt(r.replace('COM_EMPRESA_', ''), 10))
        .filter(n => !isNaN(n));

      const temColaborador = roles.includes('COM_COLABORADOR');

      // Gestor = admin OU tem COM_COLABORADOR. COM_EMPRESA_X é só escopo de loja.
      this.isGestor = this.isAdmin || temColaborador;

      this.cdr.detectChanges();
    } catch { }
  }

  // ─── Empresas ─────────────────────────────────────────────────────────────
  carregarEmpresas() {
    this.empresaService.getEmpresas().subscribe({
      next: lista => {
        if (this.isAdmin) {
          // Admin vê tudo
          this.empresas = lista.filter(e => e.id <= 10);
        } else if (this.empresasPermitidas.length > 0) {
          // Gestor — filtra pelas empresas permitidas
          this.empresas = lista.filter(e => this.empresasPermitidas.includes(e.id));
        } else {
          // Vendedor — sem COM_EMPRESA_X, pega todas pra buscar os dados
          // O backend já filtra pelo idVendedor via comercial_vendedores
          this.empresas = lista.filter(e => e.id <= 10);
        }

        if (this.empresas.length) {
          this.empresaSelecionada = String(this.empresas[0].id);
          this.agendarRitmo();
          this.carregar();
        }
        this.cdr.detectChanges();
      }
    });
  }

  /** Troca de loja (gestor): período e ritmo da nova loja. */
  trocarEmpresa() {
    this.agendarRitmo();
    this.carregar();
  }

  /** Marca o ritmo para carregar logo depois da produtividade (e já mostra "calculando"). */
  private agendarRitmo() {
    this.ritmoPendente = true;
    this.carregandoRitmo = true;
  }

  /** Depois da produtividade: ritmo (se pendente) e então o Bota-Fora, uma consulta por vez. */
  private async carregarDepoisDaProdutividade() {
    if (this.ritmoPendente) {
      this.ritmoPendente = false;
      await this.carregarRitmo();
    }
    this.carregarBotaFora();
  }

  // ─── Período ──────────────────────────────────────────────────────────────
  selecionarPeriodo(p: { label: string; tipo: 'hoje' | 'semana' | 'mes' | 'mesAnterior' }) {
    this.periodoLabel = p.label;
    const hoje = new Date();

    if (p.tipo === 'hoje') {
      this.dataInicio = this.dataFim = this.hoje();
    } else if (p.tipo === 'mes') {
      // Do dia 1 do mês até hoje
      this.dataInicio = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
      this.dataFim    = this.hoje();
    } else if (p.tipo === 'mesAnterior') {
      this.dataInicio = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1));
      this.dataFim    = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 0));
    } else {
      // Últimos 7 dias, contando hoje
      const ini = new Date(hoje);
      ini.setDate(ini.getDate() - 6);
      this.dataInicio = isoLocal(ini);
      this.dataFim    = this.hoje();
    }

    this.carregar();
  }

  aplicarDataCustom() {
    if (!this.dataInicioCustom || !this.dataFimCustom) return;
    this.periodoLabel = 'Personalizado';
    this.dataInicio = this.dataInicioCustom;
    this.dataFim    = this.dataFimCustom;
    this.mostrarDataCustom = false;
    this.carregar();
  }

  /** Empresas enviadas ao back: vendedor sem COM_EMPRESA_X busca em todas (o back corta pelo login). */
  private empresasParaBuscar(): string {
    return (!this.isAdmin && this.empresasPermitidas.length === 0)
      ? this.empresas.map(e => e.id).join(',')
      : this.empresaSelecionada;
  }

  // ─── Carregar dados do período ────────────────────────────────────────────
  carregar() {
    if (!this.empresaSelecionada) return;
    this.carregando = true;
    this.erroMsg = '';
    this.vendedorSelecionado = null;
    this.cdr.detectChanges();

    const url = `${this.api}/comercial/colaborador/produtividade`
      + `?idempresa=${this.empresasParaBuscar()}`
      + `&dataInicio=${this.dataInicio}&dataFim=${this.dataFim}`;

    this.http.get<VendedorDados[]>(url).subscribe({
      next: dados => {
        this.todosVendedores = (dados ?? []).map(v => ({
          ...v,
          idDepartamento: v.idDepartamento == null ? null : Number(v.idDepartamento),
          departamento: v.departamento ?? '',
        }));
        if (this.setorFiltro && !this.setoresDisponiveis.some(s => String(s.id) === this.setorFiltro)) {
          this.setorFiltro = '';
        }
        this.dadosCarregados = true;
        this.carregando = false;
        if (!this.isGestor) {
          // Backend já devolveu SÓ o vendedor logado. Pega a linha principal (sem -DEV).
          this.meusDados = dados.find(v => !v.nome.includes('-DEV(Reentrega)')) ?? dados[0] ?? null;
        }
        this.cdr.detectChanges();
        this.carregarDepoisDaProdutividade();   // uma consulta por vez no CISS
      },
      error: () => {
        this.erroMsg = 'Erro ao carregar dados. Tente novamente.';
        this.carregando = false;
        this.cdr.detectChanges();
        if (this.ritmoPendente) {   // o ritmo não depende da produtividade: carrega mesmo assim
          this.ritmoPendente = false;
          this.carregarRitmo();
        }
      }
    });
  }

  // ─── Bota-Fora do período ─────────────────────────────────────────────────
  carregarBotaFora() {
    if (!this.empresaSelecionada) return;
    const ini = this.dataInicio, fim = this.dataFim, emp = this.empresasParaBuscar();
    this.carregandoBotaFora = true;
    this.erroBotaFora = '';
    this.cdr.detectChanges();

    const url = `${this.api}/comercial/colaborador/bota-fora`
      + `?idempresa=${emp}&dataInicio=${ini}&dataFim=${fim}`;

    this.http.get<BotaForaApi>(url).subscribe({
      next: b => {
        // descarta resposta atrasada de um período/loja que já foi trocado
        if (ini !== this.dataInicio || fim !== this.dataFim || emp !== this.empresasParaBuscar()) return;
        this.botaFora = {
          ...b,
          faturamento: Number(b?.faturamento) || 0,
          lucro: Number(b?.lucro) || 0,
          secoes: (b?.secoes ?? []).map(s => ({ ...s, faturamento: Number(s.faturamento) || 0 })),
          vendedores: (b?.vendedores ?? []).map(v => ({
            ...v, idVendedor: Number(v.idVendedor), faturamento: Number(v.faturamento) || 0,
          })),
        };
        this.carregandoBotaFora = false;
        this.cdr.detectChanges();
      },
      error: () => {
        if (ini !== this.dataInicio || fim !== this.dataFim || emp !== this.empresasParaBuscar()) return;
        this.botaFora = null;
        this.erroBotaFora = 'Não foi possível carregar o Bota-Fora agora.';
        this.carregandoBotaFora = false;
        this.cdr.detectChanges();
      }
    });
  }

  // ─── Ritmo do mês (sempre o mês corrente, do dia 1 até ontem) ─────────────
  async carregarRitmo() {
    if (!this.empresaSelecionada) return;
    this.carregandoRitmo = true;
    this.erroRitmo = '';
    this.cdr.detectChanges();

    const hoje = new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();
    const ini = isoLocal(new Date(ano, mes - 1, 1));
    const fim = isoLocal(new Date(ano, mes, 0));

    try {
      const [ritmo, excecoes, metasLoja] = await Promise.all([
        firstValueFrom(this.http.get<RitmoMesApi>(
          `${this.api}/comercial/colaborador/ritmo-mes?idempresa=${this.empresasParaBuscar()}`)),
        firstValueFrom(this.http.get<ExcecaoDiaVenda[]>(
          `${this.api}/comercial/metas/dias-venda/periodo?dataInicio=${ini}&dataFim=${fim}`)).catch(() => [] as ExcecaoDiaVenda[]),
        firstValueFrom(this.http.get<MetaLojaApi[]>(
          `${this.api}/comercial/metas/mes?mes=${mes}&ano=${ano}`)).catch(() => [] as MetaLojaApi[]),
      ]);
      this.excecoesMes = (excecoes ?? []).map(e => ({ ...e, id_empresa: e.id_empresa == null ? null : Number(e.id_empresa) }));
      this.metaMargemLoja = new Map((metasLoja ?? []).map(m => [Number(m.id_empresa), Number(m.meta_margem) || 0]));
      this.ritmoMes = {
        ...ritmo,
        linhas: (ritmo?.linhas ?? []).map(l => ({
          ...l,
          idEmpresa: Number(l.idEmpresa),
          idVendedor: Number(l.idVendedor),
          meta: l.meta == null ? null : Number(l.meta),
          realizado: Number(l.realizado) || 0,
        })),
      };
    } catch {
      this.ritmoMes = null;
      this.erroRitmo = 'Não foi possível calcular o ritmo do mês agora.';
    } finally {
      this.carregandoRitmo = false;
      this.cdr.detectChanges();
    }
  }

  /** Mesmas contas do Ritmo do mês do Dashboard, com o calendário de dias de venda da loja. */
  private calcularRitmo(l: RitmoLinhaApi): RitmoVendedor {
    const r = this.ritmoMes!;
    const inicio = new Date(r.ano, r.mes - 1, 1);
    const fimMes = new Date(r.ano, r.mes, 0);
    const corte = r.corte ? new Date(`${r.corte}T12:00:00`) : null;
    const diasMes = contarDiasVenda(inicio, fimMes, this.excecoesMes, l.idEmpresa);
    const diasDecorridos = corte ? contarDiasVenda(inicio, corte, this.excecoesMes, l.idEmpresa) : 0;
    const diasRestantes = Math.max(0, diasMes - diasDecorridos);

    const meta = l.meta ?? 0;
    const realizado = l.realizado;
    const mediaDiaria = diasDecorridos ? realizado / diasDecorridos : 0;
    const tendencia = mediaDiaria * diasMes;
    const tendenciaPerc = meta ? (tendencia / meta) * 100 : 0;
    const metaDiariaNec = diasRestantes ? Math.max(0, meta - realizado) / diasRestantes : 0;
    const metaDiariaOrig = diasMes ? meta / diasMes : 0;

    let corTendencia: Cor = '';
    if (meta && diasDecorridos) {
      corTendencia = tendencia >= meta ? 'ok' : (tendencia >= meta * 0.9 ? 'warn' : 'danger');
    }
    let corNecessidade: Cor = '';
    if (metaDiariaOrig) {
      corNecessidade = metaDiariaNec <= metaDiariaOrig ? 'ok' : (metaDiariaNec <= metaDiariaOrig * 1.1 ? 'warn' : 'danger');
    }

    return {
      idEmpresa: l.idEmpresa, idVendedor: l.idVendedor, meta, realizado,
      diasMes, diasDecorridos, diasRestantes, mediaDiaria, tendencia, tendenciaPerc,
      percAtingido: meta ? (realizado / meta) * 100 : 0,
      metaDiariaNec, metaDiariaOrig,
      atingiu: meta > 0 && realizado >= meta,
      corTendencia, corNecessidade,
    };
  }

  /** Gestor: ritmo de um vendedor na loja selecionada. */
  ritmoDoVendedor(idVendedor: number): RitmoVendedor | null {
    if (!this.ritmoMes) return null;
    const idEmp = Number(this.empresaSelecionada);
    const l = this.ritmoMes.linhas.find(x => x.idEmpresa === idEmp && x.idVendedor === idVendedor);
    return l ? this.calcularRitmo(l) : null;
  }

  /** Vendedor: o ritmo dele em cada loja onde tem meta no mês. */
  get meusRitmos(): RitmoVendedor[] {
    if (!this.ritmoMes) return [];
    return this.ritmoMes.linhas.filter(l => (l.meta ?? 0) > 0).map(l => this.calcularRitmo(l));
  }

  /** Gestor: resumo das metas individuais da loja selecionada. */
  get resumoMetasEquipe(): { comMeta: number; metaTotal: number; realizado: number; tendencia: number; foraDoRitmo: number } | null {
    if (!this.ritmoMes) return null;
    const idEmp = Number(this.empresaSelecionada);
    const doSetor = this.setorFiltro ? new Set(this.vendedoresDoSetor.map(v => v.idVendedor)) : null;
    const ritmos = this.ritmoMes.linhas
      .filter(l => l.idEmpresa === idEmp && (l.meta ?? 0) > 0)
      .filter(l => !doSetor || doSetor.has(l.idVendedor))
      .map(l => this.calcularRitmo(l));
    if (!ritmos.length) return null;
    return {
      comMeta: ritmos.length,
      metaTotal: ritmos.reduce((s, r) => s + r.meta, 0),
      realizado: ritmos.reduce((s, r) => s + r.realizado, 0),
      tendencia: ritmos.reduce((s, r) => s + r.tendencia, 0),
      foraDoRitmo: ritmos.filter(r => r.corTendencia === 'danger').length,
    };
  }

  /**
   * Loja de referência: gestor = loja selecionada; vendedor = loja onde tem meta no mês
   * (ou a de maior venda). Usada no nome da loja e na meta de margem.
   */
  get lojaPrincipal(): string {
    if (this.isGestor || !this.ritmoMes?.linhas.length) return this.empresaSelecionada;
    const linhas = [...this.ritmoMes.linhas].sort((a, b) =>
      ((b.meta ?? 0) > 0 ? 1 : 0) - ((a.meta ?? 0) > 0 ? 1 : 0) || b.realizado - a.realizado);
    return String(linhas[0].idEmpresa);
  }

  get temCorte(): boolean { return !!this.ritmoMes?.corte; }

  get nomeMesRitmo(): string { return this.ritmoMes ? MESES[this.ritmoMes.mes] : ''; }

  get rotuloCorte(): string {
    const c = this.ritmoMes?.corte;
    return c ? `${c.slice(8, 10)}/${c.slice(5, 7)}` : '';
  }

  // ─── Navegação gestor ─────────────────────────────────────────────────────
  selecionarVendedor(v: VendedorDados) {
    this.vendedorSelecionado = v;
    this.cdr.detectChanges();
  }

  voltarParaLista() {
    this.vendedorSelecionado = null;
    this.cdr.detectChanges();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────
  /** Data local (não UTC: depois das 21h em Belém o toISOString já vira o dia seguinte). */
  private hoje(): string { return isoLocal(new Date()); }

  iniciais(nome: string): string {
    return nome.split(' ').filter(Boolean).slice(0, 2)
      .map(n => n[0]).join('').toUpperCase();
  }

  moeda(v: number | null | undefined): string {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  moedaK(v: number): string {
    if (v >= 1000) return 'R$ ' + (v / 1000).toFixed(1) + 'k';
    return 'R$ ' + this.moeda(v);
  }

  perc(v: number): string {
    return (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /** Meta de margem da loja (Metas > Por loja), em %. 0 = sem meta cadastrada. */
  metaMargemPerc(idEmpresa: number | string): number {
    return (this.metaMargemLoja.get(Number(idEmpresa)) ?? 0) * 100;
  }

  /** Cor da margem: pela meta da loja quando existe; senão, faixas fixas (20% / 10%). */
  corMargem(m: number, idEmpresa?: number | string): string {
    const meta = idEmpresa != null ? this.metaMargemPerc(idEmpresa) : 0;
    if (meta > 0) {
      if (m >= meta) return 'ok';
      if (m >= meta - 3) return 'warn';
      return 'danger';
    }
    if (m >= 20) return 'ok';
    if (m >= 10) return 'warn';
    return 'danger';
  }

  corDesconto(d: number): string {
    if (d <= 3) return 'ok';
    if (d <= 5) return 'warn';
    return 'danger';
  }

  barraVendedor(v: VendedorDados): number {
    const max = Math.max(...this.vendedoresFiltrados.map(x => x.faturamento), 1);
    // faturamento negativo (devolução maior que a venda no período) = barra vazia
    return Math.max(0, Math.round((v.faturamento / max) * 100));
  }

  nomeEmpresa(id: string | number): string {
    return this.empresas.find(e => String(e.id) === String(id))?.apelido ?? String(id);
  }

  abs(n: number): number { return Math.abs(n); }
}
