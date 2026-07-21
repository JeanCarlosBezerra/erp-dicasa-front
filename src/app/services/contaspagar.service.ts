import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface LinhaPagar  { situacao: 'A_VENCER' | 'VENCIDO'; categoria: string; totalTitulos: number; valorTotal: number; }
export interface LinhaPago   { forma: string; totalTitulos: number; valorTotal: number; }
export interface FaixaPagar  { label: string; valor: number; qtd: number; nivel: string; acao: string; }
export interface FornecedorTop { nome: string; valor: number; qtd: number; }
export interface PainelPagar {
  totalPagarBruto: number; totalPagarSaldo: number;
  aVencer: number; vencidoAtraso: number; vence7dias: number; pagoPeriodo: number;
  linhas: LinhaPagar[]; pagos: LinhaPago[]; faixas: FaixaPagar[]; topFornecedores: FornecedorTop[];
}

@Injectable({ providedIn: 'root' })
export class ContasPagarService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/financeiro/contas-pagar`;

  getPainel(dataInicio: string, dataFim?: string, empresa?: string, incluirPre = true): Observable<PainelPagar> {
    const params: any = { dataInicio, incluirPre: String(incluirPre) };
    if (dataFim) params.dataFim = dataFim;
    if (empresa) params.empresa = empresa;
    return this.http.get<PainelPagar>(`${this.base}/painel`, { params });
  }
}