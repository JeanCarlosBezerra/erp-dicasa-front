// src/app/services/inadimplencia.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export type OrigemVendedor = 'NOTA' | 'PREVENDA' | 'SEM_VENDEDOR';

export interface TituloInadimplente {
  idEmpresa: number;
  idVendedor: number | null;
  vendedor: string | null;
  origemVendedor: OrigemVendedor;
  idCliente: number;
  cliente: string;
  telefone: string | null;
  situacao: string | null;
  juridico: boolean;
  idTitulo: number;
  digito: string;
  vencimento: string;
  diasAtraso: number;
  faixa: string;
  valorOriginal: number;
  juros: number;
  valorAtualizado: number;
  formaRecebimento: string | null;
}

export interface ResumoFaixa { faixa: string; qtdTitulos: number; valor: number; }

export interface ResumoInad {
  qtdTitulos: number;
  qtdClientes: number;
  valor: number;
  faixas: ResumoFaixa[];
}

export interface VendedorResumo {
  idVendedor: number;
  vendedor: string;
  temEmail?: boolean;
  email?: string | null;
  motivoSemEmail: string | null;
  qtdClientes: number;
  qtdTitulos: number;
  valor: number;
  faixas: ResumoFaixa[];
}

export interface RespostaMinha {
  resumo: ResumoInad;
  titulos: TituloInadimplente[];
  regras: { diasMaximoAtraso: number };
}

export interface RespostaEquipe {
  resumo: ResumoInad;
  vendedores: VendedorResumo[];
  titulos: TituloInadimplente[];
  empresasPermitidas: number[] | null;
}

export interface Previa {
  modoTeste: boolean;
  cronAtivo: boolean;
  regras: { diasMaximoAtraso: number; juridicoNoEmailDoVendedor: boolean; cron: string; faixas: string[] };
  totais: ResumoInad & {
    comVendedor: { qtdTitulos: number; valor: number };
    semVendedor: { qtdTitulos: number; valor: number };
    juridico: { qtdTitulos: number; valor: number };
  };
  vendedores: VendedorResumo[];
  destinatariosConsolidado: { nome: string; email: string; idEmpresa: number | null }[];
}

export interface Execucao {
  id: number;
  origem: 'AGENDADO' | 'MANUAL';
  data_ref: string;
  disparado_por: string | null;
  iniciado_em: string;
  finalizado_em: string | null;
  status: 'EXECUTANDO' | 'CONCLUIDO' | 'FALHA';
  modo_teste: boolean;
  qtd_titulos: number | null;
  valor_total: string | number | null;
  qtd_emails_ok: number | null;
  qtd_emails_falha: number | null;
  qtd_sem_email: number | null;
  erro: string | null;
}

export interface Envio {
  id: number;
  tipo: 'VENDEDOR' | 'GESTOR';
  id_vendedor: number | null;
  nome: string | null;
  destinatarios: string | null;
  empresas: string | null;
  qtd_titulos: number;
  qtd_clientes: number;
  valor: string | number;
  status: 'ENVIADO' | 'FALHA' | 'SEM_EMAIL';
  motivo: string | null;
  enviado_em: string;
}

export interface DestinatarioInad {
  id: number;
  nome: string;
  email: string;
  id_empresa: number | null;
  ativo: boolean;
}

export type DestinatarioInadPayload = Pick<DestinatarioInad, 'nome' | 'email' | 'id_empresa' | 'ativo'>;

@Injectable({ providedIn: 'root' })
export class InadimplenciaService {
  private http = inject(HttpClient);
  private readonly base = `${environment.apiUrl}/financeiro/inadimplencia`;

  // ── Tela ──
  minha(): Observable<RespostaMinha> {
    return this.http.get<RespostaMinha>(`${this.base}/minha`);
  }

  minhaXlsx(): Observable<Blob> {
    return this.http.get(`${this.base}/minha/xlsx`, { responseType: 'blob' });
  }

  equipe(empresas: number[]): Observable<RespostaEquipe> {
    const params: Record<string, string> = empresas.length ? { empresas: empresas.join(',') } : {};
    return this.http.get<RespostaEquipe>(`${this.base}/equipe`, { params });
  }

  equipeXlsx(empresas: number[]): Observable<Blob> {
    const params: Record<string, string> = empresas.length ? { empresas: empresas.join(',') } : {};
    return this.http.get(`${this.base}/equipe/xlsx`, { params, responseType: 'blob' });
  }

  // ── Configuração ──
  previa(): Observable<Previa> {
    return this.http.get<Previa>(`${this.base}/previa`);
  }

  /** Inicia o envio em segundo plano; acompanhar pelo histórico. */
  enviarAgora(): Observable<{ idExecucao: number; modoTeste: boolean }> {
    return this.http.post<{ idExecucao: number; modoTeste: boolean }>(`${this.base}/enviar-agora`, {});
  }

  historico(limite = 20): Observable<Execucao[]> {
    return this.http.get<Execucao[]>(`${this.base}/historico`, { params: { limite: String(limite) } });
  }

  envios(idExecucao: number): Observable<Envio[]> {
    return this.http.get<Envio[]>(`${this.base}/historico/${idExecucao}/envios`);
  }

  listarDestinatarios(): Observable<{ destinatarios: DestinatarioInad[]; modoTeste: boolean }> {
    return this.http.get<{ destinatarios: DestinatarioInad[]; modoTeste: boolean }>(`${this.base}/destinatarios`);
  }

  criarDestinatario(d: DestinatarioInadPayload): Observable<DestinatarioInad> {
    return this.http.post<DestinatarioInad>(`${this.base}/destinatarios`, d);
  }

  atualizarDestinatario(id: number, d: DestinatarioInadPayload): Observable<DestinatarioInad> {
    return this.http.put<DestinatarioInad>(`${this.base}/destinatarios/${id}`, d);
  }

  removerDestinatario(id: number): Observable<{ ok: true }> {
    return this.http.delete<{ ok: true }>(`${this.base}/destinatarios/${id}`);
  }

  testarDestinatario(id: number): Observable<{ destinatarios: string[]; modoTeste: boolean }> {
    return this.http.post<{ destinatarios: string[]; modoTeste: boolean }>(`${this.base}/destinatarios/${id}/teste`, {});
  }
}
