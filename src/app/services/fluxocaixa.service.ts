import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SemanaFluxo {
  semana: number; label: string; periodo: string;
  entrada: number; saida: number; net: number; saldoAcumulado: number;
    entradaAPrazo: number;          // ← adiciona
  entradaCartaoEstimado: number;  // ← adiciona
}
export interface FluxoResponse {
  saldoInicial: number;
  atrasado: { entrada: number; saida: number };
  semanas: SemanaFluxo[];
  menorSaldo: number; semanaMenorSaldo: number; saldoFinal: number;
  entra30: number; sai30: number;
  temEstimativaCartao: boolean;   // ← adiciona
}

// ── Tipos da visão Diária (Previsto × Realizado) ──
export interface CelulaDiaria {
  dia: string;          // 'YYYY-MM-DD'
  chave: string;        // categoria (saída) ou balde (entrada)
  previsto: number;
  realizado: number;
}
export interface VencidoCategoria {
  categoria: string;
  valor: number;
  qtd: number;
}
export interface FluxoDiarioResponse {
  dataInicio: string;
  dataFim: string;
  saidas: CelulaDiaria[];
  entradas: CelulaDiaria[];
  vencido: VencidoCategoria[];
  vencidoCorteDias: number;
}

@Injectable({ providedIn: 'root' })
export class FluxoCaixaService {
  private http = inject(HttpClient);
  private base = `${environment.apiUrl}/financeiro/fluxo-caixa`;

  getProjecao(saldoInicial: number, empresa?: string): Observable<FluxoResponse> {
    const params: any = { saldoInicial: String(saldoInicial || 0) };
    if (empresa) params.empresa = empresa;
    return this.http.get<FluxoResponse>(`${this.base}/projecao`, { params });
  }

  getSaldoBancos(empresa?: string) {
    let params = new HttpParams();
    if (empresa) params = params.set('idempresa', empresa);
    return this.http.get<{ total: number; contas: {id:number;nome:string;saldo:number}[] }>(
      `${this.base}/saldo-bancos`, { params });   // ← mesmo prefixo dos outros métodos
  }

  getDiario(
    dataInicio: string,
    dataFim: string,
    empresa?: string,
    vencidoCorteDias = 90,
  ): Observable<FluxoDiarioResponse> {
    const params: any = {
      dataInicio,
      dataFim,
      vencidoCorteDias: String(vencidoCorteDias),
    };
    if (empresa) params.empresa = empresa;
    return this.http.get<FluxoDiarioResponse>(`${this.base}/diario`, { params });
  }
}