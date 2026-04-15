import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { isPlatformBrowser } from '@angular/common';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {

  private api = environment.apiUrl;  // 
  private platformId = inject(PLATFORM_ID);

  constructor(private http: HttpClient) {}
  // pega o token (supondo JWT em localStorage)
  private get token(): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    return localStorage.getItem('access_token');
  }

  login(user: string, pass: string): Observable<{ access_token: string }> {
    return this.http.post<{ access_token: string }>(
      `${this.api}/auth/login`,
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

  isLoggedIn(): boolean { return !!this.token; }

  getRoles(): string[] {
    if (!this.payload?.roles) return [];
    return this.payload.roles.split(',').map((r: string) => r.trim()).filter(Boolean);
  }

  // ADMIN tem acesso a tudo
  hasRole(role: string): boolean {
    const roles = this.getRoles();
    if (roles.includes('ADMIN')) return true;
    return roles.includes(role);
  }

  // Checa se tem QUALQUER um dos módulos pai
  hasAnyRole(...roles: string[]): boolean {
    return roles.some(r => this.hasRole(r));
  }

  get userGroups(): string[] { return this.payload.grupos || []; }
}
