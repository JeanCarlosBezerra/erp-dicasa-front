import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface CurvaAbcProduto {
  codProd: string;
  descricao: string;
  divisao: string | null;
  comprador: string | null;
  prodFoco: string | null;
  fatKAnterior: number;
  percItem: number;
  percAcumulado: number;
  curva: string;
}

export interface CurvaAbcResumoItem {
  curva: string;
  vdAnterior: number;
  fatKAnterior: number;
  vdAtual: number;
  fatKAtual: number;
  fatKProj: number;
  estVenda: number;
  vendaProj: number;
}

export interface CurvaAbcResponse {
  produtos: CurvaAbcProduto[];
  resumo: CurvaAbcResumoItem[];
}

@Injectable({ providedIn: 'root' })
export class EstoqueProdutosService {
  private baseUrl = `${environment.apiUrl}/estoque/produtos`;

  constructor(private http: HttpClient) {}

  getCurvaAbc(filters: {
    dtBase: string;
    divisao?: string;
    secao?: string;
    grupo?: string;
    subgrupo?: string;
    comprador?: string;
    prodFoco?: string;
  }) {
    let params = new HttpParams().set('dtBase', filters.dtBase);
    Object.entries(filters).forEach(([k, v]) => {
      if (k !== 'dtBase' && v) params = params.set(k, v as string);
    });

    return this.http.get<CurvaAbcResponse>(
      `${this.baseUrl}/curva-abc`,
      { params },
    );
  }
}
