// src/app/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { formatDate } from '@angular/common';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Faturamento {
  ano:        number;
  mes:        number;
  totalvenda: number;
}

export interface Pendente {
  idclifor: number;
  cliente: string;
  valsaldotitulo: number;
  diaspgto: number;
}

export interface ContasPagar {
    idclifor: number;
    nome: string;
    valtitulo: number;
    sumvalpagamentotitulo: number;
}

export interface ContasReceber {
    idctadebito: number;
    descrctadebito: string;
    valtitulo: number;
    sumvalpagamentotitulo: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private baseUrl = `${environment.apiUrl}/financeiro/dashboard`;

  constructor(private http: HttpClient) {}

  /**
   * Busca o total de vendas (totalvenda) por mês/ano
   * @param dataInicial  Data de início (Date)
   * @param dataFinal    Data de fim   (Date)
   * @param empresa      ID da empresa (number)
   */
  getFaturamentoLiquido(
    dataInicial: Date,
    dataFinal:   Date,
    empresa:     number
  ): Observable<Faturamento[]> {
    const params = new HttpParams()
      .set('empresa', empresa.toString())
      .set(
        'dataInicial',
        formatDate(dataInicial, 'yyyy-MM-dd', 'en-US')
      )
      .set(
        'dataFinal',
        formatDate(dataFinal, 'yyyy-MM-dd', 'en-US')
      );

    return this.http.get<Faturamento[]>(
      `${this.baseUrl}/faturamento-liquido`,
      { params }
    );
  }

  getPendentes(
    empresa: number,
    dataInicial: Date,
    dataFinal:   Date
  ): Observable<Pendente[]> {
    const params = new HttpParams()
      .set('empresa',     empresa.toString())
      .set(
        'dataInicial',
        formatDate(dataInicial, 'yyyy-MM-dd', 'pt-BR')
      )
      .set(
        'dataFinal',
        formatDate(dataFinal,   'yyyy-MM-dd', 'pt-BR')
      );

    return this.http.get<Pendente[]>(`${this.baseUrl}/pendentes`, { params });
  }

    getContasAPagar(empresa: number, dataInicial: Date, dataFinal: Date): Observable<ContasPagar[]> {
    const params = new HttpParams()
      .set('empresa', empresa.toString())
      .set('dataInicial', formatDate(dataInicial, 'yyyy-MM-dd', 'en-US'))
      .set('dataFinal',   formatDate(dataFinal,   'yyyy-MM-dd', 'en-US'));
    return this.http.get<ContasPagar[]>(`${this.baseUrl}/contas-pagar`, { params });
  }


  getContasAReceber(emp: number, ini: Date, fim: Date): Observable<ContasReceber[]> {
    const params = new HttpParams()
      .set('empresa', emp.toString())
      .set('dataInicial', formatDate(ini,'yyyy-MM-dd','en-US'))
      .set('dataFinal',   formatDate(fim,'yyyy-MM-dd','en-US'));
    return this.http.get<ContasReceber[]>(`${this.baseUrl}/contas-receber`, { params });
  }
}


