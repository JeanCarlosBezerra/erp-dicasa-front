// src/app/pages/comercial/comparativos/comparativos.component.ts
//
// Comparativos (relatório Ana Clara 4.1 e 4.2): período escolhido x mesmo intervalo no mês anterior
// x mesmo intervalo no ano anterior, por loja (geral), por setor e por vendedor.
// Base: GET comercial/comparativo/periodo (loja + vendedor, mesma base validada do Dashboard).
// Setor = departamento do vendedor no fim de cada período.
import { ChangeDetectorRef, Component, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

import { environment } from '../../../../environments/environment';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import { isoLocal } from '../../../services/dias-venda.util';

interface LinhaApi {
  idEmpresa: number;
  idVendedor: number;
  nome: string;
  idDepartamento: number;
  departamento: string;
  faturamento: number;
  lucro: number;
  vendaBruta: number;
  qtdVendas: number;
  devolucoes: number;
}

/** GET comercial/dashboard: indicadores por loja validados (mesmos números do Dashboard). */
interface LojaApi {
  idEmpresa: number;
  faturamento: number;
  lucro: number;
  devolucoes: number;
  descontoValor: number;
  qtdVendas: number;
  vendaBruta: number;
}

interface PeriodoApi {
  dataInicio: string;
  dataFim: string;
  linhas: LinhaApi[];
}

type ChavePeriodo = 'atual' | 'mesAnterior' | 'anoAnterior';
type Visao = 'geral' | 'setor' | 'vendedor';
type Indicador = 'faturamento' | 'lucro' | 'margem' | 'ticket' | 'qtd' | 'devolucoes' | 'descontos' | 'produtividade';

interface Agregado {
  fat: number;
  lucro: number;
  bruto: number;
  qtd: number;
  devol: number;
  desc: number | null;      // só na visão Geral (vem do Dashboard)
  vendedores: Set<number>;
}

interface LinhaComparativo {
  chave: string;
  nome: string;
  sub?: string;
  atual: number | null;
  mesAnterior: number | null;
  anoAnterior: number | null;
  total?: boolean;
}

const INDICADORES: { chave: Indicador; nome: string; tipo: 'moeda' | 'perc' | 'int'; ruimSeSobe?: boolean; soGeral?: boolean; dica: string }[] = [
  { chave: 'faturamento',   nome: 'Faturamento',   tipo: 'moeda', dica: 'Venda líquida (vendas menos devoluções), base do Dashboard.' },
  { chave: 'lucro',         nome: 'Lucratividade', tipo: 'moeda', dica: 'Lucro líquido em R$.' },
  { chave: 'margem',        nome: 'Margem',        tipo: 'perc',  dica: 'Lucro ÷ faturamento. A variação é em pontos percentuais (p.p.).' },
  { chave: 'ticket',        nome: 'Ticket médio',  tipo: 'moeda', dica: 'Venda bruta ÷ quantidade de vendas, igual ao CISS.' },
  { chave: 'qtd',           nome: 'Qtd. de vendas', tipo: 'int',  dica: 'Notas de venda distintas. Por setor e por vendedor, uma nota com 2 vendedores conta para os 2.' },
  { chave: 'devolucoes',    nome: 'Devoluções',    tipo: 'moeda', ruimSeSobe: true, dica: 'Valor devolvido no período (já descontado do faturamento).' },
  { chave: 'descontos',     nome: 'Descontos',     tipo: 'moeda', ruimSeSobe: true, soGeral: true, dica: 'Desconto concedido em R$, igual ao Dashboard. Só na visão Geral.' },
  { chave: 'produtividade', nome: 'Produtividade por vendedor', tipo: 'moeda', dica: 'Faturamento ÷ vendedores com venda no período.' },
];

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** Desloca uma data em N meses. Se a data é o último dia do mês, vira o último dia do mês de destino. */
function deslocarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number);
  const ultimoOrig = new Date(a, m, 0).getDate();
  const alvo = new Date(a, m - 1 + meses, 1);
  const ultimoAlvo = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  const dia = d === ultimoOrig ? ultimoAlvo : Math.min(d, ultimoAlvo);
  return isoLocal(new Date(alvo.getFullYear(), alvo.getMonth(), dia));
}

