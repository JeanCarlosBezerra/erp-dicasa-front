import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ResumoExecutivoBaseItem {
  idProduto: number;
  idSubproduto: number;
  descricaoProduto: string;
  subgrupo: string;
  marca: string;
  valVendMesAtual: number;
  valVendMesAnterior: number;
  lucratividadeGerencial: number;
  estoqueAtualGeral: number;
  fornecedorPrincipalId: number | null;
  fornecedorPrincipalNome: string | null;
  valorCompradoPeriodo: number;
  qtdPedidosPeriodo: number;
}

export interface ResumoExecutivoFiltros {
  empresas: number[];
  dataInicio: string;
  dataFim: string;
  fornecedorId: number | null;
  subgrupo: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ResumoExecutivoService {
  private readonly apiUrl = 'http://localhost:3000/compras-estrategicas/resumo-executivo';

  constructor(private http: HttpClient) {}

  buscarBase(filtros: ResumoExecutivoFiltros): Observable<ResumoExecutivoBaseItem[]> {
    return this.http.post<ResumoExecutivoBaseItem[]>(`${this.apiUrl}/base`, filtros);
  }
}