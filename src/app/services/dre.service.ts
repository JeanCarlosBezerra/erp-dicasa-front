import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

// ── Models (espelham o backend dre.repository.ts) ──
export interface CategoriaDRE {
  nivel: 1 | 2;
  nome: string;
  valor: number;
  filhos?: CategoriaDRE[];
}

export interface LinhaDRE {
  codigo: string;
  descricao: string;
  tipo: 'grupo' | 'subtotal';
  valor: number;
  percentualReceita: number;
  filhos?: CategoriaDRE[];
}

export interface CascataDRE {
  origem: 'NF_EMITIDA' | 'PEDIDO';
  periodo: { inicio: string; fim: string };
  linhas: LinhaDRE[];
}

@Injectable({ providedIn: 'root' })
export class DreService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getCascataNfEmitida(
    empresas: number[],
    dataInicio: string,
    dataFim: string,
  ): Observable<CascataDRE> {
    let params = new HttpParams()
      .set('dataInicio', dataInicio)
      .set('dataFim', dataFim);
    empresas.forEach((id) => (params = params.append('idempresa', String(id))));

    return this.http.get<CascataDRE>(`${this.api}/financeiro/dre/nf-emitida`, { params });
  }

  getCascataPedido(
    empresas: number[],
    dataInicio: string,
    dataFim: string,
  ): Observable<CascataDRE> {
    let params = new HttpParams()
      .set('dataInicio', dataInicio)
      .set('dataFim', dataFim);
    empresas.forEach((id) => (params = params.append('idempresa', String(id))));

    return this.http.get<CascataDRE>(`${this.api}/financeiro/dre/pedido`, { params });
  }
}