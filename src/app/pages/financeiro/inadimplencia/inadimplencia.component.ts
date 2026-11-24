// src/app/pages/financeiro/inadimplencia/inadimplencia.component.ts
//
// Clientes em atraso.
//   * Vendedor (FIN_INADIMPLENCIA): vê só os títulos das vendas dele.
//   * Gestor (FIN_INADIMPLENCIA_GESTOR): vê as lojas dele, com resumo por vendedor.
import { ChangeDetectorRef, Component, PLATFORM_ID, afterNextRender, inject } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Observable } from 'rxjs';
import { AuthService } from '../../../services/auth.service';
import { EmpresaService, EmpresaLite } from '../../../services/empresa.service';
import {
  InadimplenciaService, ResumoInad, TituloInadimplente, VendedorResumo,
} from '../../../services/inadimplencia.service';

type Visao = 'minha' | 'equipe';
type Ordem = 'atraso' | 'valor';

@Component({
  selector: 'app-inadimplencia',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatSelectModule, MatInputModule, MatTooltipModule,
  ],
  templateUrl: './inadimplencia.component.html',
  styleUrls: ['./inadimplencia.component.scss'],
})
export class InadimplenciaComponent {
  private svc = inject(InadimplenciaService);
  private empresaSvc = inject(EmpresaService);
  private auth = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  readonly ehVendedor = this.auth.hasRole('FIN_INADIMPLENCIA');
  readonly ehGestor = this.auth.hasRole('FIN_INADIMPLENCIA_GESTOR');

  visao: Visao = this.ehGestor ? 'equipe' : 'minha';
  empresas: EmpresaLite[] = [];
  empresasSelecionadas: number[] = [];

  carregando = false;
  exportando = false;
  erro: string | null = null;
  diasMaximo = 720;

  resumo: ResumoInad | null = null;
  vendedores: VendedorResumo[] = [];
  titulos: TituloInadimplente[] = [];

  // filtros locais
  busca = '';
  faixaSel: string | null = null;
  vendedorSel: number | null = null;
  ordem: Ordem = 'atraso';
  limite = 200;

  constructor() {
    afterNextRender(() => {
      if (this.ehGestor) {
        this.empresaSvc.getEmpresas().subscribe((e) => { this.empresas = e; this.cdr.detectChanges(); });
      }
      this.carregar();
    });
  }

  // ── Carga ──

  trocarVisao(v: Visao): void {
    if (this.visao === v) return;
    this.visao = v;
    this.limparFiltros();
    this.carregar();
  }

  carregar(): void {
    this.carregando = true;
    this.erro = null;
    this.cdr.detectChanges();

    const fim = () => { this.carregando = false; this.limite = 200; this.cdr.detectChanges(); };
    const falha = (e: unknown) => { this.erro = this.msgErro(e); this.resumo = null; this.titulos = []; this.vendedores = []; fim(); };

    if (this.visao === 'minha') {
      this.svc.minha().subscribe({
        next: (r) => { this.resumo = r.resumo; this.titulos = r.titulos; this.vendedores = []; this.diasMaximo = r.regras.diasMaximoAtraso; fim(); },
        error: falha,
      });
    } else {
      this.svc.equipe(this.empresasSelecionadas).subscribe({
        next: (r) => { this.resumo = r.resumo; this.titulos = r.titulos; this.vendedores = r.vendedores; fim(); },
        error: falha,
      });
    }
  }

  exportar(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.exportando = true;
    this.cdr.detectChanges();
    const req$: Observable<Blob> = this.visao === 'minha'
      ? this.svc.minhaXlsx()
      : this.svc.equipeXlsx(this.empresasSelecionadas);
    req$.subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `clientes-em-atraso-${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.exportando = false;
        this.cdr.detectChanges();
      },
      error: (e) => { this.exportando = false; this.erro = this.msgErro(e); this.cdr.detectChanges(); },
    });
  }

  // ── Filtros locais ──

  limparFiltros(): void {
    this.busca = '';
    this.faixaSel = null;
    this.vendedorSel = null;
    this.limite = 200;
  }

  selecionarFaixa(f: string): void {
    this.faixaSel = this.faixaSel === f ? null : f;
    this.limite = 200;
    this.cdr.detectChanges();
  }

  selecionarVendedor(id: number | null): void {
    this.vendedorSel = this.vendedorSel === id ? null : id;
    this.limite = 200;
    this.cdr.detectChanges();
  }

  get filtrados(): TituloInadimplente[] {
    const b = this.busca.trim().toUpperCase();
    let l = this.titulos;
    if (this.faixaSel) l = l.filter((t) => t.faixa === this.faixaSel);
    if (this.vendedorSel !== null) {
      l = this.vendedorSel === 0 ? l.filter((t) => !t.idVendedor) : l.filter((t) => t.idVendedor === this.vendedorSel);
    }
    if (b) l = l.filter((t) => t.cliente.toUpperCase().includes(b) || String(t.idCliente) === b || String(t.idTitulo).startsWith(b));
    return [...l].sort((x, y) => this.ordem === 'valor'
      ? y.valorAtualizado - x.valorAtualizado
      : y.diasAtraso - x.diasAtraso || y.valorAtualizado - x.valorAtualizado);
  }

  get visiveis(): TituloInadimplente[] { return this.filtrados.slice(0, this.limite); }

  get totalFiltrado(): number { return this.filtrados.reduce((s, t) => s + t.valorAtualizado, 0); }

  get semVendedor(): { qtd: number; valor: number } {
    const l = this.titulos.filter((t) => !t.idVendedor);
    return { qtd: l.length, valor: l.reduce((s, t) => s + t.valorAtualizado, 0) };
  }

  get vendedoresSemEmail(): number { return this.vendedores.filter((v) => !v.temEmail).length; }

  mostrarMais(): void { this.limite += 300; this.cdr.detectChanges(); }

  // ── Formatação ──

  moeda(v: number): string {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  dataBR(iso: string): string {
    const [a, m, d] = String(iso).slice(0, 10).split('-');
    return a && m && d ? `${d}/${m}/${a}` : iso;
  }

  apelido(id: number): string {
    return this.empresas.find((e) => e.id === id)?.apelido ?? String(id);
  }

  classeAtraso(dias: number): string {
    if (dias > 90) return 'atraso-critico';
    if (dias > 30) return 'atraso-alto';
    if (dias > 15) return 'atraso-medio';
    return 'atraso-baixo';
  }

  trackTitulo(_: number, t: TituloInadimplente) { return `${t.idEmpresa}-${t.idTitulo}-${t.digito}`; }

  private msgErro(e: unknown): string {
    const err = e as HttpErrorResponse;
    if (err?.status === 403) return 'Você não tem permissão para esta tela. Se a permissão foi liberada agora, saia e entre de novo no sistema.';
    const m = err?.error?.message;
    if (Array.isArray(m)) return m.join(' ');
    return (typeof m === 'string' && m) ? m : 'Não foi possível carregar os títulos em atraso.';
  }
}
