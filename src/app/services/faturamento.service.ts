import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FaturamentoFiltros {
  empresas: number[];
  dataInicio: string;
  dataFim: string;
}

export interface FaturamentoEmpresaItem {
  IDEMPRESA: number;
  NOME: string;
  TOTALVENDA: number;
  LUCRO: number;
  TOTALVENDABRUTA: number;
  LUCROBRUTO: number;
  DEVOLUCOES: number;
  QTDVENDA: number;
  TICKETMEDIO: number;
  PERCLUCRATIVIDADE: number;
}

export interface FaturamentoFormaPagamentoItem {
  IDRECEBIMENTO: number;
  DESCRICAO: string;
  TOTALDUP: number;
}

@Injectable({
  providedIn: 'root'
})
export class FaturamentoService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  buscarPorEmpresa(filtros: FaturamentoFiltros): Observable<FaturamentoEmpresaItem[]> {
    return this.http.post<FaturamentoEmpresaItem[]>(
      `${this.apiUrl}/comercial/faturamento/empresa`,
      filtros
    );
  }

  buscarPorFormaPagamento(filtros: FaturamentoFiltros): Observable<FaturamentoFormaPagamentoItem[]> {
    return this.http.post<FaturamentoFormaPagamentoItem[]>(
      `${this.apiUrl}/comercial/faturamento/forma-pagamento`,
      filtros
    );
  }
}