// src/app/settings/inadimplencia-config/inadimplencia-config.component.ts
//
// Configurações > Inadimplência (CFG_INADIMPLENCIA):
//   destinatários do consolidado, prévia (sem enviar), envio manual e histórico.
import { ChangeDetectorRef, Component, DestroyRef, PLATFORM_ID, afterNextRender, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { EmpresaService, EmpresaLite } from '../../services/empresa.service';
import {
  DestinatarioInad, DestinatarioInadPayload, Envio, Execucao, InadimplenciaService, Previa,
} from '../../services/inadimplencia.service';

interface Mensagem { tipo: 'ok' | 'aviso' | 'erro'; texto: string; }

@Component({
  selector: 'app-inadimplencia-config',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './inadimplencia-config.component.html',
  styleUrls: ['./inadimplencia-config.component.scss'],
})
export class InadimplenciaConfigComponent {
  private svc = inject(InadimplenciaService);
  private empresaSvc = inject(EmpresaService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);
  private destroyRef = inject(DestroyRef);

  empresas: EmpresaLite[] = [];
  modoTeste = true;
  mensagem: Mensagem | null = null;

  // Destinatários
  destinatarios: DestinatarioInad[] = [];
  novo: DestinatarioInadPayload = { nome: '', email: '', id_empresa: null, ativo: true };
  editandoId: number | null = null;
  edicao: DestinatarioInadPayload = { nome: '', email: '', id_empresa: null, ativo: true };
  salvando = false;
  testandoId: number | null = null;

  // Prévia
  previa: Previa | null = null;
  carregandoPrevia = false;
  filtroPrevia: 'todos' | 'semEmail' = 'todos';

  // Envio
  confirmandoEnvio = false;
  enviando = false;
  /** Execução disparada nesta tela, acompanhada até terminar. */
  acompanhando: Execucao | null = null;
  private timer?: ReturnType<typeof setInterval>;

  // Histórico
  execucoes: Execucao[] = [];
  abertaId: number | null = null;
  envios: Envio[] = [];
  carregandoEnvios = false;

  constructor() {
    this.destroyRef.onDestroy(() => this.pararAcompanhamento());
    afterNextRender(() => {
      this.empresaSvc.getEmpresas().subscribe((e) => { this.empresas = e; this.cdr.detectChanges(); });
      this.carregarDestinatarios();
      this.carregarHistorico();
    });
  }

  // ── Destinatários ──

  carregarDestinatarios(): void {
    this.svc.listarDestinatarios().subscribe({
      next: (r) => { this.destinatarios = r.destinatarios; this.modoTeste = r.modoTeste; this.cdr.detectChanges(); },
      error: (e) => this.erro(e, 'Não foi possível carregar os destinatários.'),
    });
  }

  adicionar(): void {
    this.salvando = true;
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.criarDestinatario(this.normalizar(this.novo)).subscribe({
      next: (d) => {
        this.salvando = false;
        this.novo = { nome: '', email: '', id_empresa: null, ativo: true };
        this.ok(`${d.nome} adicionado(a).`);
        this.carregarDestinatarios();
      },
      error: (e) => { this.salvando = false; this.erro(e, 'Não foi possível adicionar.'); },
    });
  }

  editar(d: DestinatarioInad): void {
    this.editandoId = d.id;
    this.edicao = { nome: d.nome, email: d.email, id_empresa: d.id_empresa, ativo: d.ativo };
    this.cdr.detectChanges();
  }

  cancelarEdicao(): void { this.editandoId = null; this.cdr.detectChanges(); }

  salvarEdicao(id: number): void {
    this.salvando = true;
    this.cdr.detectChanges();
    this.svc.atualizarDestinatario(id, this.normalizar(this.edicao)).subscribe({
      next: () => { this.salvando = false; this.editandoId = null; this.ok('Destinatário atualizado.'); this.carregarDestinatarios(); },
      error: (e) => { this.salvando = false; this.erro(e, 'Não foi possível salvar.'); },
    });
  }

  alternarAtivo(d: DestinatarioInad): void {
    this.svc.atualizarDestinatario(d.id, { nome: d.nome, email: d.email, id_empresa: d.id_empresa, ativo: !d.ativo }).subscribe({
      next: () => this.carregarDestinatarios(),
      error: (e) => this.erro(e, 'Não foi possível alterar.'),
    });
  }

  remover(d: DestinatarioInad): void {
    if (isPlatformBrowser(this.platformId) && !window.confirm(`Remover ${d.nome} (${d.email})?`)) return;
    this.svc.removerDestinatario(d.id).subscribe({
      next: () => { this.ok(`${d.nome} removido(a).`); this.carregarDestinatarios(); },
      error: (e) => this.erro(e, 'Não foi possível remover.'),
    });
  }

  testar(d: DestinatarioInad): void {
    this.testandoId = d.id;
    this.cdr.detectChanges();
    this.svc.testarDestinatario(d.id).subscribe({
      next: (r) => {
        this.testandoId = null;
        this.ok(`E-mail de teste enviado para ${r.destinatarios.join(', ')}${r.modoTeste ? ' (modo teste)' : ''}.`);
      },
      error: (e) => { this.testandoId = null; this.erro(e, 'Falha no e-mail de teste.'); },
    });
  }

  private normalizar(d: DestinatarioInadPayload): DestinatarioInadPayload {
    const emp = d.id_empresa as unknown;
    return {
      nome: (d.nome || '').trim(),
      email: (d.email || '').trim().toLowerCase(),
      id_empresa: emp === null || emp === '' || emp === undefined ? null : Number(emp),
      ativo: d.ativo,
    };
  }

  rotuloLoja(id: number | null): string {
    if (!id) return 'Todas as lojas';
    const e = this.empresas.find((x) => x.id === id);
    return e ? `${e.id} · ${e.apelido}` : `Loja ${id}`;
  }

  // ── Prévia ──

  gerarPrevia(): void {
    this.carregandoPrevia = true;
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.previa().subscribe({
      next: (p) => { this.previa = p; this.modoTeste = p.modoTeste; this.carregandoPrevia = false; this.cdr.detectChanges(); },
      error: (e) => { this.carregandoPrevia = false; this.erro(e, 'Não foi possível gerar a prévia.'); },
    });
  }

  get vendedoresPrevia() {
    const l = this.previa?.vendedores ?? [];
    return this.filtroPrevia === 'semEmail' ? l.filter((v) => !v.email) : l;
  }

  get qtdSemEmail(): number { return (this.previa?.vendedores ?? []).filter((v) => !v.email).length; }
  get qtdComEmail(): number { return (this.previa?.vendedores ?? []).filter((v) => !!v.email).length; }

  /** Lista para o T.I. cobrar a atualização do cadastro. */
  copiarSemEmail(): void {
    if (!isPlatformBrowser(this.platformId) || !this.previa) return;
    const linhas = this.previa.vendedores.filter((v) => !v.email)
      .map((v) => `${v.idVendedor}\t${v.vendedor}\t${v.motivoSemEmail ?? ''}`);
    const texto = ['Código\tVendedor\tMotivo', ...linhas].join('\n');
    navigator.clipboard?.writeText(texto).then(
      () => this.ok(`Lista de ${linhas.length} vendedores sem e-mail copiada. Cole no Excel ou na mensagem para o T.I.`),
      () => this.erro(null, 'Não foi possível copiar. Use o Excel da prévia.'),
    );
  }

  // ── Envio manual ──

  pedirEnvio(): void { this.confirmandoEnvio = true; this.cdr.detectChanges(); }
  cancelarEnvio(): void { this.confirmandoEnvio = false; this.cdr.detectChanges(); }

  enviar(): void {
    this.enviando = true;
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.enviarAgora().subscribe({
      next: (r) => {
        this.confirmandoEnvio = false;
        this.mensagem = { tipo: 'aviso', texto: `Envio ${r.idExecucao} iniciado${r.modoTeste ? ' em MODO TESTE' : ''}. Acompanhe abaixo; pode levar alguns minutos.` };
        this.acompanhar(r.idExecucao);
      },
      error: (e) => { this.enviando = false; this.confirmandoEnvio = false; this.erro(e, 'Não foi possível iniciar o envio.'); this.carregarHistorico(); },
    });
  }

  /** Consulta o histórico a cada 5 s até a execução terminar. */
  private acompanhar(id: number): void {
    this.pararAcompanhamento();
    const checar = () => this.svc.historico(20).subscribe({
      next: (h) => {
        this.execucoes = h;
        this.acompanhando = h.find((x) => x.id === id) ?? this.acompanhando;
        if (this.acompanhando && this.acompanhando.status !== 'EXECUTANDO') {
          this.pararAcompanhamento();
          this.enviando = false;
          const ex = this.acompanhando;
          if (ex.status === 'CONCLUIDO') this.ok(`Envio ${ex.id} concluído${ex.modo_teste ? ' (modo teste)' : ''}.`);
          else this.mensagem = { tipo: 'erro', texto: `Envio ${ex.id} falhou: ${ex.erro ?? 'sem detalhe'}` };
        }
        this.cdr.detectChanges();
      },
    });
    checar();
    this.timer = setInterval(checar, 5000);
  }

  private pararAcompanhamento(): void {
    if (this.timer) { clearInterval(this.timer); this.timer = undefined; }
  }

  // ── Histórico ──

  carregarHistorico(): void {
    this.svc.historico(20).subscribe({
      next: (h) => { this.execucoes = h; this.cdr.detectChanges(); },
      error: () => { /* histórico é secundário: não polui a tela */ },
    });
  }

  abrirExecucao(ex: Execucao): void {
    if (this.abertaId === ex.id) { this.abertaId = null; this.cdr.detectChanges(); return; }
    this.abertaId = ex.id;
    this.envios = [];
    this.carregandoEnvios = true;
    this.cdr.detectChanges();
    this.svc.envios(ex.id).subscribe({
      next: (l) => { this.envios = l; this.carregandoEnvios = false; this.cdr.detectChanges(); },
      error: (e) => { this.carregandoEnvios = false; this.erro(e, 'Não foi possível carregar os envios.'); },
    });
  }

  // ── Util ──

  moeda(v: number | string | null): string {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  dataHora(iso: string | null): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Belem', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  private ok(texto: string): void { this.mensagem = { tipo: 'ok', texto }; this.cdr.detectChanges(); }

  private erro(e: unknown, padrao: string): void {
    const err = e as HttpErrorResponse;
    let texto = padrao;
    if (err?.status === 403) texto = 'Você não tem permissão para esta ação. Se a permissão foi liberada agora, saia e entre de novo no sistema.';
    else if (err?.error?.message) texto = Array.isArray(err.error.message) ? err.error.message.join(' ') : String(err.error.message);
    this.mensagem = { tipo: 'erro', texto };
    this.cdr.detectChanges();
  }
}
