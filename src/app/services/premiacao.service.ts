import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import { environment } from '../../environments/environment';
import {
  BonusVendedor,
  BonusGestor,
  FaixaBonusVendedor,
  ParametroIndicadorGestor,
} from '../models/premiacao.model';

@Injectable({ providedIn: 'root' })
export class PremiacaoService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl; // ex.: https://api-erp.dicasaweb.com.br

  /** Faixas oficiais do bônus do vendedor (Regras da Diretoria) */
  private readonly faixasVendedor: FaixaBonusVendedor[] = [
    { faixa: 1, valorVenda: 180000, margemMeta: 0.31, vlLucratividade: 55800,  premiacao: 100 },
    { faixa: 2, valorVenda: 230000, margemMeta: 0.31, vlLucratividade: 71300,  premiacao: 150 },
    { faixa: 3, valorVenda: 300000, margemMeta: 0.31, vlLucratividade: 93000,  premiacao: 200 },
    { faixa: 4, valorVenda: 450000, margemMeta: 0.31, vlLucratividade: 139500, premiacao: 250 },
  ];

  private readonly parametrosGestor: ParametroIndicadorGestor[] = [
    { indicador: 'Faturamento',  metaMinima: 1, premioPerc: 0.16 },
    { indicador: 'Margem',       metaMinima: 1, premioPerc: 0.14 },
    { indicador: 'Ticket Médio', metaMinima: 1, premioPerc: 0.13 },
  ];

  getFaixasVendedor(): FaixaBonusVendedor[] { return this.faixasVendedor; }
  getParametrosGestor(): ParametroIndicadorGestor[] { return this.parametrosGestor; }

  // ── GESTORES — agora REAL, vindo do backend (CISS) ──
  getBonusGestores(mes: number, ano: number): Observable<BonusGestor[]> {
    return this.http.get<BonusGestor[]>(
      `${this.api}/comercial/premiacao/gestor`,
      { params: { mes: String(mes), ano: String(ano) } },
    );
  }

  // ── VENDEDORES — ainda mock (backend do vendedor é fase seguinte) ──
  // ── VENDEDORES — agora REAL (CISS) ──
  getBonusVendedores(mes: number, ano: number): Observable<BonusVendedor[]> {
    return this.http.get<BonusVendedor[]>(
      `${this.api}/comercial/premiacao/vendedor`,
      { params: { mes: String(mes), ano: String(ano) } },
    );
  }
}