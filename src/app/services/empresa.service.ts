import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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
      map(rows => (rows ?? []).map(r => {
        // id sempre number
        const id = Number(r.IDEMPRESA ?? r.id);

        // apelido sempre string (EMPALIAS > NOMEFANTASIA > id)
        const raw = (r.EMPALIAS ?? r.NOMEFANTASIA ?? '').toString().trim();
        const apelido = raw && raw.toLowerCase() !== 'undefined' ? raw : String(id);

        return { id, apelido } as EmpresaLite;
      }))
    );
  }
}
