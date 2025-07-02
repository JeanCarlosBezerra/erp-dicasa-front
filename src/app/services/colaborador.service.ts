import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ColaboradorProdutividade {
  idVendedor: number;
  nome:       string;
  clientes:   number;
  notas:      number;
  faturamento:number;
  lucro:      number;
  margem:     number;
  devolucoes: number;
}

@Injectable({ providedIn: 'root' })
export class ColaboradorService {
  constructor(private http: HttpClient) {}

    produtividade(
      idempresa:  number,
      dataInicio: string,
      dataFim:    string,
    ): Observable<ColaboradorProdutividade[]> {
      const params = new HttpParams()
        .set('idempresa',  String(idempresa))
        .set('dataInicio', dataInicio)
        .set('dataFim',    dataFim);
      return this.http.get<ColaboradorProdutividade[]>(
        '/api/comercial/colaborador/produtividade',
        { params }
      );
    }

}