function novoAgregado(): Agregado {
  return { fat: 0, lucro: 0, bruto: 0, qtd: 0, devol: 0, desc: null, vendedores: new Set<number>() };
}

@Component({
  selector: 'app-comparativos',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatSelectModule, MatFormFieldModule],
  templateUrl: './comparativos.component.html',
  styleUrls: ['./comparativos.component.scss'],
})
export class ComparativosComponent {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  private empresaService = inject(EmpresaService);
  private api = `${environment.apiUrl}/comercial/comparativo`;

  readonly indicadores = INDICADORES;

  empresas: EmpresaLite[] = [];
  lojasSelecionadas: number[] = [];

  dataInicio = '';
  dataFim = '';

  visao: Visao = 'geral';
  indicador: Indicador = 'faturamento';
  buscaVendedor = '';
  setorVendedor = '';   // '' = todos

  dados: Record<ChavePeriodo, PeriodoApi | null> = { atual: null, mesAnterior: null, anoAnterior: null };
  /** Indicadores por loja do Dashboard (visão Geral). null = não carregou; aí a Geral soma os vendedores. */
  dadosLoja: Record<ChavePeriodo, LojaApi[] | null> = { atual: null, mesAnterior: null, anoAnterior: null };
  periodos: Record<ChavePeriodo, { ini: string; fim: string }> | null = null;
  carregando = false;
  etapa = '';
  erros: string[] = [];

  constructor() {
    const hoje = new Date();
    const ontem = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - 1);
    if (hoje.getDate() === 1) {
      // dia 1: ainda não há dia fechado no mês, compara o mês anterior inteiro
      this.dataInicio = isoLocal(new Date(ontem.getFullYear(), ontem.getMonth(), 1));
    } else {
      this.dataInicio = isoLocal(new Date(hoje.getFullYear(), hoje.getMonth(), 1));
    }
    this.dataFim = isoLocal(ontem);

