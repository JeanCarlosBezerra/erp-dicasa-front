import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Empresa } from '../models/empresa.model';
import { environment } from '../../environments/environment'; // ← importa aqui

@Injectable({
  providedIn: 'root'
})
export class EmpresaService {
  private readonly url = `${environment.apiUrl}/empresas`; // ← usa o IP fixo do environment.ts

  constructor(private http: HttpClient) {}

  getEmpresas(): Observable<Empresa[]> {
    return this.http.get<Empresa[]>(this.url);
  }
}