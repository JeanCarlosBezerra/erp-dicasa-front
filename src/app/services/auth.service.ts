import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = `${environment.apiUrl}/auth/login`; // ajuste se necessário

  constructor(private http: HttpClient) {}

  login(usuario: string, senha: string): Observable<any> {
    console.log('chamando ', this.apiUrl);
    return this.http.post<any>(this.apiUrl, { usuario, senha });
  }
}