    afterNextRender(() => this.carregarEmpresas());
  }

  // ─── Lojas ────────────────────────────────────────────────────────────────
  private lojasDoToken(): number[] | null {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return null;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const roles: string[] = String(payload.roles ?? '').split(',').map((r: string) => r.trim()).filter(Boolean);
      if (roles.includes('ADMIN')) return null;
      const lojas = roles.filter(r => r.startsWith('COM_EMPRESA_'))
        .map(r => parseInt(r.replace('COM_EMPRESA_', ''), 10)).filter(n => !isNaN(n));
      return lojas.length ? lojas : null;
    } catch {
      return null;
    }
  }

  private carregarEmpresas() {
    const permitidas = this.lojasDoToken();
    this.empresaService.getEmpresas().subscribe({
      next: lista => {
        this.empresas = lista.filter(e => e.id <= 10 && (!permitidas || permitidas.includes(e.id)));
        this.lojasSelecionadas = this.empresas.map(e => e.id);
        this.cdr.detectChanges();
        this.carregar();
      },
      error: () => {
        this.erros = ['Não foi possível carregar as lojas.'];
        this.cdr.detectChanges();
      },
    });
  }

  apelido(id: number): string {
    return this.empresas.find(e => e.id === id)?.apelido ?? `Loja ${id}`;
  }

  get resumoLojas(): string {
    if (this.lojasSelecionadas.length === this.empresas.length) return 'Todas as lojas';
    const nomes = this.lojasSelecionadas.map(id => this.apelido(id));
    return nomes.length <= 3 ? nomes.join(', ') : `${nomes.slice(0, 3).join(', ')} +${nomes.length - 3}`;
  }

  // ─── Carga (um período por vez: uma consulta por vez no CISS) ─────────────
  async carregar() {
    const re = /^\d{4}-\d{2}-\d{2}$/;
    if (!re.test(this.dataInicio) || !re.test(this.dataFim) || this.dataInicio > this.dataFim) {
      this.erros = ['Período inválido.'];
      this.cdr.detectChanges();
      return;
    }
    const periodos: Record<ChavePeriodo, { ini: string; fim: string }> = {
      atual:       { ini: this.dataInicio, fim: this.dataFim },
      mesAnterior: { ini: deslocarMeses(this.dataInicio, -1),  fim: deslocarMeses(this.dataFim, -1) },
      anoAnterior: { ini: deslocarMeses(this.dataInicio, -12), fim: deslocarMeses(this.dataFim, -12) },
    };
    this.periodos = periodos;
    this.dados = { atual: null, mesAnterior: null, anoAnterior: null };
    this.dadosLoja = { atual: null, mesAnterior: null, anoAnterior: null };
    this.erros = [];
    this.carregando = true;

    const nomes: Record<ChavePeriodo, string> = { atual: 'período atual', mesAnterior: 'mês anterior', anoAnterior: 'ano anterior' };
    for (const chave of ['atual', 'mesAnterior', 'anoAnterior'] as ChavePeriodo[]) {
      if (this.periodos !== periodos) return;   // usuário pediu outro período no meio
      this.etapa = `Carregando ${nomes[chave]}...`;
      this.cdr.detectChanges();
      try {
        const params = new HttpParams().set('dataInicio', periodos[chave].ini).set('dataFim', periodos[chave].fim);
        const r = await firstValueFrom(this.http.get<PeriodoApi>(`${this.api}/periodo`, { params }));
        if (this.periodos !== periodos) return;
        this.dados[chave] = {
          ...r,
          linhas: (r?.linhas ?? []).map(l => ({
            ...l,
            idEmpresa: Number(l.idEmpresa),
            idVendedor: Number(l.idVendedor),
            idDepartamento: Number(l.idDepartamento),
            faturamento: Number(l.faturamento) || 0,
            lucro: Number(l.lucro) || 0,
            vendaBruta: Number(l.vendaBruta) || 0,
            qtdVendas: Number(l.qtdVendas) || 0,
            devolucoes: Number(l.devolucoes) || 0,
          })),
        };
      } catch (e: any) {
        if (this.periodos !== periodos) return;
        const msg = e?.error?.message ?? 'erro na consulta';
        this.erros.push(`Não foi possível carregar o ${nomes[chave]} (${msg}).`);
      }
      this.cdr.detectChanges();

      // indicadores por loja do Dashboard (ticket, qtd. de vendas e descontos exatos por loja)
      try {
        const params = new HttpParams().set('dataInicio', periodos[chave].ini).set('dataFim', periodos[chave].fim);
        const r = await firstValueFrom(this.http.get<LojaApi[]>(`${environment.apiUrl}/comercial/dashboard`, { params }));
        if (this.periodos !== periodos) return;
        this.dadosLoja[chave] = (r ?? []).map(l => ({
          idEmpresa: Number(l.idEmpresa),
          faturamento: Number(l.faturamento) || 0,
          lucro: Number(l.lucro) || 0,
          devolucoes: Number(l.devolucoes) || 0,
          descontoValor: Number(l.descontoValor) || 0,
          qtdVendas: Number(l.qtdVendas) || 0,
          vendaBruta: Number(l.vendaBruta) || 0,
        }));
      } catch {
        if (this.periodos !== periodos) return;
        this.dadosLoja[chave] = null;   // a Geral usa a soma dos vendedores
      }
      this.cdr.detectChanges();
    }
    this.carregando = false;
    this.etapa = '';
    this.cdr.detectChanges();
  }

  rotuloPeriodo(chave: ChavePeriodo): string {
    const p = this.periodos?.[chave];
    if (!p) return '';
    const f = (iso: string) => `${iso.slice(8, 10)}/${MESES[Number(iso.slice(5, 7)) - 1]}/${iso.slice(2, 4)}`;
    return `${f(p.ini)} a ${f(p.fim)}`;
  }

  // ─── Agregação ────────────────────────────────────────────────────────────
  private linhasDe(chave: ChavePeriodo): LinhaApi[] {
    const lojas = new Set(this.lojasSelecionadas);
    return (this.dados[chave]?.linhas ?? []).filter(l => lojas.has(l.idEmpresa));
  }

  private agrupar(chave: ChavePeriodo, chaveDe: (l: LinhaApi) => string | null): Map<string, Agregado> {
    const mapa = new Map<string, Agregado>();
    for (const l of this.linhasDe(chave)) {
      const k = chaveDe(l);
      if (k == null) continue;
      const a = mapa.get(k) ?? novoAgregado();
      a.fat += l.faturamento;
      a.lucro += l.lucro;
      a.bruto += l.vendaBruta;
      a.qtd += l.qtdVendas;
      a.devol += l.devolucoes;
      if (l.idVendedor > 0 && l.faturamento > 0) a.vendedores.add(l.idVendedor);
      mapa.set(k, a);
    }
    return mapa;
  }

  /** Geral: loja pelo Dashboard (exato) + quantos vendedores venderam (para a produtividade). */
  private agruparLojas(chave: ChavePeriodo, tudoJunto: boolean): Map<string, Agregado> | null {
    const lojasApi = this.dadosLoja[chave];
    if (!lojasApi) return null;
    const sel = new Set(this.lojasSelecionadas);
    const vendedores = this.agrupar(chave, l => (tudoJunto ? 'total' : String(l.idEmpresa)));
    const mapa = new Map<string, Agregado>();
    for (const l of lojasApi) {
      if (!sel.has(l.idEmpresa)) continue;
      const k = tudoJunto ? 'total' : String(l.idEmpresa);
      const a = mapa.get(k) ?? novoAgregado();
      a.fat += l.faturamento;
      a.lucro += l.lucro;
      a.bruto += l.vendaBruta;
      a.qtd += l.qtdVendas;
      a.devol += Math.abs(l.devolucoes);
      a.desc = (a.desc ?? 0) + l.descontoValor;
      a.vendedores = vendedores.get(k)?.vendedores ?? new Set<number>();
      mapa.set(k, a);
    }
    return mapa;
  }

  private valor(a: Agregado | undefined, ind: Indicador): number | null {
    if (!a) return null;
    switch (ind) {
      case 'faturamento':   return a.fat;
      case 'lucro':         return a.lucro;
      case 'margem':        return a.fat ? (a.lucro / a.fat) * 100 : null;
      case 'ticket':        return a.qtd ? a.bruto / a.qtd : null;
      case 'qtd':           return a.qtd;
      case 'devolucoes':    return Math.abs(a.devol);
      case 'descontos':     return a.desc;
      case 'produtividade': return a.vendedores.size ? a.fat / a.vendedores.size : null;
    }
  }

  get indicadorAtual() {
    return INDICADORES.find(i => i.chave === this.indicador)!;
  }

  /** Setores do período atual (para o filtro da visão por vendedor). */
  get setoresAtual(): { id: number; nome: string }[] {
    const mapa = new Map<number, string>();
    for (const l of this.linhasDe('atual')) if (l.idVendedor > 0) mapa.set(l.idDepartamento, l.departamento);
    return [...mapa.entries()].map(([id, nome]) => ({ id, nome }))
      .sort((a, b) => (a.id === -1 ? 1 : 0) - (b.id === -1 ? 1 : 0) || a.nome.localeCompare(b.nome));
  }

  get linhas(): LinhaComparativo[] {
    if (!this.periodos) return [];
    const ind = this.indicador;
    const chaves: ChavePeriodo[] = ['atual', 'mesAnterior', 'anoAnterior'];

    let chaveDe: (l: LinhaApi) => string | null;
    const nomes = new Map<string, { nome: string; sub?: string }>();
    if (this.visao === 'geral') {
      chaveDe = l => String(l.idEmpresa);
      // só lojas com venda em algum dos períodos (esconde lojas fechadas, ex.: 4, 5, 7, 9)
      const comDado = new Set<number>();
      for (const c of chaves) {
        for (const l of this.linhasDe(c)) comDado.add(l.idEmpresa);
        for (const l of this.dadosLoja[c] ?? []) if (l.faturamento || l.qtdVendas) comDado.add(l.idEmpresa);
      }
      for (const id of this.lojasSelecionadas) if (comDado.has(id)) nomes.set(String(id), { nome: this.apelido(id) });
    } else if (this.visao === 'setor') {
      chaveDe = l => (l.idVendedor > 0 ? String(l.idDepartamento) : 'sem-vendedor');
    } else {
      const q = this.buscaVendedor.trim().toLowerCase();
      // filtro de setor e busca valem pelo cadastro do período atual
      const doSetor = new Set(this.linhasDe('atual')
        .filter(l => !this.setorVendedor || String(l.idDepartamento) === this.setorVendedor)
        .map(l => l.idVendedor));
      chaveDe = l => {
        if (l.idVendedor <= 0) return null;
        if (this.setorVendedor && !doSetor.has(l.idVendedor)) return null;
        if (q && !l.nome.toLowerCase().includes(q)) return null;
        return String(l.idVendedor);
      };
    }

    const grupos = {} as Record<ChavePeriodo, Map<string, Agregado>>;
    for (const c of chaves) {
      grupos[c] = (this.visao === 'geral' ? this.agruparLojas(c, false) : null) ?? this.agrupar(c, chaveDe);
    }
    // nomes: o mais recente vence (o atual é o último a gravar)
    for (const c of [...chaves].reverse()) {
      for (const l of this.linhasDe(c)) {
        const k = chaveDe(l);
        if (k == null) continue;
        if (this.visao === 'setor') {
          nomes.set(k, { nome: k === 'sem-vendedor' ? 'Vendas sem vendedor' : (l.departamento || 'Sem departamento') });
        } else if (this.visao === 'vendedor') {
          nomes.set(k, { nome: l.nome, sub: `${l.idVendedor} · ${l.departamento}` });
        }
      }
    }

    const todasChaves = new Set<string>([...nomes.keys()]);
    if (this.visao !== 'geral') for (const c of chaves) for (const k of grupos[c].keys()) todasChaves.add(k);

    const linhas: LinhaComparativo[] = [...todasChaves].map(k => ({
      chave: k,
      nome: nomes.get(k)?.nome ?? k,
      sub: nomes.get(k)?.sub,
      atual: this.dados.atual ? this.valor(grupos.atual.get(k), ind) ?? (this.visao === 'geral' ? 0 : null) : null,
      mesAnterior: this.dados.mesAnterior ? this.valor(grupos.mesAnterior.get(k), ind) : null,
      anoAnterior: this.dados.anoAnterior ? this.valor(grupos.anoAnterior.get(k), ind) : null,
    }));
    linhas.sort((a, b) => (b.atual ?? -Infinity) - (a.atual ?? -Infinity) || a.nome.localeCompare(b.nome));

    // total (geral e setor): soma de tudo das lojas selecionadas
    if (this.visao !== 'vendedor') {
      const tot = (c: ChavePeriodo) => {
        if (!this.dados[c]) return null;
        const porLoja = this.visao === 'geral' ? this.agruparLojas(c, true) : null;
        return this.valor((porLoja ?? this.agrupar(c, () => 'total')).get('total') ?? novoAgregado(), ind);
      };
      linhas.push({ chave: 'total', nome: 'Total', atual: tot('atual'), mesAnterior: tot('mesAnterior'), anoAnterior: tot('anoAnterior'), total: true });
    }
    return linhas;
  }

  // ─── Formatação ───────────────────────────────────────────────────────────
  fmt(v: number | null): string {
    if (v == null) return '—';
    const t = this.indicadorAtual.tipo;
    if (t === 'perc') return v.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
    if (t === 'int') return Math.round(v).toLocaleString('pt-BR');
    return 'R$ ' + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /** Variação do atual contra a base: % (ou p.p. na margem). */
  variacao(atual: number | null, base: number | null): { texto: string; classe: string } {
    if (atual == null || base == null) return { texto: '—', classe: '' };
    const ruimSeSobe = !!this.indicadorAtual.ruimSeSobe;
    let delta: number;
    let texto: string;
    if (this.indicadorAtual.tipo === 'perc') {
      delta = atual - base;
      texto = `${delta >= 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p.`;
    } else {
      if (!base) return { texto: atual ? 'novo' : '—', classe: '' };
      delta = ((atual - base) / Math.abs(base)) * 100;
      texto = `${delta >= 0 ? '+' : ''}${delta.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    }
    const bom = ruimSeSobe ? delta < 0 : delta > 0;
    const classe = Math.abs(delta) < 0.05 ? '' : (bom ? 'ok' : 'bad');
    return { texto, classe };
  }

  trocarVisao(v: Visao) {
    this.visao = v;
    if (v === 'vendedor' && this.indicador === 'produtividade') this.indicador = 'faturamento';
    if (v !== 'geral' && this.indicadorAtual.soGeral) this.indicador = 'faturamento';
    this.cdr.detectChanges();
  }

  atualizar() {
    this.cdr.detectChanges();
  }
}
