import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AvaliacaoService {
  private api = environment.apiUrl;

  constructor(private http: HttpClient) {}

  // ── CARGOS E COLABORADORES ──
  getCargos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/cargos`);
  }

  getColaboradores(filial?: string): Observable<any[]> {
    const url = filial
      ? `${this.api}/rh/avaliacao/colaboradores?filial=${filial}`
      : `${this.api}/rh/avaliacao/colaboradores`;
    return this.http.get<any[]>(url);
  }

  // ── COMPETÊNCIAS ──
  getAllCompetencias(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/competencias`);
  }

  getCompetencias(cargo: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/competencias/${encodeURIComponent(cargo)}`);
  }

  // ── CICLOS ──
  getCiclos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/ciclos`);
  }

  getCicloAtivo(): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/ciclo-ativo`);
  }

  // ── NOTAS ──
  getNotas(ciclo: number, matricula: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/notas/${ciclo}/${matricula}`);
  }

  salvarNotas(dados: any): Observable<any> {
    return this.http.post(`${this.api}/rh/avaliacao/notas`, dados);
  }

  // ── 9-BOX ──
  calcular9Box(ciclo: number, matricula: string): Observable<any> {
    return this.http.post(`${this.api}/rh/avaliacao/9box/${ciclo}/${matricula}`, {});
  }

  getDashboard9Box(ciclo: number, filial?: string, setor?: string): Observable<any[]> {
    let url = `${this.api}/rh/avaliacao/9box/dashboard/${ciclo}`;
    const params: string[] = [];
    if (filial) params.push(`filial=${filial}`);
    if (setor)  params.push(`setor=${setor}`);
    if (params.length) url += '?' + params.join('&');
    return this.http.get<any[]>(url);
  }

  // ── PDI ──
  getPdi(ciclo: number, matricula: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.api}/rh/avaliacao/pdi/${ciclo}/${matricula}`);
  }

  salvarPdi(dados: any): Observable<any> {
    return this.http.post(`${this.api}/rh/avaliacao/pdi`, dados);
  }

  atualizarStatusPdi(id: number, status: string): Observable<any> {
    return this.http.put(`${this.api}/rh/avaliacao/pdi/${id}/status`, { status });
  }

  editarPdi(id: number, dados: {
  tipo_competencia: string; item: string; descricao: string;
  prazo: string; qtde_meses: number;
  }): Observable<any> {
    return this.http.put(`${this.api}/rh/avaliacao/pdi/${id}`, dados);
  }
  
  deletarPdi(id: number): Observable<any> {
    return this.http.delete(`${this.api}/rh/avaliacao/pdi/${id}`);
  }

  getTodosPdis(idCiclo?: number, filial?: string, setor?: string, status?: string): Observable<any[]> {
  let url = `${this.api}/rh/avaliacao/pdi/todos`;
  const params: string[] = [];
  if (idCiclo) params.push(`ciclo=${idCiclo}`);
  if (filial)  params.push(`filial=${filial}`);
  if (setor)   params.push(`setor=${setor}`);
  if (status)  params.push(`status=${status}`);
  if (params.length) url += '?' + params.join('&');
  return this.http.get<any[]>(url);
}

  // ── CONFIRMAÇÃO / ASSINATURA ──
  getConfirmacao(ciclo: number, matricula: string): Observable<any> {
    return this.http.get<any>(`${this.api}/rh/avaliacao/confirmacao/${ciclo}/${matricula}`);
  }

  confirmarAvaliacao(ciclo: number, matricula: string, tipo: 'AUTO' | 'GESTOR', usuario: string): Observable<any> {
    return this.http.patch(`${this.api}/rh/avaliacao/confirmacao/${ciclo}/${matricula}`, {
      tipo,
      usuario,
    });
  }
}