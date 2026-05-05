import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoCompra = 'ENCOMENDA' | 'ESTOQUE' | 'SEM_PC' | 'PC_NAO_ENCONTRADO';
export type MetodoExtracao = 'XPED' | 'INFCPL' | 'NAO_IDENTIFICADO';

export interface EncomendaItem {
  idNfe: number;
  nroNf: string;
  serie: string;
  fornecedor: string;
  cnpjFornecedor: string;
  dtEmissao: string;
  valorNf: number;
  statusSefaz: number;
  gravadaErp: boolean;

  pcExtraido: number | null;
  metodoExtracao: MetodoExtracao;
  tipoCompra: TipoCompra;

  pedidoCompra: {
    idPedido: number;
    idEmpresa: number;
    dtPedido: string;
    previsaoEntrega: string | null;
    flagCancelado: boolean;
    produtos: {
      idProduto: number;
      descricao: string;
      qtdSolicitada: number;
      qtdAtendida: number;
      pctAtendido: number;
    }[];
  } | null;

  encomenda: {
    idEncomenda: number;
    idOrcamento: number;
    cliente: string;
    dtVenda: string;
    dtRegistroEncomenda: string;
    status: string;
    qtdEncomenda: number;
  } | null;
}

@Injectable({ providedIn: 'root' })
export class EncomendasService {
  private readonly url = `${environment.apiUrl}/compras/encomendas`;

  constructor(private http: HttpClient) {}

  getEncomendas(
    empresas: number[],
    dataInicio: string,
    dataFim: string,
  ): Observable<EncomendaItem[]> {
    const params: Record<string, string> = {
      idempresa: empresas.join(','),
      dataInicio,
      dataFim,
    };
    return this.http.get<EncomendaItem[]>(this.url, { params });
  }
}