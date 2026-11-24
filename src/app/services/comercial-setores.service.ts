// src/app/services/comercial-setores.service.ts
import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { ExcecaoDiaVenda, TipoExcecao } from './dias-venda.util';

export interface Departamento { id: number; nome: string; ativo: boolean; }

export interface MetaSetorApi {
  id?: number;
  id_empresa: number;
  id_departamento: number;
  departamento: string;
  mes: number;
  ano: number;
  meta_fat: number;
  atualizado_por?: string | null;
  atualizado_em?: string;
}

export interface SugestaoSetor {
  idEmpresa: number;
  idDepartamento: number;
  departamento: string;
  faturamento: number;
  participacao: number;   // fração da loja
}

export interface FaturamentoSetor {
  idEmpresa: number;
  idDepartamento: number;  // -1 = vendedor sem departamento
  departamento: string;
  faturamento: number;
  lucro: number;
}

export interface FeriadoCiss { data: string; descricao: string; }

export interface DiasVendaMes {
  mes: number;
  ano: number;
  excecoes: ExcecaoDiaVenda[];
  feriadosCiss: FeriadoCiss[];
}

@Injectable({ providedIn: 'root' })
export class ComercialSetoresService {
  private http = inject(HttpClient);
  private apiMetas = `${environment.apiUrl}/comercial/metas`;
  private apiDash = `${environment.apiUrl}/comercial/dashboard`;

  private mesAno(mes: number, ano: number) {
    return new HttpParams().set('mes', String(mes)).set('ano', String(ano));
  }

  // ── Metas por setor ──
  departamentos(): Observable<Departamento[]> {
    return this.http.get<Departamento[]>(`${this.apiMetas}/setores/departamentos`);
  }
  metasSetor(mes: number, ano: number): Observable<MetaSetorApi[]> {
    return this.http.get<MetaSetorApi[]>(`${this.apiMetas}/setores`, { params: this.mesAno(mes, ano) });
  }
  sugestao(mes: number, ano: number): Observable<{ periodo: { inicio: string; fim: string }; setores: SugestaoSetor[] }> {
    return this.http.get<any>(`${this.apiMetas}/setores/sugestao`, { params: this.mesAno(mes, ano) });
  }
  salvarMetaSetor(m: MetaSetorApi): Observable<MetaSetorApi> {
    return this.http.post<MetaSetorApi>(`${this.apiMetas}/setores`, m);
  }
  excluirMetaSetor(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.apiMetas}/setores/${id}`);
  }

  // ── Dias de venda ──
  diasVenda(mes: number, ano: number): Observable<DiasVendaMes> {
    return this.http.get<DiasVendaMes>(`${this.apiMetas}/dias-venda`, { params: this.mesAno(mes, ano) });
  }
  excecoesPeriodo(dataInicio: string, dataFim: string): Observable<ExcecaoDiaVenda[]> {
    const params = new HttpParams().set('dataInicio', dataInicio).set('dataFim', dataFim);
    return this.http.get<ExcecaoDiaVenda[]>(`${this.apiMetas}/dias-venda/periodo`, { params });
  }
  inserirExcecao(e: { data: string; id_empresa: number | null; tipo: TipoExcecao; descricao: string }): Observable<ExcecaoDiaVenda> {
    return this.http.post<ExcecaoDiaVenda>(`${this.apiMetas}/dias-venda`, e);
  }
  excluirExcecao(id: number): Observable<{ ok: boolean }> {
    return this.http.delete<{ ok: boolean }>(`${this.apiMetas}/dias-venda/${id}`);
  }

  // ── Dashboard ──
  faturamentoPorSetor(dataInicio: string, dataFim: string): Observable<FaturamentoSetor[]> {
    const params = new HttpParams().set('dataInicio', dataInicio).set('dataFim', dataFim);
    return this.http.get<FaturamentoSetor[]>(`${this.apiDash}/setores`, { params });
  }
}
