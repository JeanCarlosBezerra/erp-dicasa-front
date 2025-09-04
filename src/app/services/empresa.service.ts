import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, map, tap } from 'rxjs';        // ⬅️  tap aqui
import { environment } from '../../environments/environment'; // ← importa aqui

interface EmpresaRaw {
  IDEMPRESA: number;
  EMPALIAS?: string;
  NOMEFANTASIA?: string;
}

export interface EmpresaLite {
  id: number;
  apelido: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmpresaService {
  private readonly url = `${environment.apiUrl}/empresas`; // ← usa o IP fixo do environment.ts
  constructor(private http: HttpClient) {}

  getEmpresas(): Observable<EmpresaLite[]> {
    return this.http.get<any[]>(this.url).pipe(
      tap(raw => console.log('[EMPRESAS][RAW]', raw)),                  // ⬅️ log 1

      map(rows => (rows ?? []).map(r => {
        const id = Number(r?.IDEMPRESA ?? r?.id);
        // Pega EMPALIAS / NOMEFANTASIA e força STRING
        let rawApelido = (r?.EMPALIAS ?? r?.NOMEFANTASIA ?? '').toString().trim();

        // trata casos "undefined", null, string vazia
        if (!rawApelido || /^(undefined|null)$/i.test(rawApelido)) {
          rawApelido = String(id);
        }

        const item = { id, apelido: rawApelido } as EmpresaLite;
        console.log('[EMPRESAS][MAP]', item);                           // ⬅️ log 2
        return item;
      })),

      tap(final => console.log('[EMPRESAS][FINAL]', final))             // ⬅️ log 3
    );
  }
}
