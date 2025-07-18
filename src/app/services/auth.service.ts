// src/app/services/auth.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  constructor(private http: HttpClient) {}

  private api = environment.apiUrl;  // defina em environment.ts → apiUrl: 'http://localhost:3000'
  // pega o token (supondo JWT em localStorage)
  private get token(): string | null {
    return localStorage.getItem('access_token');
  }

  login(user: string, pass: string): Observable<{ access_token: string }> {
    return this.http.post<{ access_token: string }>(
      '/auth/login',
      { usuario: user, senha: pass }
    );
  }

  // decodifica o payload do JWT
  private get payload(): any {
    if (!this.token) return {};
    try {
      return JSON.parse(atob(this.token.split('.')[1]));
    } catch {
      return {};
    }
  }

  isLoggedIn(): boolean {
    return !!this.token;
  }

  // expõe os grupos vindos do AD via JWT
  get userGroups(): string[] {
    return this.payload.grupos || [];
  }

  // checa se o usuário pertence ao grupo DN
  hasGroup(dn: string): boolean {
    return this.userGroups.includes(dn);
  }
}
