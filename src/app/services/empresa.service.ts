import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Empresa } from '../models/empresa.model';
import { environment } from '../../environments/environment'; // ← importa aqui

interface EmpresaRaw {
  IDEMPRESA: number;
  EMPALIAS?: string;
  NOMEFANTASIA?: string;
}

export interface EmpresaLite {
  id: number;
  nome: string;
  apelido: string;
}

@Injectable({
  providedIn: 'root'
})
export class EmpresaService {
  private readonly url = `${environment.apiUrl}/empresas`; // ← usa o IP fixo do environment.ts


  constructor(private http: HttpClient) {}

  getEmpresas() {
  return this.http.get<EmpresaRaw[]>(this.url).pipe(
    map(list => (list ?? []).map(r => ({
      id: r.IDEMPRESA,
      apelido: r.EMPALIAS || r.NOMEFANTASIA || String(r.IDEMPRESA)
    } as EmpresaLite)))
  );
}
}