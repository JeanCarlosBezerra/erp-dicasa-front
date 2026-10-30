// Barra de confirmação usada nas abas Vendedores e Gestores.
// Pasta: ao lado de premiacao-vendedor/ e premiacao-gestor/ (mesma profundidade).
import {
  ChangeDetectorRef, Component, EventEmitter, Input, OnChanges, Output,
  PLATFORM_ID, SimpleChanges, inject,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { PremiacaoService } from '../../../../services/premiacao.service';
import { AuthService } from '../../../../services/auth.service';
import {
  ConfirmacaoInfo, StatusCompetencia, TipoPremiacao,
} from '../../../../models/premiacao-confirmacao.model';

type Modo = 'nenhum' | 'confirmar' | 'reabrir';
interface Mensagem { tipo: 'ok' | 'aviso' | 'erro'; texto: string; }

@Component({
  selector: 'app-premiacao-confirmacao-bar',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatIconModule, MatTooltipModule],
  templateUrl: './premiacao-confirmacao-bar.component.html',
  styleUrl: './premiacao-confirmacao-bar.component.scss',  
})
export class PremiacaoConfirmacaoBarComponent implements OnChanges {
  private svc = inject(PremiacaoService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  /** Competência que está NA TELA (a carregada pelo Filtrar, não a selecionada no combo). */
  @Input({ required: true }) tipo!: TipoPremiacao;
  @Input({ required: true }) mes!: number;
  @Input({ required: true }) ano!: number;
  @Input() totalPremiacao = 0;
  @Input() qtdPremiados = 0;
  @Input() semDados = false;

  /** Avisa a tela para recarregar a tabela depois de confirmar ou reabrir. */
  @Output() alterado = new EventEmitter<void>();

  readonly podeConfirmar = this.auth.hasRole('COM_PREMIACAO_CONFIRMAR');
  readonly podeReabrir = this.auth.hasRole('COM_PREMIACAO_REABRIR');

  readonly nomesMes = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  status: StatusCompetencia | null = null;
  carregandoStatus = false;
  processando = false;
  modo: Modo = 'nenhum';
  motivo = '';
  mensagem: Mensagem | null = null;

  private seq = 0; // descarta respostas atrasadas quando o período muda rápido

  get rotuloTipo(): string { return this.tipo === 'VENDEDOR' ? 'vendedores' : 'gestores'; }
  get competencia(): string { return `${this.nomesMes[(this.mes ?? 1) - 1]}/${this.ano}`; }

  ngOnChanges(ch: SimpleChanges): void {
    if (ch['tipo'] || ch['mes'] || ch['ano']) {
      this.modo = 'nenhum';
      this.motivo = '';
      this.mensagem = null;
      this.carregarStatus();
    }
  }

  carregarStatus(): void {
    if (!isPlatformBrowser(this.platformId) || !this.tipo || !this.mes || !this.ano) return;
    const meuSeq = ++this.seq;
    this.carregandoStatus = true;

    this.svc.getStatusConfirmacao(this.tipo, this.mes, this.ano).subscribe({
      next: (s) => {
        if (meuSeq !== this.seq) return;
        this.status = s;
        this.carregandoStatus = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        if (meuSeq !== this.seq) return;
        this.status = null;
        this.carregandoStatus = false;
        this.mensagem = { tipo: 'erro', texto: this.msgErro(e, 'Não foi possível consultar a situação da competência.') };
        this.cdr.detectChanges();
      },
    });
  }

  abrir(modo: Modo): void {
    this.modo = modo;
    this.motivo = '';
    this.mensagem = null;
    this.cdr.detectChanges();
  }

  cancelar(): void {
    this.modo = 'nenhum';
    this.motivo = '';
    this.cdr.detectChanges();
  }

  confirmar(): void {
    this.processando = true;
    this.mensagem = null;
    this.cdr.detectChanges();

    this.svc.confirmarValores(this.tipo, this.mes, this.ano).subscribe({
      next: (r) => {
        this.status = r.status;
        this.modo = 'nenhum';
        this.processando = false;
        const teste = r.email.modoTeste ? ' (modo teste)' : '';
        this.mensagem = r.email.status === 'ENVIADO'
          ? { tipo: 'ok', texto: `Valores confirmados e travados. PDF enviado para ${r.email.destinatarios.join(', ')}${teste}.` }
          : { tipo: 'aviso', texto: `Valores confirmados e travados, mas o e-mail não saiu: ${r.email.erro ?? 'erro desconhecido'}. Use "Reenviar e-mail".` };
        this.alterado.emit();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.processando = false;
        this.mensagem = { tipo: 'erro', texto: this.msgErro(e, 'Não foi possível confirmar os valores.') };
        this.carregarStatus(); // pode ter sido confirmado por outra pessoa
        this.cdr.detectChanges();
      },
    });
  }

  reabrir(): void {
    const motivo = this.motivo.trim();
    if (motivo.length < 10) {
      this.mensagem = { tipo: 'erro', texto: 'Descreva o motivo da reabertura (mínimo de 10 caracteres).' };
      this.cdr.detectChanges();
      return;
    }

    this.processando = true;
    this.mensagem = null;
    this.cdr.detectChanges();

    this.svc.reabrirCompetencia(this.tipo, this.mes, this.ano, motivo).subscribe({
      next: (s) => {
        this.status = s;
        this.modo = 'nenhum';
        this.motivo = '';
        this.processando = false;
        this.mensagem = { tipo: 'aviso', texto: 'Competência reaberta. Os valores voltam a ser calculados ao vivo e o RH foi avisado de que o PDF anterior foi cancelado.' };
        this.alterado.emit();
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.processando = false;
        this.mensagem = { tipo: 'erro', texto: this.msgErro(e, 'Não foi possível reabrir a competência.') };
        this.cdr.detectChanges();
      },
    });
  }

  reenviar(): void {
    this.processando = true;
    this.mensagem = null;
    this.cdr.detectChanges();

    this.svc.reenviarEmail(this.tipo, this.mes, this.ano).subscribe({
      next: (r) => {
        this.status = r.status;
        this.processando = false;
        const teste = r.email.modoTeste ? ' (modo teste)' : '';
        this.mensagem = r.email.status === 'ENVIADO'
          ? { tipo: 'ok', texto: `E-mail reenviado para ${r.email.destinatarios.join(', ')}${teste}.` }
          : { tipo: 'erro', texto: `O e-mail não saiu: ${r.email.erro ?? 'erro desconhecido'}.` };
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.processando = false;
        this.mensagem = { tipo: 'erro', texto: this.msgErro(e, 'Não foi possível reenviar o e-mail.') };
        this.cdr.detectChanges();
      },
    });
  }

  rotuloEmail(c: ConfirmacaoInfo): string {
    if (c.emailStatus === 'ENVIADO') return `enviado para ${c.emailDestinatarios ?? ''}`;
    if (c.emailStatus === 'FALHA') return `falhou (${c.emailErro ?? 'sem detalhe'})`;
    return 'pendente';
  }

  get tooltipConfirmar(): string {
    if (!this.status?.competenciaEncerrada) return 'Disponível após o fim do mês.';
    if (this.semDados) return 'Não há dados carregados para esta competência.';
    return 'Grava e trava os valores e envia o PDF oficial ao RH.';
  }

  private msgErro(e: unknown, padrao: string): string {
    const err = e as HttpErrorResponse;
    if (err?.status === 403) return 'Você não tem permissão para esta ação. Se a permissão foi liberada agora, saia e entre de novo no sistema.';
    const m = err?.error?.message;
    if (Array.isArray(m)) return m.join(' ');
    return (typeof m === 'string' && m) ? m : padrao;
  }
}