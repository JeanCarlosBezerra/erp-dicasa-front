import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { tap, catchError } from 'rxjs/operators';

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
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  produtividade(
   empresas: number[],
   dataInicio: string,
   dataFim: string,
  ): Observable<ColaboradorProdutividade[]> {
    const params = new HttpParams()
      .set('idempresa',  String(empresas))
      .set('dataInicio', dataInicio)
      .set('dataFim',    dataFim);

    console.log('Angular → chamando API produtividade', { empresas, dataInicio, dataFim });

    return this.http
      .get<ColaboradorProdutividade[]>(`${this.api}/comercial/colaborador/produtividade`, { params })
      .pipe(
        tap(res => console.log('Angular ← resposta API', res)),
        catchError(err => {
          console.error('Angular ← erro na API', err);
          return throwError(() => err);
        })
      );
  }
}
