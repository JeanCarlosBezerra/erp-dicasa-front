// src/app/settings/premiacao-destinatarios/premiacao-destinatarios.component.ts
import { Component, ChangeDetectorRef, afterNextRender, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import {
  Destinatario, DestinatarioPayload, InfoEmail, PremiacaoDestinatariosService, TipoDestinatario,
} from '../../services/premiacao-destinatarios.service';

interface Mensagem { tipo: 'ok' | 'erro'; texto: string; }
interface Linha extends Destinatario { _orig: string; }

@Component({
  selector: 'app-premiacao-destinatarios',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule],
  templateUrl: './premiacao-destinatarios.component.html',
  styleUrl: './premiacao-destinatarios.component.scss',
})
export class PremiacaoDestinatariosComponent {
  private svc = inject(PremiacaoDestinatariosService);
  private cdr = inject(ChangeDetectorRef);

  readonly tipos: { v: TipoDestinatario; n: string }[] = [
    { v: 'AMBOS', n: 'Vendedores e gestores' },
    { v: 'VENDEDOR', n: 'Só vendedores' },
    { v: 'GESTOR', n: 'Só gestores' },
  ];

  linhas: Linha[] = [];
  info: InfoEmail | null = null;
  carregando = false;
  ocupadoId: number | 'novo' | null = null;
  mensagem: Mensagem | null = null;

  novo: DestinatarioPayload = { nome: '', email: '', tipo: 'AMBOS', ativo: true };

  constructor() {
    afterNextRender(() => this.carregar());
  }

  get qtdAtivos(): number { return this.linhas.filter((l) => l.ativo).length; }

  carregar(): void {
    this.carregando = true;
    this.cdr.detectChanges();
    this.svc.listar().subscribe({
      next: (r) => {
        this.linhas = r.destinatarios.map((d) => this.paraLinha(d));
        this.info = r.email;
        this.carregando = false;
        this.cdr.detectChanges();
      },
      error: (e) => {
        this.carregando = false;
        this.erro(e, 'Não foi possível carregar os destinatários.');
      },
    });
  }

  adicionar(): void {
    this.ocupadoId = 'novo';
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.criar(this.novo).subscribe({
      next: (d) => {
        this.linhas = [...this.linhas, this.paraLinha(d)];
        this.novo = { nome: '', email: '', tipo: 'AMBOS', ativo: true };
        this.ocupadoId = null;
        this.ok(`${d.nome} adicionado(a).`);
      },
      error: (e) => { this.ocupadoId = null; this.erro(e, 'Não foi possível adicionar.'); },
    });
  }

  alterado(l: Linha): boolean {
    return l._orig !== this.assinatura(l);
  }

  salvar(l: Linha): void {
    this.ocupadoId = l.id;
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.atualizar(l.id, { nome: l.nome, email: l.email, tipo: l.tipo, ativo: l.ativo }).subscribe({
      next: (d) => {
        this.linhas = this.linhas.map((x) => (x.id === d.id ? this.paraLinha(d) : x));
        this.ocupadoId = null;
        this.ok(`${d.nome} atualizado(a).`);
      },
      error: (e) => { this.ocupadoId = null; this.erro(e, 'Não foi possível salvar.'); },
    });
  }

  remover(l: Linha): void {
    if (!window.confirm(`Remover ${l.nome} (${l.email}) da lista de destinatários?`)) return;
    this.ocupadoId = l.id;
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.remover(l.id).subscribe({
      next: () => {
        this.linhas = this.linhas.filter((x) => x.id !== l.id);
        this.ocupadoId = null;
        this.ok(`${l.nome} removido(a).`);
      },
      error: (e) => { this.ocupadoId = null; this.erro(e, 'Não foi possível remover.'); },
    });
  }

  testar(l: Linha): void {
    this.ocupadoId = l.id;
    this.mensagem = null;
    this.cdr.detectChanges();
    this.svc.enviarTeste(l.id).subscribe({
      next: (r) => {
        this.ocupadoId = null;
        this.ok(`E-mail de teste enviado para ${r.destinatarios.join(', ')}${r.modoTeste ? ' (modo teste: foi para o endereço de teste, não para o destinatário)' : ''}.`);
      },
      error: (e) => { this.ocupadoId = null; this.erro(e, 'Falha no envio do teste.'); },
    });
  }

  rotuloTipo(t: TipoDestinatario): string {
    return this.tipos.find((x) => x.v === t)?.n ?? t;
  }

  private paraLinha(d: Destinatario): Linha {
    const l = { ...d } as Linha;
    l._orig = this.assinatura(l);
    return l;
  }

  private assinatura(d: Destinatario): string {
    return [d.nome, d.email, d.tipo, d.ativo].join('|');
  }

  private ok(texto: string): void {
    this.mensagem = { tipo: 'ok', texto };
    this.cdr.detectChanges();
  }

  private erro(e: unknown, padrao: string): void {
    const err = e as HttpErrorResponse;
    let texto = padrao;
    if (err?.status === 403) texto = 'Você não tem permissão para esta tela. Se foi liberada agora, saia e entre de novo.';
    else {
      const m = err?.error?.message;
      if (Array.isArray(m)) texto = m.join(' ');
      else if (typeof m === 'string' && m) texto = m;
    }
    this.mensagem = { tipo: 'erro', texto };
    this.cdr.detectChanges();
  }
}