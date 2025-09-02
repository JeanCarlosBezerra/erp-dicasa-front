// src/app/services/dashboard-invest.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface IndicadorEmpresa {
  idEmpresa: number;
  apelido?: string; // EMPALIAS
  faturamento: number;
  lucro: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardComercialService {
  private api = `${environment.apiUrl}/comercial/dashboard`;

  constructor(private http: HttpClient) {}

  indicadores(dataInicio: string, dataFim: string): Observable<IndicadorEmpresa[]> {
    const params = new HttpParams().set('dataInicio', dataInicio).set('dataFim', dataFim);
    return this.http.get<IndicadorEmpresa[]>(this.api, { params });
  }
}
