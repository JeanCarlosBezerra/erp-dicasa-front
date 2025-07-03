import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ColaboradorProdutividade {
  idVendedor: number;
  nome:       string;
  qtdvenda:   number;
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
        `${environment.apiUrl}/comercial/colaborador/produtividade`,
        { params }
      );
    }

}
