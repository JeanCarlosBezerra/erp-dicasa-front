// src/app/services/premiacao-destinatarios.service.ts
// (renomeie para premiacao-destinatarios.service.ts ao colocar no front)
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type TipoDestinatario = 'VENDEDOR' | 'GESTOR' | 'AMBOS';

export interface Destinatario {
  id: number;
  tipo: TipoDestinatario;
  nome: string;
  email: string;
  ativo: boolean;
  criado_em?: string;
  atualizado_em?: string;
}

export interface InfoEmail {
  modoTeste: boolean;
  smtpConfigurado: boolean;
  remetente: string | null;
  testePara: string | null;
}

export interface ListaDestinatarios {
  destinatarios: Destinatario[];
  email: InfoEmail;
}

export type DestinatarioPayload = Pick<Destinatario, 'tipo' | 'nome' | 'email' | 'ativo'>;

@Injectable({ providedIn: 'root' })
export class PremiacaoDestinatariosService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/comercial/premiacao/destinatarios`;

  listar(): Observable<ListaDestinatarios> {
    return this.http.get<ListaDestinatarios>(this.base);
  }

  criar(d: DestinatarioPayload): Observable<Destinatario> {
    return this.http.post<Destinatario>(this.base, d);
  }

  atualizar(id: number, d: DestinatarioPayload): Observable<Destinatario> {
    return this.http.put<Destinatario>(`${this.base}/${id}`, d);
  }

  remover(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/${id}`);
  }

  enviarTeste(id: number): Observable<{ destinatarios: string[]; modoTeste: boolean }> {
    return this.http.post<{ destinatarios: string[]; modoTeste: boolean }>(`${this.base}/${id}/teste`, {});
  }
}