// src/app/services/dashboard-comercial.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IndicadorEmpresa {
  idEmpresa: number;
  apelido?: string;
  faturamento: number;
  lucro: number;
  devolucoes: number;
  descontoValor: number;
  descontoPerc: number;
}

export interface MetaEmpresaApi {
  id?: number;
  id_empresa: number;
  mes: number;
  ano: number;
  meta_fat: number;
  meta_margem: number; // fração 0.30 = 30%
}

@Injectable({ providedIn: 'root' })
export class DashboardComercialService {
  private api = `${environment.apiUrl}/comercial/dashboard`;
  private apiMetas = `${environment.apiUrl}/comercial/metas`;

  constructor(private http: HttpClient) {}

  indicadores(dataInicio: string, dataFim: string): Observable<IndicadorEmpresa[]> {
    const params = new HttpParams()
      .set('dataInicio', dataInicio)
      .set('dataFim', dataFim);
    return this.http.get<IndicadorEmpresa[]>(this.api, { params });
  }

  getMetas(mes: number, ano: number): Observable<MetaEmpresaApi[]> {
    const params = new HttpParams()
      .set('mes', mes.toString())
      .set('ano', ano.toString());
    return this.http.get<MetaEmpresaApi[]>(`${this.apiMetas}/mes`, { params });
  }
}